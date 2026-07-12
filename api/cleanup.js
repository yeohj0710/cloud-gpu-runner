import { cloud } from "../lib/kakao-cloud.js";
import { listJobs, updateJob } from "../lib/jobs.js";
import { addUsage } from "../lib/usage.js";

export default async function handler(request, response) {
  if (request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return response.status(401).json({ error: "unauthorized" });
  const now = Date.now(), cleaned = [], errors = [];
  for (const job of await listJobs()) {
    if (!job.instance_id || !["provisioning", "running"].includes(job.status)) continue;
    const max = (Number(job.max_minutes) || 60) + 20;
    const started = new Date(job.billing_started_at || job.created_at).getTime();
    if (now - started < max * 60000) continue;
    try {
      await cloud("bcs", `instances/${encodeURIComponent(job.instance_id)}`, { method: "DELETE" });
      const seconds = Math.max(1, (now - started) / 1000), hours = seconds / 3600;
      const gpu = (Number(job.hourly_rate) || 0) * hours, disk = (Number(job.volume_gb) || 0) * 0.16 * hours, amount = gpu + disk;
      if (!job.usage_recorded_at) await addUsage({ provider: "kakao", category: "gpu", action: "timeout", label: `${job.flavor_name || "GPU"} · ${job.key}`, amount, meta: { job_id: job.id, seconds, gpu, disk } });
      await updateJob(job.id, { status: "failed", error: `최대 실행시간 ${max - 20}분을 초과해 자동 종료했어요.`, instance_deleted_at: new Date().toISOString(), usage_amount: amount, usage_gpu_amount: gpu, usage_disk_amount: disk, usage_seconds: seconds, usage_recorded_at: job.usage_recorded_at || new Date().toISOString() });
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
