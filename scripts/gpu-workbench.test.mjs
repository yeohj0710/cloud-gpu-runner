import assert from "node:assert/strict";
import { validateCustomJob } from "../lib/jobs.js";
import { customWorkerScript } from "../api/cloud.js";
import { estimateGpu } from "../lib/usage.js";

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
assert.throws(() => validateCustomJob({ ...input, output_path: "../escape" }), /unsafe_output_path/);
assert.throws(() => validateCustomJob({ ...input, command: "python train.py\nrm -rf /" }), /unsafe_command/);

const script = customWorkerScript({
  id: "job-1", bucket: "bucket", ...input,
  result_key: "results/a.tar.gz", log_key: "logs/a.txt", max_minutes: 60,
});
for (const expected of ["timeout 60m", "CCL_DATA_DIR", "CCL_DATA_FILE", "shutdown -h now", "finish completed", "output directory is empty", "trap - ERR", "WORKDIR=/workspace", "execution timeout", "progress code_download", "progress command"]) {
  assert.ok(script.includes(expected), `worker script missing ${expected}`);
}
assert.ok(!script.includes("tar -czf /tmp/result.tar.gz -C /workspace ."), "worker must never archive the entire workspace as fallback");
assert.ok(!script.includes("apt-get"), "worker bootstrap must not reinstall the operating system package set for every job");
assert.ok(Buffer.byteLength(script, "utf8") < 16 * 1024, "cloud-init must stay below Kakao's 16KB user_data limit");
const estimate = estimateGpu("gn1i.xlarge", 60, 80);
assert.equal(estimate.gpu, 648);
assert.equal(estimate.disk, 12.8);
assert.equal(estimate.public_ip, 5.5);
assert.ok(Math.abs(estimate.total - 666.3098) < 0.0001, "estimate must include GPU, disk, public IP and four storage requests");
console.log("GPU workbench contract tests OK");
