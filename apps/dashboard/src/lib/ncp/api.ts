import { createHmac } from "node:crypto";

import type { LabEnv } from "./env";

export type NcpStep = {
  label: string;
  status: "planned" | "ok" | "blocked" | "failed";
  detail?: string;
};

export type ExperimentMode = "dry-run" | "execute";

export function makeNcpSignatureV2({
  accessKey,
  secretKey,
  method,
  pathWithQuery,
  timestamp,
}: {
  accessKey: string;
  secretKey: string;
  method: string;
  pathWithQuery: string;
  timestamp: string;
}) {
  const message = `${method} ${pathWithQuery}\n${timestamp}\n${accessKey}`;

  return createHmac("sha256", secretKey).update(message, "utf8").digest("base64");
}

export async function callNcpApi({
  env,
  endpointKey,
  method,
  pathWithQuery,
}: {
  env: LabEnv;
  endpointKey: "NCP_API_ENDPOINT" | "NCP_BILLING_API_ENDPOINT";
  method: "GET";
  pathWithQuery: string;
}) {
  const accessKey = env.NCP_ACCESS_KEY_ID;
  const secretKey = env.NCP_SECRET_KEY;
  const endpoint = env[endpointKey]?.replace(/\/+$/, "");

  if (!accessKey || !secretKey || !endpoint) {
    throw new Error(`Missing required NCP API env vars for ${endpointKey}`);
  }

  const timestamp = String(Date.now());
  const signature = makeNcpSignatureV2({
    accessKey,
    secretKey,
    method,
    pathWithQuery,
    timestamp,
  });
  const response = await fetch(`${endpoint}${pathWithQuery}`, {
    method,
    cache: "no-store",
    headers: {
      "x-ncp-apigw-timestamp": timestamp,
      "x-ncp-iam-access-key": accessKey,
      "x-ncp-apigw-signature-v2": signature,
    },
  });
  const text = await response.text();
  let body: unknown = null;

  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    response,
    body,
    text,
  };
}

export function compactCloudError(body: unknown, text: string) {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    const responseError = record.responseError as Record<string, unknown> | undefined;
    const error = record.error as Record<string, unknown> | undefined;
    const message = responseError?.message ?? error?.message;

    if (typeof message === "string") {
      return message;
    }
  }

  return text.slice(0, 300);
}
