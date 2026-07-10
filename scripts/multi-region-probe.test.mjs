import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createProbeAction, validateTargets } = require(
  "../cloud-functions/multi-region-probe/index.js",
);

test("reports status and latency without storing URLs or response bodies", async () => {
  let tick = 1_000;
  const action = createProbeAction({
    fetchImpl: async () => ({ status: 200, ok: true, text: async () => "private body" }),
    now: () => new Date("2026-07-10T00:00:00.000Z"),
    nowMs: () => {
      tick += 7;
      return tick;
    },
  });

  const result = await action({
    region: "KR",
    targets: [{ id: "dashboard", url: "https://example.com/health" }],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.results, [
    { id: "dashboard", ok: true, status: 200, latencyMs: 7 },
  ]);
  assert.equal(JSON.stringify(result).includes("example.com"), false);
  assert.equal(JSON.stringify(result).includes("private body"), false);
});

test("isolates one failed endpoint instead of failing the whole activation", async () => {
  const action = createProbeAction({
    fetchImpl: async (url) => {
      if (url.includes("down")) throw new Error("network unavailable");
      return { status: 204, ok: true };
    },
    now: () => new Date("2026-07-10T00:00:00.000Z"),
    nowMs: () => 1,
  });

  const result = await action({
    region: "SGN",
    targets: [
      { id: "up", url: "https://up.example.com/health", expectedStatus: 204 },
      { id: "down", url: "https://down.example.com/health" },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.results[0].ok, true);
  assert.deepEqual(result.results[1], {
    id: "down",
    ok: false,
    status: null,
    latencyMs: 0,
    error: "request_failed",
  });
});

test("accepts HTTPS targets only and caps the activation size", () => {
  assert.throws(
    () => validateTargets([{ id: "local", url: "http://localhost:3000" }]),
    /HTTPS/,
  );
  assert.throws(
    () =>
      validateTargets(
        Array.from({ length: 21 }, (_, index) => ({
          id: `target-${index}`,
          url: `https://example.com/${index}`,
        })),
      ),
    /20 targets/,
  );
  for (const url of [
    "https://localhost/health",
    "https://127.0.0.1/health",
    "https://169.254.169.254/latest/meta-data",
    "https://10.0.0.1/health",
    "https://example.com/health?token=secret",
  ]) {
    assert.throws(
      () => validateTargets([{ id: "blocked", url }]),
      /public HTTPS|query strings/,
    );
  }
});

test("bound deployment targets cannot be overridden by runtime parameters", async () => {
  const requested = [];
  const action = createProbeAction({
    boundTargets: [{ id: "bound", url: "https://bound.example.com/health" }],
    boundTimeoutMs: 1000,
    fetchImpl: async (url) => {
      requested.push(url);
      return { status: 200, ok: true };
    },
    now: () => new Date("2026-07-10T00:00:00.000Z"),
    nowMs: () => 1,
  });

  const result = await action({
    region: "KR",
    targets: [{ id: "attacker", url: "https://attacker.example.com" }],
    timeoutMs: 9999,
  });

  assert.deepEqual(requested, ["https://bound.example.com/health"]);
  assert.equal(result.results[0].id, "bound");
});

test("marks an unexpected status as a failed probe", async () => {
  const action = createProbeAction({
    fetchImpl: async () => ({ status: 503, ok: false }),
    now: () => new Date("2026-07-10T00:00:00.000Z"),
    nowMs: () => 5,
  });

  const result = await action({
    region: "JPN",
    targets: [{ id: "api", url: "https://example.com/health", expectedStatus: 200 }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.results[0].status, 503);
});
