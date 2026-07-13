import assert from "node:assert/strict";
import { validateCustomJob } from "../lib/jobs.js";
import { customWorkerScript } from "../api/cloud.js";
import { estimateGpu, estimateProviderGpu } from "../lib/usage.js";

process.env.SESSION_SECRET ||= "test-session-secret";
process.env.NCP_OBJECT_STORAGE_ACCESS_KEY_ID ||= "test-access";
process.env.NCP_OBJECT_STORAGE_SECRET_KEY ||= "test-secret";

const input = {
  code_key: "gpu-workbench/code.zip",
  data_key: "gpu-workbench/data.csv",
  command: "python train.py",
  output_path: "outputs",
};
assert.equal(validateCustomJob(input).command, "python train.py");
assert.equal(validateCustomJob({ ...input, provider: "naver" }).provider, "naver");
assert.equal(validateCustomJob({ ...input, provider: "invalid" }).provider, "auto");
assert.throws(() => validateCustomJob({ ...input, output_path: "../escape" }), /unsafe_output_path/);
assert.throws(() => validateCustomJob({ ...input, command: "python train.py\nrm -rf /" }), /unsafe_command/);

const script = customWorkerScript({
  id: "job-1", bucket: "bucket", ...input,
  result_key: "results/a.tar.gz", log_key: "logs/a.txt", max_minutes: 60,
});
assert.ok(script.includes("https://work-memory-ten.vercel.app/api/worker-callback"), "worker callback must use the current protected production origin");
for (const expected of ["timeout 60m", "CGR_DATA_DIR", "CGR_DATA_FILE", "shutdown -h now", "finish completed", "output directory is empty", "trap - ERR", "WORKDIR=/workspace", "execution timeout", "progress code_download", "progress command", "network activation timeout", "seq 1 150"]) {
  assert.ok(script.includes(expected), `worker script missing ${expected}`);
}
assert.ok(!script.includes("tar -czf /tmp/result.tar.gz -C /workspace ."), "worker must never archive the entire workspace as fallback");
assert.ok(!script.includes("apt-get"), "worker bootstrap must not reinstall the operating system package set for every job");
assert.ok(script.includes("--data-binary @-"), "callbacks must send JSON through stdin without broken nested shell quotes");
assert.ok(!script.includes('-d "{"status"'), "worker must not generate syntactically broken nested JSON quotes");
assert.ok(Buffer.byteLength(script, "utf8") < 16 * 1024, "cloud-init must stay below Kakao's 16KB user_data limit");
const longScript = customWorkerScript({ id: "job-2", bucket: "bucket", ...input, result_key: "results/b.tar.gz", log_key: "logs/b.txt", max_minutes: 1440 });
assert.ok(longScript.includes("X-Amz-Expires=93600"), "24-hour work must keep artifact URLs valid through runtime plus cleanup buffer");
const estimate = estimateGpu("gn1i.xlarge", 60, 80);
assert.equal(estimate.gpu, 648);
assert.equal(estimate.disk, 12.8);
assert.equal(estimate.public_ip, 5.5);
assert.ok(Math.abs(estimate.total - 666.3098) < 0.0001, "estimate must include GPU, disk, public IP and four storage requests");
const naverEstimate = estimateProviderGpu("naver", "gp1l4-g3", 60, 80);
assert.equal(naverEstimate.gpu, 1447);
assert.ok(Math.abs(naverEstimate.disk - 11.2) < 0.000001);
assert.equal(naverEstimate.public_ip, 5.6);
assert.ok(Math.abs(naverEstimate.total - 1463.8098) < 0.0001, "NAVER estimate must include L4, block storage, public IP and object requests");
console.log("GPU workbench contract tests OK");
