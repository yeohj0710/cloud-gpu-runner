import { createHash, createHmac } from "node:crypto";
import { realpath, stat, readFile } from "node:fs/promises";
import path from "node:path";

import { findSecretMatches } from "./secret-patterns.mjs";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const SENSITIVE_SEGMENTS = new Set([
  ".git",
  ".n8n",
  "binary-data",
  "node_modules",
  "credentials",
  "secrets",
]);
const SENSITIVE_EXTENSIONS = new Set([
  ".db",
  ".7z",
  ".gz",
  ".jks",
  ".key",
  ".kdbx",
  ".ovpn",
  ".p12",
  ".pem",
  ".pfx",
  ".ppk",
  ".rar",
  ".sqlite",
  ".sqlite3",
  ".tar",
  ".tgz",
  ".zip",
]);

function normalizeSlashes(value) {
  return value.replaceAll("\\", "/");
}

function safeSegment(value, label) {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error(`${label} must contain letters or numbers.`);
  }

  return normalized;
}

function containsSensitiveName(filePath) {
  const normalized = normalizeSlashes(filePath).toLowerCase();
  const segments = normalized.split("/").filter(Boolean);
  const filename = segments.at(-1) ?? "";
  const extension = path.extname(filename);

  if (segments.some((segment) => SENSITIVE_SEGMENTS.has(segment))) {
    return true;
  }

  if (filename === ".env" || filename.startsWith(".env.")) {
    return true;
  }

  if (SENSITIVE_EXTENSIONS.has(extension)) {
    return true;
  }

  return /(^|[._-])(credential|oauth|private-key|secret|token)([._-]|$)/i.test(filename);
}

