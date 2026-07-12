import assert from "node:assert/strict";
import { validateCustomJob } from "../lib/jobs.js";
import { customWorkerScript } from "../api/cloud.js";

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
for (const expected of ["timeout 60m", "CCL_DATA_DIR", "shutdown -h now", "finish completed"]) {
  assert.ok(script.includes(expected), `worker script missing ${expected}`);
}
console.log("GPU workbench contract tests OK");
