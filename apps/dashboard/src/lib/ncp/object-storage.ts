import { createHash, createHmac, randomBytes } from "node:crypto";

import type { LabEnv } from "./env";
import type { NcpStep } from "./api";

type SignedRequestInput = {
  env: LabEnv;
  endpoint: string;
  host: string;
  region: string;
  accessKey: string;
  secretKey: string;
  method: "PUT" | "GET" | "DELETE";
  canonicalUri: string;
  body?: string;
};

type ObjectStorageResult = {
  bucketName: string;
  objectName: string;
  steps: NcpStep[];
  blocked?: string;
};

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacBuffer(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function formatDateStamp(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function signingKey(secretKey: string, region: string, dateStamp: string) {
  const kDate = hmacBuffer(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacBuffer(kDate, region);
  const kService = hmacBuffer(kRegion, "s3");

  return hmacBuffer(kService, "aws4_request");
}

function authorizationHeader(input: SignedRequestInput) {
  const date = new Date();
  const amzDate = formatAmzDate(date);
  const dateStamp = formatDateStamp(date);
  const payloadHash = sha256Hex(input.body ?? "");
  const headers = {
    host: input.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((key) => `${key}:${headers[key as keyof typeof headers]}\n`)
    .join("");
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${input.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = hmacHex(
    signingKey(input.secretKey, input.region, dateStamp),
    stringToSign,
  );

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function signedRequest(input: SignedRequestInput) {
  const response = await fetch(`${input.endpoint}${input.canonicalUri}`, {
    method: input.method,
    cache: "no-store",
    headers: authorizationHeader(input),
    body: input.body,
  });
  const text = await response.text();

  return { response, text };
}

function summarizeXmlError(text: string) {
  const code = text.match(/<Code>(.*?)<\/Code>/)?.[1];
  const message = text.match(/<Message>(.*?)<\/Message>/)?.[1];

  return [code, message].filter(Boolean).join(": ") || text.slice(0, 300);
}

export function getObjectStoragePlan(env: LabEnv) {
  const endpoint = env.NCP_OBJECT_STORAGE_ENDPOINT?.replace(/\/+$/, "");
  const region = env.NCP_OBJECT_STORAGE_REGION || "kr-standard";
  const objectStorageReady = Boolean(
    env.NCP_OBJECT_STORAGE_ACCESS_KEY_ID && env.NCP_OBJECT_STORAGE_SECRET_KEY,
  );
  const credentialsKind = objectStorageReady
    ? "S3-compatible key configured"
    : "missing S3-compatible key";

  return {
    endpoint,
    region,
    credentialsKind,
    credentialReady: objectStorageReady,
  };
}

export async function runObjectStorageSmoke(env: LabEnv): Promise<ObjectStorageResult> {
  const endpoint = env.NCP_OBJECT_STORAGE_ENDPOINT?.replace(/\/+$/, "");
  const region = env.NCP_OBJECT_STORAGE_REGION || "kr-standard";
  const accessKey = env.NCP_OBJECT_STORAGE_ACCESS_KEY_ID;
  const secretKey = env.NCP_OBJECT_STORAGE_SECRET_KEY;

  if (!endpoint || !accessKey || !secretKey) {
    throw new Error(
      "Set NCP_OBJECT_STORAGE_ACCESS_KEY_ID and NCP_OBJECT_STORAGE_SECRET_KEY before executing Object Storage tests.",
    );
  }

  const host = new URL(endpoint).host;
  const bucketName = `cloud-credit-lab-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}-${randomBytes(3).toString("hex")}`;
  const objectName = "smoke-test.txt";
  const objectBody = `cloud-credit-lab object storage smoke test\ncreated=${new Date().toISOString()}\n`;
  const steps: NcpStep[] = [];
  let bucketCreated = false;
  let objectCreated = false;

  async function requireStatus(
    label: string,
    request: Promise<{ response: Response; text: string }>,
    expectedStatuses: number[],
  ) {
    const { response, text } = await request;

    if (!expectedStatuses.includes(response.status)) {
      const detail = summarizeXmlError(text);
      steps.push({ label, status: "blocked", detail: `HTTP ${response.status}: ${detail}` });
      throw new Error(detail);
    }

    steps.push({ label, status: "ok", detail: `HTTP ${response.status}` });

    return text;
  }

  const baseInput = {
    env,
    endpoint,
    host,
    region,
    accessKey,
    secretKey,
  };

  try {
    await requireStatus(
      "Create temporary bucket",
      signedRequest({
        ...baseInput,
        method: "PUT",
        canonicalUri: `/${bucketName}`,
        body: "",
      }),
      [200],
    );
    bucketCreated = true;

    await requireStatus(
      "Upload tiny object",
      signedRequest({
        ...baseInput,
        method: "PUT",
        canonicalUri: `/${bucketName}/${objectName}`,
        body: objectBody,
      }),
      [200],
    );
    objectCreated = true;

    const downloaded = await requireStatus(
      "Download and compare object",
      signedRequest({
        ...baseInput,
        method: "GET",
        canonicalUri: `/${bucketName}/${objectName}`,
      }),
      [200],
    );

    if (downloaded !== objectBody) {
      throw new Error("Downloaded object did not match uploaded body.");
    }

    steps.push({ label: "Object round trip", status: "ok", detail: "Body matched" });
  } catch (error) {
    return {
      bucketName,
      objectName,
      steps,
      blocked: error instanceof Error ? error.message : "Object Storage smoke test failed.",
    };
  } finally {
    if (objectCreated) {
      try {
        await requireStatus(
          "Delete temporary object",
          signedRequest({
            ...baseInput,
            method: "DELETE",
            canonicalUri: `/${bucketName}/${objectName}`,
          }),
          [200, 204],
        );
      } catch {
        steps.push({
          label: "Delete temporary object",
          status: "failed",
          detail: "Manual cleanup may be needed.",
        });
      }
    }

    if (bucketCreated) {
      try {
        await requireStatus(
          "Delete temporary bucket",
          signedRequest({
            ...baseInput,
            method: "DELETE",
            canonicalUri: `/${bucketName}`,
          }),
          [200, 204],
        );
      } catch {
        steps.push({
          label: "Delete temporary bucket",
          status: "failed",
          detail: "Manual cleanup may be needed.",
        });
      }
    }
  }

  return { bucketName, objectName, steps };
}
