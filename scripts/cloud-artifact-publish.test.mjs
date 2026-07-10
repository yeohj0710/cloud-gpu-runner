import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertPublishableSource,
  buildObjectKey,
  createPublishPlan,
  parseArgs,
} from "./lib/artifact-publish.mjs";

test("buildObjectKey creates a dated, content-addressed project key", () => {
  assert.equal(
    buildObjectKey({
      project: "wellnessbox-rnd",
      digest: "abcdef1234567890",
      filename: "eval result.json",
      date: "2026-07-10",
    }),
    "projects/wellnessbox-rnd/2026-07-10/abcdef123456-eval-result.json",
  );
});

test("buildObjectKey supports a non-Latin filename without exposing it", () => {
  assert.equal(
    buildObjectKey({
      project: "wellnessbox-rnd",
      digest: "abcdef1234567890",
      filename: "평가결과.json",
      date: "2026-07-10",
    }),
    "projects/wellnessbox-rnd/2026-07-10/abcdef123456-artifact.json",
  );
});

test("assertPublishableSource rejects paths outside C:\\dev", () => {
  assert.throws(
    () => assertPublishableSource("C:\\Users\\example\\report.json", "C:\\dev"),
    /inside C:\\dev/i,
  );
});

test("assertPublishableSource rejects secret and runtime database paths", () => {
  for (const candidate of [
    "C:\\dev\\app\\.env.local",
    "C:\\dev\\app\\oauth-client-secret.json",
    "C:\\dev\\app\\.n8n\\database.sqlite",
    "C:\\dev\\app\\private-key.pem",
  ]) {
    assert.throws(() => assertPublishableSource(candidate, "C:\\dev"), /sensitive/i);
  }
});

test("parseArgs keeps uploads in dry-run mode by default", () => {
  assert.deepEqual(
    parseArgs([
      "--provider",
      "naver",
      "--project",
      "cloud-credit-lab",
      "--source",
      "apps/dashboard/src/data/credit-portfolio.json",
    ]),
    {
      provider: "naver",
      project: "cloud-credit-lab",
      source: "apps/dashboard/src/data/credit-portfolio.json",
      execute: false,
      createBucket: false,
    },
  );
});

test("createPublishPlan calculates a digest without exposing credentials", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "artifact-plan-"));
  const devRoot = path.join(tempDir, "dev");
  const source = path.join(devRoot, "cloud-credit-lab", "report.json");

  await mkdir(path.dirname(source), { recursive: true });
  await writeFile(source, '{"ok":true}', "utf8");

  const plan = await createPublishPlan({
    provider: "naver",
    project: "cloud-credit-lab",
    source,
    devRoot,
    bucket: "private-artifacts",
    maxBytes: 1024,
    now: new Date("2026-07-10T00:00:00Z"),
  });

  assert.equal(plan.provider, "naver");
  assert.equal(plan.bucket, "private-artifacts");
  assert.equal(plan.sizeBytes, 11);
  assert.equal(plan.contentScanned, true);
  assert.match(plan.sha256, /^[a-f0-9]{64}$/);
  assert.match(plan.objectKey, /^projects\/cloud-credit-lab\/2026-07-10\/[a-f0-9]{12}-report\.json$/);
  assert.equal(JSON.stringify(plan).includes("secret"), false);
});

test("createPublishPlan rejects embedded secret assignments", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "artifact-secret-"));
  const devRoot = path.join(tempDir, "dev");
  const source = path.join(devRoot, "cloud-credit-lab", "report.json");
  const sensitiveLine = ["DASHBOARD_RUN", "_TOKEN=abcdefghijklmnop"].join("");

  await mkdir(path.dirname(source), { recursive: true });
  await writeFile(source, sensitiveLine, "utf8");

  await assert.rejects(
    createPublishPlan({
      provider: "naver",
      project: "cloud-credit-lab",
      source,
      devRoot,
      bucket: "private-artifacts",
    }),
    /looks sensitive/i,
  );
});
