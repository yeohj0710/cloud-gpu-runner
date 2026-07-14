import { cloud } from "./kakao-cloud.js";

export async function removePublicIp(job) {
  if (!job?.instance_id || !job?.network_interface_id || !job?.public_ip_id) return false;
  try {
    await cloud("bcs", `instances/${encodeURIComponent(job.instance_id)}/network-interfaces/${encodeURIComponent(job.network_interface_id)}/public-ips`, { method: "DELETE" });
  } catch (error) {
    if (!/404/.test(String(error.message))) throw error;
  }
  try { await cloud("network", `public-ips/${encodeURIComponent(job.public_ip_id)}`, { method: "DELETE" }); }
  catch (error) { if (!/404/.test(String(error.message))) throw error; }
  return true;
}

export async function deleteEphemeralInstance(job) {
  let publicIpRemoved = false;
  try { publicIpRemoved = await removePublicIp(job); }
  finally {
    if (job?.instance_id) await cloud("bcs", `instances/${encodeURIComponent(job.instance_id)}`, { method: "DELETE" });
  }
  return { publicIpRemoved };
}
