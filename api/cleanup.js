import { listJobs, updateJob } from "../lib/jobs.js";
import { addUsage } from "../lib/usage.js";
import { deleteGpuResources, gpuCost } from "../lib/gpu-resources.js";
import { recordTerminalUsage } from "./worker-callback.js";

export default async function handler(request, response) {
  if (request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: "unauthorized" });
  const now = Date.now(), cleaned = [], errors = [];
  for (const job of await listJobs()) {
    if (!job.instance_id || job.instance_deleted_at || (!['provisioning', 'running'].includes(job.status) && !job.cleanup_error)) continue;
    const max = (Number(job.max_minutes) || 60) + 20;
    const started = new Date(job.billing_started_at || job.created_at).getTime();
    if (!job.cleanup_error && now - started < max * 60000) continue;
    try {
      const cleanup = await deleteGpuResources(job);
      const { seconds, gpu, disk, publicIp, amount } = gpuCost(job, now);
      if (job.cleanup_error && ["completed", "failed"].includes(job.status)) {
        let cleanedJob = await updateJob(job.id, { cleanup_error: undefined, instance_deleted_at: new Date().toISOString(), public_ip_removed_at: cleanup.publicIpRemoved ? new Date().toISOString() : undefined });
        if (!cleanedJob.usage_recorded_at) cleanedJob = await recordTerminalUsage(cleanedJob, cleanedJob.status);
      } else {
        if (!job.usage_recorded_at) await addUsage({ provider: job.provider || "kakao", category: "gpu", action: "timeout", label: `${job.flavor_name || "GPU"} · ${job.key}`, amount, meta: { job_id: job.id, seconds, gpu, disk, public_ip: publicIp } });
        await updateJob(job.id, { status: "failed", error: `최대 실행시간 ${max - 20}분을 초과해 자동 종료했어요.`, instance_deleted_at: new Date().toISOString(), public_ip_removed_at: cleanup.publicIpRemoved ? new Date().toISOString() : undefined, usage_amount: amount, usage_gpu_amount: gpu, usage_disk_amount: disk, usage_public_ip_amount: publicIp, usage_seconds: seconds, usage_recorded_at: job.usage_recorded_at || new Date().toISOString() });
      }
      cleaned.push(job.id);
    } catch (error) {
      if (/404/.test(String(error.message))) {
        await updateJob(job.id, { status: "failed", error: "인스턴스가 사라져 작업을 종료했어요.", instance_deleted_at: new Date().toISOString() });
        cleaned.push(job.id);
      } else {
        await updateJob(job.id, { cleanup_error: String(error.message).slice(0, 300) });
        errors.push({ id: job.id, error: String(error.message).slice(0, 120) });
      }
    }
  }
  return response.json({ ok: true, checked_at: new Date().toISOString(), cleaned, errors });
}
