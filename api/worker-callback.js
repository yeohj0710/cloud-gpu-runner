import { updateJob, validJobToken } from "../lib/jobs.js";
import { listObjects } from "../lib/ncp-storage.js";
import { addUsage, startStorage, STORAGE } from "../lib/usage.js";
import { deleteGpuResources, gpuCost } from "../lib/gpu-resources.js";

const terminal = (status) => status === "completed" || status === "failed";

export async function recordTerminalUsage(job, status) {
  const { seconds, gpu, disk, publicIp, amount } = gpuCost(job);
  await addUsage({ provider: job.provider || "kakao", category: "gpu", action: status, label: `${job.flavor_name || "GPU"} · ${job.key}`, amount, meta: { job_id: job.id, seconds, hourly_rate: job.hourly_rate, volume_gb: job.volume_gb, gpu, disk, public_ip: publicIp, status } });
  job = await updateJob(job.id, { usage_amount: amount, usage_gpu_amount: gpu, usage_disk_amount: disk, usage_public_ip_amount: publicIp, usage_seconds: seconds, usage_recorded_at: new Date().toISOString() });
  try {
    const objects = await listObjects(job.bucket);
    let artifactCount = 0;
    for (const key of [job.result_key, job.log_key]) {
      const object = objects.find((item) => item.key === key);
      if (object) { await startStorage("naver", job.bucket, key, object.size); artifactCount += 1; }
    }
    const inputGets = job.data_key ? 2 : 1;
    await addUsage({ provider: "naver", category: "storage_request", action: "gpu-input-download", label: job.key, amount: inputGets * STORAGE.naver.get, meta: { job_id: job.id, requests: inputGets } });
    if (artifactCount === 2) job = await updateJob(job.id, { artifacts_ready: true });
  } catch (error) {
    job = await updateJob(job.id, { storage_usage_error: String(error.message).slice(0, 300) });
  }
  return job;
}

export default async function handler(request, response) {
  const id = String(request.query?.id || ""), token = String(request.query?.token || "");
  if (request.method !== "POST" || !validJobToken(id, token)) return response.status(401).json({ error: "unauthorized" });
  try {
    const status = ["running", "completed", "failed"].includes(request.body?.status) ? request.body.status : "failed";
    let job = await updateJob(id, { status, stage: String(request.body?.stage || "").slice(0, 80) || undefined, error: String(request.body?.error || "").slice(0, 500) || undefined, completed_at: status === "completed" ? new Date().toISOString() : undefined });
    if (terminal(status) && job.instance_id) {
      try {
        const cleanup = await deleteGpuResources(job);
        job = await updateJob(id, { instance_deleted_at: new Date().toISOString(), public_ip_removed_at: cleanup.publicIpRemoved ? new Date().toISOString() : undefined });
      } catch (error) {
        job = await updateJob(id, { cleanup_error: String(error.message).slice(0, 300) });
      }
    }
    if (terminal(status) && !job.usage_recorded_at && job.instance_deleted_at) {
      try { job = await recordTerminalUsage(job, status); }
      catch (error) { job = await updateJob(id, { usage_error: String(error.message).slice(0, 300) }); }
    }
    return response.json({ ok: true, job });
  } catch (error) {
    return response.status(404).json({ error: error.message });
  }
}
