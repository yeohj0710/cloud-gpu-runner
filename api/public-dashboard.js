import { listJobs } from "../lib/jobs.js";
import { CREDIT_EXPIRY, CREDIT_GRANTS, usageSummary } from "../lib/usage.js";
import { ncp } from "../lib/ncp-cloud.js";
import { listModels } from "../lib/models.js";
import { findActivePlaygroundJob } from "../lib/playground-presets.js";

function kind(command = "") {
  if (/smoke\.py/i.test(command)) return "GPU 연결 점검";
  if (/train/i.test(command)) return "모델 학습";
  if (/infer|predict/i.test(command)) return "대량 추론";
  return "GPU 작업";
}

function playgroundErrorCode(error = "") {
  if (/exit 127|pip: command not found/i.test(error)) return "runtime_setup_failed";
  if (/quota|creation limit|3005004/i.test(error)) return "gpu_quota_unavailable";
  if (/kakao_gpu_unavailable/i.test(error)) return "gpu_capacity_unavailable";
  return error ? "worker_failed" : null;
}

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "method_not_allowed" });
  try {
    const summary = await usageSummary();
    const month = new Date().toISOString().slice(0, 7).replace("-", "");
    let actualNaver = 0;
    try {
      const billing = await ncp(`/billing/v1/cost/getContractDemandCostList?startMonth=${month}&endMonth=${month}&responseFormatType=json&pageSize=100`, process.env.NCP_BILLING_API_ENDPOINT);
      actualNaver = (billing.getContractDemandCostListResponse?.contractDemandCostList || []).reduce((sum, item) => sum + Number(item.demandAmount || 0), 0);
    } catch {}
    const totals = { ...summary.totals, naver: Math.max(actualNaver, summary.totals.naver) };
    const remaining = { naver: summary.credits.naver - totals.naver, kakao: summary.credits.kakao - totals.kakao };
    const allJobs = (await listJobs()).slice().reverse();
    const publicPlaygroundJob = (job) => job ? {
      preset_id: job.preset_id, status: job.status, task_mode: job.task_mode, stage: job.stage,
      provider: job.provider, flavor_name: job.flavor_name,
      usage_amount: job.usage_amount == null ? null : Number(job.usage_amount),
      checkpoint_steps: job.model_metadata?.checkpoint_steps || [], latest_checkpoint_step: Number(job.model_metadata?.latest_checkpoint_step || 0),
      error_code: playgroundErrorCode(job.error), created_at: job.created_at, updated_at: job.updated_at,
    } : null;
    const playground_jobs = Object.fromEntries(["sdxl-lora-v1", "qwen-lora-v1"].map((presetId) => [presetId, publicPlaygroundJob(findActivePlaygroundJob(allJobs, presetId))]));
    const playground_job = playground_jobs["qwen-lora-v1"];
    const jobs = allJobs.filter((job) => job.type === "custom-gpu" || job.instance_id || job.usage_amount).slice(0, 20).map((job) => ({
      kind: kind(job.command), provider: job.provider, status: job.status,
      usage_seconds: Number(job.usage_seconds || 0), usage_amount: job.usage_amount == null ? null : Number(job.usage_amount),
      cleanup_verified: !job.instance_id || Boolean(job.instance_deleted_at && (!job.public_ip_id || job.public_ip_removed_at)),
      created_at: job.started_at || job.created_at,
    }));
    const events = (summary.events || []).filter((event) => event.category === "gpu" || Number(event.amount) >= 0.5).slice(0, 15).map((event) => ({
      provider: event.provider, category: event.category === "gpu" ? "GPU 실행" : "인프라 사용",
      amount: Number(event.amount || 0), created_at: event.created_at,
    }));
    let registeredModels = [];
    try { registeredModels = await listModels(); } catch {}
    const models = registeredModels.slice().reverse().map((model) => ({
      id: model.id, name: model.name, version: model.version, base_model: model.base_model,
      preset_id: model.preset_id, kind: model.kind || (model.preset_id === "sdxl-lora-v1" ? "image" : "text"), method: model.method, dataset: model.dataset, provider: model.provider, gpu: model.gpu,
      runtime_seconds: Number(model.runtime_seconds || 0), cost_krw: model.cost_krw == null ? null : Number(model.cost_krw),
      training_state: model.training_state || "completed", parent_model_id: model.parent_model_id, checkpoints: model.checkpoints || [],
      training: model.training ? { demo_id: model.training.demo_id || (model.training.dataset === "Hugging Face Diffusers dog example" ? "dog" : undefined), samples: model.training.samples, steps: model.training.steps, steps_added: model.training.steps_added, image_count: model.training.image_count, train_loss: model.training.train_loss, peak_vram_gb: model.training.peak_vram_gb } : undefined,
      created_at: model.created_at,
    }));
    response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return response.json({ ok: true, credits: summary.credits, totals, remaining, categories: summary.categories, expiry: CREDIT_EXPIRY, credit_grants: CREDIT_GRANTS, jobs, events, models, playground_job, playground_jobs, updated_at: new Date().toISOString() });
  } catch (error) { console.error("public-dashboard", error); return response.status(502).json({ error: "dashboard_unavailable" }); }
}
