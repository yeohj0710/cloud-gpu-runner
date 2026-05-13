import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
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
  "NCP_ACCESS_KEY_ID",
  "NCP_SECRET_KEY",
  "NCP_API_ENDPOINT"
];

const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const endpoint = env.NCP_API_ENDPOINT.replace(/\/+$/, "");
const method = "GET";
const pathWithQuery = "/vserver/v2/getRegionList?responseFormatType=json";
const url = new URL(pathWithQuery, endpoint);

function makeSignature({ method, pathWithQuery, timestamp, accessKey, secretKey }) {
  const message = `${method} ${pathWithQuery}\n${timestamp}\n${accessKey}`;

  return createHmac("sha256", secretKey)
    .update(message, "utf8")
    .digest("base64");
}

console.log("NCP smoke test: getRegionList");
console.log(`Mode: ${execute ? "execute" : "dry-run"}`);
console.log(`Request: ${method} ${url.origin}${pathWithQuery}`);
console.log("Cost cap: 0 KRW expected; metadata/list call only");

if (!execute) {
  console.log("Dry-run only. Re-run with --execute to call NCP.");
  process.exit(0);
}

const timestamp = String(Date.now());
const signature = makeSignature({
  method,
  pathWithQuery,
  timestamp,
  accessKey: env.NCP_ACCESS_KEY_ID,
  secretKey: env.NCP_SECRET_KEY
});

const response = await fetch(url, {
  method,
  headers: {
    "x-ncp-apigw-timestamp": timestamp,
    "x-ncp-iam-access-key": env.NCP_ACCESS_KEY_ID,
    "x-ncp-apigw-signature-v2": signature
  }
});

const responseText = await response.text();
let body;

try {
  body = JSON.parse(responseText);
} catch {
  body = null;
}

console.log(`HTTP status: ${response.status}`);

if (!response.ok) {
  const message =
    body?.responseError?.message ??
    body?.error?.message ??
    responseText.slice(0, 300);

  console.error(`NCP smoke test failed: ${message}`);
  process.exit(1);
}

const regionList = body?.getRegionListResponse?.regionList ?? [];
const regions = regionList
  .map((region) => region.regionCode ?? region.regionName)
  .filter(Boolean);

console.log(`Return code: ${body?.getRegionListResponse?.returnCode ?? "unknown"}`);
console.log(`Regions: ${regions.length > 0 ? regions.join(", ") : "none parsed"}`);
console.log("NCP smoke test: OK");
