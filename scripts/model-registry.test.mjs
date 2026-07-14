import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const models = readFileSync(new URL("../lib/models.js", import.meta.url), "utf8");
assert.ok(models.includes('const KEY = "control/models.json"'), "model registry must be independent from rolling job history");
assert.ok(models.includes('job.preset_id !== "qwen-lora-v1"'), "only successful 7B training jobs may register models");
assert.ok(models.includes("artifact_key: job.result_key"), "registered model must retain its immutable Object Storage artifact");
assert.ok(models.includes("training_job_id: job.id"), "model must be traceable to training evidence");
const callback = readFileSync(new URL("../api/worker-callback.js", import.meta.url), "utf8");
assert.ok(callback.includes("registerModel(job)"), "completed training callback must register the model");
const api = readFileSync(new URL("../api/models.js", import.meta.url), "utf8");
assert.ok(api.includes("isAuthorized") && api.includes("listModels"), "model listing must be authenticated and durable");
console.log("Model registry contract tests OK");
