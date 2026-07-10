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
const authEndpoint =
  env.KAKAO_CLOUD_AUTH_ENDPOINT || "https://iam.kakaocloud.com/identity/v3/auth/tokens";
const required = [
  "KAKAO_CLOUD_ACCESS_KEY_ID",
  "KAKAO_CLOUD_SECRET_ACCESS_KEY",
  "KAKAO_CLOUD_REGION",
  "KAKAO_CLOUD_PROJECT_ID",
];
const missing = required.filter((key) => !env[key]);

console.log("KakaoCloud token smoke test");
console.log(`Mode: ${execute ? "execute" : "dry-run"}`);
console.log(`Auth endpoint: ${authEndpoint}`);
console.log(`Region: ${env.KAKAO_CLOUD_REGION || "missing"}`);
console.log(`Project ID: ${env.KAKAO_CLOUD_PROJECT_ID ? "set" : "missing"}`);
console.log("Cost cap: 0 KRW expected; token issue call only");

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

if (!execute) {
  console.log("Dry-run only. Re-run with --execute to request a KakaoCloud API token.");
  process.exit(0);
}

const response = await fetch(authEndpoint, {
  method: "POST",
  cache: "no-store",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    auth: {
      identity: {
        methods: ["application_credential"],
        application_credential: {
          id: env.KAKAO_CLOUD_ACCESS_KEY_ID,
          secret: env.KAKAO_CLOUD_SECRET_ACCESS_KEY,
        },
      },
    },
  }),
});

const token = response.headers.get("x-subject-token");

console.log(`HTTP status: ${response.status}`);

if (!response.ok || !token) {
  console.error(`KakaoCloud token smoke test failed: HTTP ${response.status}; token header missing`);
  process.exit(1);
}

console.log(`Token header: received (${token.length} characters, hidden)`);
console.log("KakaoCloud token smoke test: OK");