function isInsideRoot(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalPath(bucket, objectKey = "") {
  return `/${[bucket, ...objectKey.split("/").filter(Boolean)].map(encodeRfc3986).join("/")}`;
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function formatAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function formatDateStamp(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function contentTypeFor(filename) {
  const extension = path.extname(filename).toLowerCase();
  const known = {
    ".csv": "text/csv; charset=utf-8",
    ".json": "application/json",
    ".jsonl": "application/x-ndjson",
    ".md": "text/markdown; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
  };

  return known[extension] ?? "application/octet-stream";
}

function isLikelyText(body) {
  const sample = body.subarray(0, Math.min(body.length, 16_384));
  return !sample.includes(0);
}

export function parseArgs(argv) {
  const parsed = {
    provider: "naver",
    project: "",
    source: "",
    execute: false,
    createBucket: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--execute") {
      parsed.execute = true;
      continue;
    }

    if (argument === "--create-bucket") {
      parsed.createBucket = true;
      continue;
    }

    for (const key of ["provider", "project", "source"]) {
      if (argument === `--${key}`) {
        parsed[key] = argv[index + 1] ?? "";
        index += 1;
        break;
      }

      if (argument.startsWith(`--${key}=`)) {
        parsed[key] = argument.slice(key.length + 3);
        break;
      }
    }
  }

  if (!parsed.project || !parsed.source) {
    throw new Error("Usage: --provider naver|kakao --project <name> --source <file> [--execute] [--create-bucket]");
  }

  if (!new Set(["naver", "kakao"]).has(parsed.provider)) {
    throw new Error("Provider must be naver or kakao.");
  }

  return parsed;
}

export function assertPublishableSource(source, devRoot = "C:\\dev") {
  const resolvedSource = path.resolve(source);
  const resolvedRoot = path.resolve(devRoot);

  if (!isInsideRoot(resolvedSource, resolvedRoot)) {
    throw new Error(`Source must be inside ${resolvedRoot}.`);
  }

  if (containsSensitiveName(resolvedSource)) {
    throw new Error("Source path looks sensitive and cannot be published.");
  }

  return resolvedSource;
}

export function buildObjectKey({ project, digest, filename, date }) {
  const safeProject = safeSegment(project, "Project");
  const parsed = path.parse(filename);
  let safeBase = "artifact";

  try {
    safeBase = safeSegment(parsed.name, "Filename");
  } catch {
    // The digest still makes non-Latin filenames unique without leaking their original path.
  }
  const safeExtension = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
  const digestPrefix = digest.toLowerCase().replace(/[^a-f0-9]/g, "").slice(0, 12);

  if (digestPrefix.length !== 12) {
    throw new Error("Digest must include at least 12 hexadecimal characters.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  return `projects/${safeProject}/${date}/${digestPrefix}-${safeBase}${safeExtension}`;
}

export async function createPublishPlan({
  provider,
  project,
  source,
  devRoot = "C:\\dev",
  bucket,
  maxBytes = DEFAULT_MAX_BYTES,
  now = new Date(),
}) {
  if (!new Set(["naver", "kakao"]).has(provider)) {
    throw new Error("Provider must be naver or kakao.");
  }

  const sourcePath = assertPublishableSource(source, devRoot);
  const [canonicalSource, canonicalRoot] = await Promise.all([
    realpath(sourcePath),
    realpath(path.resolve(devRoot)),
  ]);
  assertPublishableSource(canonicalSource, canonicalRoot);
  const sourceStat = await stat(canonicalSource);

  if (!sourceStat.isFile()) {
    throw new Error("Source must be one regular file. Recursive uploads are not supported.");
  }

  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Maximum upload size must be a positive integer.");
  }

  if (sourceStat.size > maxBytes) {
    throw new Error(`Source is ${sourceStat.size} bytes; maximum is ${maxBytes} bytes.`);
  }

  const body = await readFile(canonicalSource);
  const contentScanned = isLikelyText(body);

  if (contentScanned) {
    const secretMatches = findSecretMatches(body.toString("utf8"));

    if (secretMatches.length > 0) {
      throw new Error(`Source content looks sensitive: ${secretMatches.join(", ")}.`);
    }
  }

  const sha256 = sha256Hex(body);
  const date = now.toISOString().slice(0, 10);

  return {
    provider,
    project: safeSegment(project, "Project"),
    sourcePath: canonicalSource,
    bucket: bucket || null,
    objectKey: buildObjectKey({ project, digest: sha256, filename: path.basename(canonicalSource), date }),
    contentType: contentTypeFor(canonicalSource),
    sizeBytes: sourceStat.size,
    sha256,
    maxBytes,
    contentScanned,
    costCap: "single private object, <= 1,000 KRW guardrail",
  };
}

export function providerConfig(provider, env) {
  const configs = {
    naver: {
      endpoint: env.NCP_OBJECT_STORAGE_ENDPOINT || "https://kr.object.ncloudstorage.com",
      region: env.NCP_OBJECT_STORAGE_REGION || "kr-standard",
      accessKey: env.NCP_OBJECT_STORAGE_ACCESS_KEY_ID,
      secretKey: env.NCP_OBJECT_STORAGE_SECRET_KEY,
      bucket: env.NCP_ARTIFACT_BUCKET,
    },
    kakao: {
      endpoint:
        env.KAKAO_CLOUD_OBJECT_STORAGE_ENDPOINT ||
        "https://objectstorage.kr-central-2.kakaocloud.com",
      region: env.KAKAO_CLOUD_REGION || "kr-central-2",
      accessKey: env.KAKAO_CLOUD_S3_ACCESS_KEY,
      secretKey: env.KAKAO_CLOUD_S3_SECRET_KEY,
      bucket: env.KAKAO_CLOUD_ARTIFACT_BUCKET,
    },
  };

  if (!configs[provider]) {
    throw new Error("Provider must be naver or kakao.");
  }

  return configs[provider];
}

function makeAuthorization({ config, method, uri, body, extraHeaders = {}, date = new Date() }) {
  const endpointUrl = new URL(config.endpoint);
  const host = endpointUrl.host;
  const amzDate = formatAmzDate(date);
  const dateStamp = formatDateStamp(date);
  const payloadHash = sha256Hex(body ?? "");
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...Object.fromEntries(
      Object.entries(extraHeaders).map(([key, value]) => [key.toLowerCase(), String(value).trim()]),
    ),
  };
  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderNames.map((key) => `${key}:${headers[key]}\n`).join("");
  const signedHeaders = sortedHeaderNames.join(";");
  const canonicalRequest = [
    method,
    uri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const kDate = hmac(`AWS4${config.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function signedRequest({ config, method, bucket, objectKey, body, extraHeaders }) {
  const uri = canonicalPath(bucket, objectKey);
  const headers = makeAuthorization({ config, method, uri, body, extraHeaders });
  const response = await fetch(`${config.endpoint.replace(/\/+$/, "")}${uri}`, {
    method,
    headers,
    body: body === undefined ? undefined : body,
  });
  const text = method === "HEAD" ? "" : await response.text();

  return { response, text };
}

function failureSummary(text) {
  const code = text.match(/<Code>(.*?)<\/Code>/)?.[1];
  const message = text.match(/<Message>(.*?)<\/Message>/)?.[1];
  return [code, message].filter(Boolean).join(": ") || text.slice(0, 300) || "no response body";
}

export async function publishArtifact({ plan, config, createBucket = false }) {
  if (!plan.bucket) {
    throw new Error("Artifact bucket is not configured.");
  }

  if (!config.accessKey || !config.secretKey) {
    throw new Error(`Missing ${plan.provider} S3-compatible credentials.`);
  }

  const bucketCheck = await signedRequest({
    config,
    method: "HEAD",
    bucket: plan.bucket,
  });

  let bucketCreated = false;

  if (bucketCheck.response.status === 404) {
    if (!createBucket) {
      throw new Error("Artifact bucket does not exist. Re-run with --create-bucket after checking the name.");
    }

    const createResult = await signedRequest({
      config,
      method: "PUT",
      bucket: plan.bucket,
      body: Buffer.alloc(0),
    });

    if (![200, 201].includes(createResult.response.status)) {
      throw new Error(`Bucket creation failed: ${failureSummary(createResult.text)}`);
    }

    bucketCreated = true;
  } else if (bucketCheck.response.status !== 200) {
    throw new Error(`Bucket check failed with HTTP ${bucketCheck.response.status}.`);
  }

  const objectCheck = await signedRequest({
    config,
    method: "HEAD",
    bucket: plan.bucket,
    objectKey: plan.objectKey,
  });

  if (objectCheck.response.status === 200) {
    return { bucketCreated, uploaded: false, alreadyPresent: true, httpStatus: 200 };
  }

  if (objectCheck.response.status !== 404) {
    throw new Error(`Object check failed with HTTP ${objectCheck.response.status}.`);
  }

  const body = await readFile(plan.sourcePath);

  if (body.length !== plan.sizeBytes || sha256Hex(body) !== plan.sha256) {
    throw new Error("Source changed after the publish plan was created. Run the command again.");
  }

  const upload = await signedRequest({
    config,
    method: "PUT",
    bucket: plan.bucket,
    objectKey: plan.objectKey,
    body,
    extraHeaders: {
      "content-type": plan.contentType,
      "x-amz-meta-sha256": plan.sha256,
    },
  });

  if (![200, 201].includes(upload.response.status)) {
    throw new Error(`Object upload failed: ${failureSummary(upload.text)}`);
  }

  return {
    bucketCreated,
    uploaded: true,
    alreadyPresent: false,
    httpStatus: upload.response.status,
  };
}
