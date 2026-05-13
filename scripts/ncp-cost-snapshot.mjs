import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const monthArg = args.find((arg) => arg.startsWith("--month="));
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

function currentMonth() {
  return new Date().toISOString().slice(0, 7).replace("-", "");
}

const localEnv = parseEnvFile(envFile);
const env = { ...localEnv, ...process.env };
const required = [
  "NCP_ACCESS_KEY_ID",
  "NCP_SECRET_KEY",
  "NCP_BILLING_API_ENDPOINT"
];
const missing = required.filter((key) => !env[key]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const month = monthArg ? monthArg.slice("--month=".length) : currentMonth();

if (!/^\d{6}$/.test(month)) {
  console.error(`Invalid month: ${month}. Use YYYYMM, for example 202605.`);
  process.exit(1);
}

const endpoint = env.NCP_BILLING_API_ENDPOINT.replace(/\/+$/, "");
const method = "GET";
const pathWithQuery =
  `/billing/v1/cost/getContractDemandCostList` +
  `?startMonth=${month}&endMonth=${month}&responseFormatType=json&pageSize=100`;
const url = new URL(pathWithQuery, endpoint);

function makeSignature({ method, pathWithQuery, timestamp, accessKey, secretKey }) {
  const message = `${method} ${pathWithQuery}\n${timestamp}\n${accessKey}`;

  return createHmac("sha256", secretKey)
    .update(message, "utf8")
    .digest("base64");
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

console.log("NCP cost snapshot");
console.log(`Mode: ${execute ? "execute" : "dry-run"}`);
console.log(`Month: ${month}`);
console.log(`Request: ${method} ${url.origin}${pathWithQuery}`);
console.log("Cost cap: 0 KRW expected; billing read call only");

if (!execute) {
  console.log("Dry-run only. Re-run with --execute to call Billing API.");
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

  console.error(`NCP cost snapshot failed: ${message}`);
  process.exit(1);
}

const payload = body?.getContractDemandCostListResponse;
const rows = payload?.contractDemandCostList ?? [];
const rowsArray = Array.isArray(rows) ? rows : [rows].filter(Boolean);
const totals = new Map();

for (const row of rowsArray) {
  const currency = row?.payCurrency?.code ?? "UNKNOWN";
  totals.set(currency, (totals.get(currency) ?? 0) + toNumber(row?.demandAmount));
}

console.log(`Return code: ${payload?.returnCode ?? "unknown"}`);
console.log(`Rows: ${rowsArray.length}`);

if (totals.size === 0) {
  console.log("Demand amount: no rows returned");
} else {
  for (const [currency, amount] of totals) {
    console.log(`Demand amount (${currency}): ${amount}`);
  }
}

console.log("NCP cost snapshot: OK");
