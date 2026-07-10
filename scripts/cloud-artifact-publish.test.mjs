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
  providerConfig,
  verifyPublishedArtifact,
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

test("providerConfig uses the canonical Kakao artifact bucket variable", () => {
  const config = providerConfig("kakao", {
    KAKAO_CLOUD_ARTIFACT_BUCKET: "kakao-private-artifacts",
  });

  assert.equal(config.bucket, "kakao-private-artifacts");
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

test("verifyPublishedArtifact proves a remote object matches its expected SHA-256", async () => {
  const body = Buffer.from('{"restored":true}', "utf8");
  const expectedSha256 = "6ec078c7b2b2f90728687b1588887a92cbafd6df49fcefa71719804506ed9204";

  const result = await verifyPublishedArtifact({
    config: {
      endpoint: "https://object.example.com",
      region: "kr-standard",
      accessKey: "test-access",
      secretKey: "test-secret",
    },
    bucket: "private-artifacts",
    objectKey: "projects/cloud-credit-lab/2026-07-10/6ec078c7b2b2-report.json",
    expectedSha256,
    maxBytes: 1024,
    fetchImpl: async () => ({
      status: 200,
      headers: new Headers({ "content-length": String(body.length) }),
      arrayBuffer: async () => body,
    }),
  });

  assert.deepEqual(result, {
    verified: true,
    httpStatus: 200,
    sizeBytes: body.length,
    sha256: expectedSha256,
  });
});

test("verifyPublishedArtifact rejects hash mismatches and oversized downloads", async () => {
  const body = Buffer.from("unexpected", "utf8");
  const base = {
    config: {
      endpoint: "https://object.example.com",
      region: "kr-standard",
      accessKey: "test-access",
      secretKey: "test-secret",
    },
    bucket: "private-artifacts",
    objectKey: "projects/cloud-credit-lab/2026-07-10/expected-report.json",
    expectedSha256: "a".repeat(64),
  };

  await assert.rejects(
    verifyPublishedArtifact({
      ...base,
      maxBytes: 1024,
      fetchImpl: async () => ({
        status: 200,
        headers: new Headers({ "content-length": String(body.length) }),
        arrayBuffer: async () => body,
      }),
    }),
    /SHA-256 mismatch/,
  );

  await assert.rejects(
    verifyPublishedArtifact({
      ...base,
      maxBytes: 4,
      fetchImpl: async () => ({
        status: 200,
        headers: new Headers({ "content-length": String(body.length) }),
        arrayBuffer: async () => body,
      }),
    }),
    /exceeds the restore limit/,
  );

  const streamingResponse = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from("123"));
        controller.enqueue(Buffer.from("456"));
        controller.close();
      },
    }),
    { status: 200 },
  );

  await assert.rejects(
    verifyPublishedArtifact({
      ...base,
      maxBytes: 4,
      fetchImpl: async () => streamingResponse,
    }),
    /exceeds the restore limit/,
  );
});
