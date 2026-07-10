import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { providerConfig, verifyPublishedArtifact } from "./lib/artifact-publish.mjs";

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const values = {};

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }

  return values;
}

function parseArgs(argv) {
  const parsed = { provider: "naver", execute: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--provider", "--object", "--sha256"].includes(argument)) {
      const key = argument.slice(2);
      parsed[key] = argv[index + 1];
      index += 1;
    } else if (argument === "--execute") {
      parsed.execute = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!parsed.object || !parsed.sha256) {
    throw new Error("Usage: --provider <naver|kakao> --object <key> --sha256 <digest> [--execute]");
  }

  return parsed;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const env = {
    ...parseEnvFile(resolve(process.cwd(), ".env.local")),
    ...process.env,
  };
  const config = providerConfig(args.provider, env);
  const bucket = config.bucket;
  const maxBytes = Number(env.CLOUD_ARTIFACT_MAX_BYTES || 10 * 1024 * 1024);

  console.log("Cloud artifact restore verification");
  console.log(`Mode: ${args.execute ? "execute" : "dry-run"}`);
  console.log(`Provider: ${args.provider}`);
  console.log(`Object: ${args.object}`);
  console.log(`Expected SHA-256: ${args.sha256}`);
  console.log(`Maximum download: ${maxBytes} bytes`);

  if (!args.execute) {
    console.log("Network calls: 0");
    console.log("Dry-run only. Add --execute to download privately and verify in memory.");
  } else {
    const result = await verifyPublishedArtifact({
      config,
      bucket,
      objectKey: args.object,
      expectedSha256: args.sha256,
      maxBytes,
    });
    console.log(`Download: HTTP ${result.httpStatus}`);
    console.log(`Size: ${result.sizeBytes} bytes`);
    console.log("SHA-256 match: yes");
    console.log("Cloud artifact restore verification: OK");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
