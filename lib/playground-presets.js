export const PLAYGROUND_PRESETS = Object.freeze({
  "qwen-lora-v1": Object.freeze({
    id: "qwen-lora-v1",
    kind: "text",
    modelPrefix: "qwen-lora",
    name: "한국어 지시 수행 모델",
    baseModel: "Qwen/Qwen2.5-7B-Instruct",
    defaultMethod: "BF16 LoRA",
    defaultDataset: "beomi/KoAlpaca-v1.1a · 2,048 samples",
  }),
  "sdxl-lora-v1": Object.freeze({
    id: "sdxl-lora-v1",
    kind: "image",
    modelPrefix: "sdxl-lora",
    name: "나만의 이미지 LoRA",
    baseModel: "stabilityai/stable-diffusion-xl-base-1.0",
    defaultMethod: "BF16 DreamBooth LoRA",
    defaultDataset: "사용자 이미지",
  }),
});

export function getPlaygroundPreset(id) {
  return PLAYGROUND_PRESETS[String(id || "")] || null;
}

const ACTIVE_PLAYGROUND_STATUSES = new Set(["queued", "provisioning", "running"]);

export function findActivePlaygroundJob(jobs, presetId) {
  return (Array.isArray(jobs) ? jobs : []).find((job) => job?.preset_id === presetId && ACTIVE_PLAYGROUND_STATUSES.has(job?.status)) || null;
}

const cleanText = (value, limit) => String(value || "").trim().slice(0, limit) || undefined;
const cleanNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : undefined;

export function sanitizeModelMetadata(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const checkpointSteps = Array.isArray(raw.checkpoint_steps)
    ? [...new Set(raw.checkpoint_steps.map(Number).filter((value) => Number.isInteger(value) && value > 0 && value <= 100000))].sort((a, b) => a - b).slice(-40)
    : [];
  const trainingState = ["training", "completed", "interrupted"].includes(raw.training_state) ? raw.training_state : undefined;
  return {
    base_model: cleanText(raw.base_model, 120), dataset: cleanText(raw.dataset, 120),
    demo_id: raw.demo_id === "dog" ? "dog" : undefined,
    samples: cleanNumber(raw.samples) || 0, steps: cleanNumber(raw.steps) || 0,
    steps_added: cleanNumber(raw.steps_added) || 0, sequence_length: cleanNumber(raw.sequence_length) || 0,
    method: cleanText(raw.method, 100), lora_rank: cleanNumber(raw.lora_rank) || 0,
    train_loss: cleanNumber(raw.train_loss) || 0, perplexity: cleanNumber(raw.perplexity) || 0,
    seconds: cleanNumber(raw.seconds) || 0, gpu: cleanText(raw.gpu, 120),
    vram_gb: cleanNumber(raw.vram_gb) || 0, peak_vram_gb: cleanNumber(raw.peak_vram_gb) || 0,
    image_count: cleanNumber(raw.image_count) || 0, resolution: cleanNumber(raw.resolution) || 0,
    seed: cleanNumber(raw.seed) || 0, trigger_word: cleanText(raw.trigger_word, 40),
    instance_prompt: cleanText(raw.instance_prompt, 300), validation_prompt: cleanText(raw.validation_prompt, 500),
    checkpoint_steps: checkpointSteps, latest_checkpoint_step: checkpointSteps.at(-1) || cleanNumber(raw.latest_checkpoint_step) || 0,
    training_state: trainingState, snapshot_at: cleanText(raw.snapshot_at, 40),
  };
}
