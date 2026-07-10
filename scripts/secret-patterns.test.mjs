import assert from "node:assert/strict";
import test from "node:test";

import { findSecretMatches } from "./lib/secret-patterns.mjs";

function assignment(name, value) {
  return `${name}=${value}`;
}

test("detects Kakao S3 credentials and dashboard run tokens", () => {
  assert.deepEqual(findSecretMatches(assignment("KAKAO_CLOUD_S3_ACCESS_KEY", "abcdefghijklmnop")), [
    "Kakao cloud secret assignment",
  ]);
  assert.deepEqual(findSecretMatches(assignment("KAKAO_CLOUD_S3_SECRET_KEY", "abcdefghijklmnop")), [
    "Kakao cloud secret assignment",
  ]);
  assert.deepEqual(findSecretMatches(assignment("DASHBOARD_RUN_TOKEN", "abcdefghijklmnop")), [
    "dashboard run token assignment",
  ]);
});

test("allows empty examples and placeholders", () => {
  assert.deepEqual(findSecretMatches(assignment("KAKAO_CLOUD_S3_SECRET_KEY", "")), []);
  assert.deepEqual(findSecretMatches(assignment("DASHBOARD_RUN_TOKEN", "<set-me>")), []);
});

test("detects embedded private-key and bearer-token material", () => {
  const privateKeyMarker = ["-----BEGIN PRIVATE", " KEY-----"].join("");
  assert.ok(findSecretMatches(privateKeyMarker).includes("private key block"));
  assert.ok(
    findSecretMatches(`Authorization: Bearer ${"a".repeat(32)}`).includes(
      "authorization bearer token",
    ),
  );
});

test("detects registry-scoped npm tokens", () => {
  const npmrcLine = ["//registry.npmjs.org/:_auth", "Token=abcdefghijklmnop"].join("");
  assert.ok(findSecretMatches(npmrcLine).includes("npm auth token"));
});
