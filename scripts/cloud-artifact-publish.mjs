import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createPublishPlan,
  parseArgs,
  providerConfig,
  publishArtifact,
} from "./lib/artifact-publish.mjs";

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const values = {};

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }

  return values;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const env = { ...parseEnvFile(resolve(process.cwd(), ".env.local")), ...process.env };
  const config = providerConfig(args.provider, env);
  const maxBytes = Number(env.CLOUD_ARTIFACT_MAX_BYTES || 10 * 1024 * 1024);
  const plan = await createPublishPlan({
    provider: args.provider,
    project: args.project,
    source: resolve(process.cwd(), args.source),
    bucket: config.bucket,
    maxBytes,
  });

  console.log("Cloud artifact publish");
  console.log(`Mode: ${args.execute ? "execute" : "dry-run"}`);
  console.log(`Provider: ${plan.provider}`);
  console.log(`Project: ${plan.project}`);
  console.log(`Source: ${plan.sourcePath}`);
  console.log(`Size: ${plan.sizeBytes} bytes`);
  console.log(`SHA-256: ${plan.sha256}`);
  console.log(`Content secret scan: ${plan.contentScanned ? "passed" : "binary; path and extension guards only"}`);
  console.log(`Bucket: ${plan.bucket || "not configured"}`);
  console.log(`Object: ${plan.objectKey}`);
  console.log(`Cost cap: ${plan.costCap}`);
  console.log("Visibility: private; no public ACL is sent");

  if (!args.execute) {
    console.log("Dry-run only. Add --execute to publish; add --create-bucket only for the first upload.");
    process.exit(0);
  }

  const result = await publishArtifact({
    plan,
    config,
    createBucket: args.createBucket,
  });

  if (result.bucketCreated) console.log("Bucket: created");
  if (result.uploaded) console.log(`Upload: HTTP ${result.httpStatus}`);
  if (result.alreadyPresent) console.log("Upload: skipped; content-addressed object already exists");
  console.log("Cloud artifact publish: OK");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
