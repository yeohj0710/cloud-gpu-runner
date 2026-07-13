import { deleteEphemeralInstance } from "./kakao-resources.js";
import { deleteNcpGpu } from "./ncp-gpu.js";

export async function deleteGpuResources(job) {
  return job?.provider === "naver" ? deleteNcpGpu(job) : deleteEphemeralInstance(job);
}

export function gpuCost(job, now = Date.now()) {
  const seconds = Math.max(1, (now - new Date(job.billing_started_at || job.created_at).getTime()) / 1000);
  const hours = seconds / 3600;
  const gpu = (Number(job.hourly_rate) || 0) * hours;
  const diskRate = Number(job.disk_gib_hour_rate ?? (job.provider === "naver" ? 0.14 : 0.16));
  const disk = (Number(job.volume_gb) || 0) * diskRate * hours;
  const publicIp = job.provider === "naver" ? 5.6 * hours : job.public_ip_id ? 5.5 * hours : 0;
  return { seconds, gpu, disk, publicIp, amount: gpu + disk + publicIp };
}
