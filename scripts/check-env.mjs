import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const profiles = {
  naver: {
    required: [
      "NCP_ACCESS_KEY_ID",
      "NCP_SECRET_KEY",
      "NCP_REGION",
      "NCP_API_ENDPOINT",
      "NCP_BILLING_API_ENDPOINT"
    ],
    optional: [
      "NCP_OBJECT_STORAGE_ENDPOINT",
      "NCP_OBJECT_STORAGE_REGION",
      "NCP_OBJECT_STORAGE_ACCESS_KEY_ID",
      "NCP_OBJECT_STORAGE_SECRET_KEY",
      "NCP_ARTIFACT_BUCKET",
      "CLOUD_ARTIFACT_MAX_BYTES"
    ]
  },
  kakao: {
    required: [
      "KAKAO_CLOUD_ACCESS_KEY_ID",
      "KAKAO_CLOUD_SECRET_ACCESS_KEY",
      "KAKAO_CLOUD_REGION",
      "KAKAO_CLOUD_PROJECT_ID"
    ],
    optional: [
      "KAKAO_CLOUD_USER_ID",
      "KAKAO_CLOUD_AUTH_ENDPOINT",
      "KAKAO_CLOUD_OBJECT_STORAGE_ENDPOINT",
      "KAKAO_CLOUD_S3_ACCESS_KEY",
      "KAKAO_CLOUD_S3_SECRET_KEY",
      "KAKAO_CLOUD_ARTIFACT_BUCKET"
    ],
  }
};

const provider = process.argv[2] ?? "naver";
const envFile = resolve(process.cwd(), ".env.local");

if (!profiles[provider]) {
  console.error(`Unknown provider: ${provider}`);
  console.error(`Known providers: ${Object.keys(profiles).join(", ")}`);
  process.exit(2);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  const values = {};

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
const profile = profiles[provider];

const missing = profile.required.filter((key) => !env[key]);
const presentOptional = profile.optional.filter((key) => Boolean(env[key]));

console.log(`Provider: ${provider}`);
console.log(`Env file: ${envFile}`);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Required env vars: OK");

if (profile.optional.length > 0) {
  console.log(
    `Optional env vars set: ${presentOptional.length}/${profile.optional.length}`
  );
}
