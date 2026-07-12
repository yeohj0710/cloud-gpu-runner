import { updateJob, validJobToken } from "../lib/jobs.js";
import { listObjects } from "../lib/ncp-storage.js";
import { addUsage, startStorage, STORAGE } from "../lib/usage.js";
import { deleteEphemeralInstance } from "../lib/kakao-resources.js";

const terminal = (status) => status === "completed" || status === "failed";

async function recordTerminalUsage(job, status) {
  const seconds = Math.max(1, (Date.now() - new Date(job.billing_started_at || job.created_at).getTime()) / 1000);
  const hours = seconds / 3600;
  const gpu = (Number(job.hourly_rate) || 0) * hours;
  const disk = (Number(job.volume_gb) || 0) * 0.16 * hours, publicIp = job.public_ip_id ? 5.5 * hours : 0;
  const amount = gpu + disk + publicIp;
  await addUsage({ provider: "kakao", category: "gpu", action: status, label: `${job.flavor_name || "GPU"} · ${job.key}`, amount, meta: { job_id: job.id, seconds, hourly_rate: job.hourly_rate, volume_gb: job.volume_gb, gpu, disk, public_ip: publicIp, status } });
  job = await updateJob(job.id, { usage_amount: amount, usage_gpu_amount: gpu, usage_disk_amount: disk, usage_public_ip_amount: publicIp, usage_seconds: seconds, usage_recorded_at: new Date().toISOString() });
  try {
    const objects = await listObjects(job.bucket);
    for (const key of [job.result_key, job.log_key]) {
      const object = objects.find((item) => item.key === key);
      if (object) await startStorage("naver", job.bucket, key, object.size);
    }
    const inputGets = job.data_key ? 2 : 1;
    await addUsage({ provider: "naver", category: "storage_request", action: "gpu-input-download", label: job.key, amount: inputGets * STORAGE.naver.get, meta: { job_id: job.id, requests: inputGets } });
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
    let job = await updateJob(id, { status, error: String(request.body?.error || "").slice(0, 500) || undefined, completed_at: status === "completed" ? new Date().toISOString() : undefined });
    if (terminal(status) && !job.usage_recorded_at) {
      try { job = await recordTerminalUsage(job, status); }
      catch (error) { job = await updateJob(id, { usage_error: String(error.message).slice(0, 300) }); }
    }
    if (terminal(status) && job.instance_id) {
      try {
        const cleanup = await deleteEphemeralInstance(job);
        job = await updateJob(id, { instance_deleted_at: new Date().toISOString(), public_ip_removed_at: cleanup.publicIpRemoved ? new Date().toISOString() : undefined });
      } catch (error) {
        job = await updateJob(id, { cleanup_error: String(error.message).slice(0, 300) });
      }
    }
    return response.json({ ok: true, job });
  } catch (error) {
    return response.status(404).json({ error: error.message });
  }
}
