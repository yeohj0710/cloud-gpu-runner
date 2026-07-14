import { readJson, writeJson } from "./control-store.js";

const KEY = "control/models.json";

export async function listModels() {
  return (await readJson(KEY, { version: 1, models: [] })).models || [];
}

export async function registerModel(job) {
  if (job.status !== "completed" || job.task_mode !== "training" || job.preset_id !== "qwen-lora-v1" || !job.result_key) return null;
  const models = await listModels();
  const existing = models.find((model) => model.training_job_id === job.id);
  if (existing) return existing;
  const model = {
    id: `qwen-lora-${job.id}`,
    name: "한국어 지시 수행 모델",
    version: models.filter((item) => item.preset_id === "qwen-lora-v1").length + 1,
    preset_id: "qwen-lora-v1",
    base_model: "Qwen/Qwen2.5-7B-Instruct",
    method: `${job.model_metadata?.method || "BF16 LoRA"} r=32`,
    dataset: "beomi/KoAlpaca-v1.1a · 2,048 samples",
    bucket: job.bucket,
    artifact_key: job.result_key,
    training_job_id: job.id,
    provider: job.provider,
    gpu: job.flavor_name,
    runtime_seconds: job.usage_seconds,
    cost_krw: job.usage_amount,
    training: job.model_metadata || undefined,
    created_at: job.completed_at || new Date().toISOString(),
  };
  await writeJson(KEY, { version: 1, models: [...models, model] });
  return model;
}

export async function getModel(id) {
  return (await listModels()).find((model) => model.id === String(id || ""));
}
