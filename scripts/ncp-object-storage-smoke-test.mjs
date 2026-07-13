import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const keepBucket = args.has("--keep-bucket");
const envFile = resolve(process.cwd(), ".env.local");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");

    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    const rawValue = line.slice(eqIndex + 1).trim();
    values[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }

  return values;
}

const localEnv = parseEnvFile(envFile);
const env = { ...localEnv, ...process.env };

const required = [
  "NCP_OBJECT_STORAGE_ENDPOINT"
];

const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const endpoint = env.NCP_OBJECT_STORAGE_ENDPOINT.replace(/\/+$/, "");
const endpointUrl = new URL(endpoint);
const host = endpointUrl.host;
const region = env.NCP_OBJECT_STORAGE_REGION || "kr-standard";
const accessKey = env.NCP_OBJECT_STORAGE_ACCESS_KEY_ID;
const secretKey = env.NCP_OBJECT_STORAGE_SECRET_KEY;
const service = "s3";
const requestType = "aws4_request";
const bucketName = `cloud-gpu-runner-${new Date()
  .toISOString()
  .slice(0, 10)
  .replaceAll("-", "")}-${randomBytes(3).toString("hex")}`;
const objectName = "smoke-test.txt";
const objectBody = `cloud-gpu-runner object storage smoke test\ncreated=${new Date().toISOString()}\n`;

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

function signingKey(secretKey, dateStamp) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);

  return hmac(kService, requestType);
}

function makeAuthorization({ method, canonicalUri, queryString, body, date }) {
  const amzDate = formatAmzDate(date);
  const dateStamp = formatDateStamp(date);
  const payloadHash = sha256Hex(body ?? "");
  const headers = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate
  };
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((key) => `${key}:${headers[key]}\n`)
    .join("");
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalRequest = [
    method,
    canonicalUri,
    queryString ?? "",
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/${requestType}`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signature = hmac(signingKey(secretKey, dateStamp), stringToSign, "hex");

  return {
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    payloadHash
  };
}

async function signedRequest({ method, canonicalUri, body }) {
  const date = new Date();
  const { headers } = makeAuthorization({
    method,
    canonicalUri,
    queryString: "",
    body,
    date
  });
  const response = await fetch(`${endpoint}${canonicalUri}`, {
    method,
    headers,
    body: body === undefined ? undefined : body
  });
  const text = await response.text();

  return { response, text };
}

function summarizeFailure(text) {
  const code = text.match(/<Code>(.*?)<\/Code>/)?.[1];
  const message = text.match(/<Message>(.*?)<\/Message>/)?.[1];

  return [code, message].filter(Boolean).join(": ") || text.slice(0, 300);
}

function printObjectStorageHelp(error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`NCP Object Storage smoke test failed: ${message}`);

  if (message.includes("InvalidAccessKeyId")) {
    console.error(
      [
        "The configured key is not accepted by the Object Storage S3 API.",
        "Create or copy an API authentication key from the NCP console:",
        "My Account > Manage account and security > Manage security > Manage access > API authentication key.",
        "Then set NCP_OBJECT_STORAGE_ACCESS_KEY_ID and NCP_OBJECT_STORAGE_SECRET_KEY to that Access Key ID and Secret Key.",
      ].join("\n"),
    );
  }
}

async function requireOk(label, request, expectedStatuses) {
  const { response, text } = await request;

  console.log(`${label}: HTTP ${response.status}`);

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${label} failed: ${summarizeFailure(text)}`);
  }

  return text;
}

console.log("NCP Object Storage smoke test");
console.log(`Mode: ${execute ? "execute" : "dry-run"}`);
console.log(`Endpoint: ${endpoint}`);
console.log(`Region: ${region}`);
console.log(
  `Credentials: ${
    env.NCP_OBJECT_STORAGE_ACCESS_KEY_ID ? "S3-compatible key configured" : "missing S3-compatible key"
  }`
);
console.log(`Bucket: ${bucketName}`);
console.log(`Object: ${objectName}`);
console.log("Cost cap: Tier 1, <= 1,000 KRW; expected to be near 0 KRW");
console.log(`Cleanup: ${keepBucket ? "keep bucket requested" : "delete object and bucket"}`);

if (!execute) {
  console.log("Dry-run only. Re-run with --execute to create and clean up the test object.");
  process.exit(0);
}

if (!accessKey || !secretKey) {
  console.error(
    "Missing Object Storage credentials. Set NCP_OBJECT_STORAGE_ACCESS_KEY_ID and NCP_OBJECT_STORAGE_SECRET_KEY before executing Object Storage tests."
  );
  process.exit(1);
}

let bucketCreated = false;
let objectCreated = false;
let smokeOk = false;

try {
  await requireOk(
    "Create bucket",
    signedRequest({
      method: "PUT",
      canonicalUri: `/${bucketName}`,
      body: ""
    }),
    [200]
  );
  bucketCreated = true;

  await requireOk(
    "Put object",
    signedRequest({
      method: "PUT",
      canonicalUri: `/${bucketName}/${objectName}`,
      body: objectBody
    }),
    [200]
  );
  objectCreated = true;

  const downloaded = await requireOk(
    "Get object",
    signedRequest({
      method: "GET",
      canonicalUri: `/${bucketName}/${objectName}`
    }),
    [200]
  );

  if (downloaded !== objectBody) {
    throw new Error("Downloaded object did not match uploaded body.");
  }

  console.log("Object round trip: OK");
  smokeOk = true;
} catch (error) {
  printObjectStorageHelp(error);
  process.exitCode = 1;
} finally {
  if (objectCreated && !keepBucket) {
    try {
      await requireOk(
        "Delete object",
        signedRequest({
          method: "DELETE",
          canonicalUri: `/${bucketName}/${objectName}`
        }),
        [204, 200]
      );
    } catch (error) {
      console.error(`Cleanup warning: ${error.message}`);
    }
  }

  if (bucketCreated && !keepBucket) {
    try {
      await requireOk(
        "Delete bucket",
        signedRequest({
          method: "DELETE",
          canonicalUri: `/${bucketName}`
        }),
        [204, 200]
      );
    } catch (error) {
      console.error(`Cleanup warning: ${error.message}`);
    }
  }
}

if (smokeOk) {
  console.log("NCP Object Storage smoke test: OK");
} else {
  process.exit(process.exitCode || 1);
}
