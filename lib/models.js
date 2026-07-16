import { readJson, writeJson } from "./control-store.js";
import { getPlaygroundPreset, sanitizeModelMetadata } from "./playground-presets.js";

const KEY = "control/models.json";

export async function listModels() {
  return (await readJson(KEY, { version: 2, models: [] })).models || [];
}

export async function registerModel(job, { allowPartial = false } = {}) {
  const preset = getPlaygroundPreset(job.preset_id);
  const metadata = sanitizeModelMetadata(job.model_metadata);
  const checkpoints = metadata?.checkpoint_steps || [];
  const completed = job.status === "completed";
  const trainingCompleted = completed || metadata?.training_state === "completed";
  const recoverable = allowPartial && preset?.kind === "image" && checkpoints.length > 0;
  if (!preset || job.task_mode !== "training" || !job.result_key || (!completed && !recoverable)) return null;

  const models = await listModels();
  const existing = models.find((model) => model.training_job_id === job.id);
  if (existing) {
    const index = models.indexOf(existing);
    const refreshed = {
      ...existing,
      runtime_seconds: job.usage_seconds ?? existing.runtime_seconds,
      cost_krw: job.usage_amount ?? existing.cost_krw,
      training_state: trainingCompleted ? "completed" : existing.training_state,
      checkpoints: checkpoints.length ? checkpoints : existing.checkpoints,
      training: metadata || existing.training,
      preview_key: completed ? job.preview_key : existing.preview_key,
    };
    models[index] = refreshed;
    await writeJson(KEY, { version: 2, models });
    return refreshed;
  }
  const version = models.filter((item) => item.preset_id === preset.id).length + 1;
  const rank = metadata?.lora_rank || (preset.kind === "image" ? 16 : 32);
  const model = {
    id: `${preset.modelPrefix}-${job.id}`,
    name: preset.name,
    version,
    preset_id: preset.id,
    kind: preset.kind,
    base_model: metadata?.base_model || preset.baseModel,
    method: `${metadata?.method || preset.defaultMethod} r=${rank}`,
    dataset: preset.kind === "image" ? `${metadata?.image_count || 0} images · 1024px` : preset.defaultDataset,
    bucket: job.bucket,
    artifact_key: job.result_key,
    preview_key: completed ? job.preview_key : undefined,
    manifest_key: job.manifest_key,
    training_job_id: job.id,
    parent_model_id: job.source_model_id || undefined,
    provider: job.provider,
    gpu: job.flavor_name,
    runtime_seconds: job.usage_seconds,
    cost_krw: job.usage_amount,
    training_state: trainingCompleted ? "completed" : "interrupted",
    checkpoints,
    training: metadata,
    created_at: job.completed_at || job.cancelled_at || new Date().toISOString(),
  };
  await writeJson(KEY, { version: 2, models: [...models, model] });
  return model;
}

export async function getModel(id) {
  return (await listModels()).find((model) => model.id === String(id || ""));
}
