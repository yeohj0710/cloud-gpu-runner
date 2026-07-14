import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "public-dashboard.js"), "utf8");
const jsPath = path.join(root, "public", "home-playground.js");

assert.match(html, /id="ai-playground"/);
assert.doesNotMatch(html, />\s*관리자(?: 페이지)?\s*</);
assert.ok(fs.existsSync(jsPath));
const js = fs.readFileSync(jsPath, "utf8");
assert.match(js, /\/api\/login/);
assert.match(js, /requestPassword/);
assert.match(js, /\/api\/models/);
assert.match(api, /listModels/);
assert.match(api, /models/);
assert.doesNotMatch(api, /artifact_key:\s*model\.artifact_key|bucket:\s*model\.bucket/);

console.log("homepage playground contract tests passed");
