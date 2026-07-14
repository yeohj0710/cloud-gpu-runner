import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agent = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
const entrypoint = fs.readFileSync(path.join(root, "scripts", "cloud-gpu.ps1"), "utf8");
const submit = fs.readFileSync(path.join(root, "scripts", "Submit-GpuJob.ps1"), "utf8");

assert.match(agent, /any project|another repository/i);
assert.match(agent, /NAVER.*Kakao/is);
assert.match(agent, /2,000 KRW/);
assert.match(agent, /cleanup/i);
assert.match(entrypoint, /MaxEstimatedCostKRW = 2000/);
assert.match(entrypoint, /Submit-GpuJob\.ps1/);
assert.doesNotMatch(entrypoint, /wellnessbox/i);
assert.match(submit, /exceeds hard limit/);
assert.match(submit, /action=cancel/);
assert.match(submit, /result\.tar\.gz/);
assert.match(submit, /instance_deleted_at/);
assert.match(submit, /Join-Path \$root '\.env\.local'/);
assert.match(submit, /--exclude='\.env\.\*'/);
assert.match(submit, /--exclude='\*credentials\*'/);
console.log("agent entrypoint contract tests passed");
