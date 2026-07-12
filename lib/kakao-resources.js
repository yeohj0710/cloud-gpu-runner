import { cloud } from "./kakao-cloud.js";

export async function removePublicIp(job) {
  if (!job?.instance_id || !job?.network_interface_id || !job?.public_ip_id) return false;
  try {
    await cloud("bcs", `instances/${encodeURIComponent(job.instance_id)}/network-interfaces/${encodeURIComponent(job.network_interface_id)}/public-ips`, { method: "DELETE" });
    return true;
  } catch (error) {
    if (/404/.test(String(error.message))) {
      try { await cloud("network", `public-ips/${encodeURIComponent(job.public_ip_id)}`, { method: "DELETE" }); }
      catch (fallbackError) { if (!/404/.test(String(fallbackError.message))) throw fallbackError; }
      return true;
    }
    throw error;
  }
}

export async function deleteEphemeralInstance(job) {
  let publicIpRemoved = false;
  try { publicIpRemoved = await removePublicIp(job); }
  finally {
    if (job?.instance_id) await cloud("bcs", `instances/${encodeURIComponent(job.instance_id)}`, { method: "DELETE" });
  }
  return { publicIpRemoved };
}
