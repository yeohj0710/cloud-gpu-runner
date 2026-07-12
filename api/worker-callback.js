import { updateJob, validJobToken } from "../lib/jobs.js";
import { cloud } from "../lib/kakao-cloud.js";
import { addUsage } from "../lib/usage.js";

export default async function handler(request, response) {
  const id = String(request.query?.id || ""), token = String(request.query?.token || "");
  if (request.method !== "POST" || !validJobToken(id, token)) return response.status(401).json({ error: "unauthorized" });
  try { const status = ["running", "completed", "failed"].includes(request.body?.status) ? request.body.status : "failed"; let job = await updateJob(id, { status, error: String(request.body?.error || "").slice(0, 500) || undefined, completed_at: status === "completed" ? new Date().toISOString() : undefined }); if ((status === "completed" || status === "failed") && !job.usage_recorded_at) { const seconds=Math.max(1,(Date.now()-new Date(job.billing_started_at||job.created_at).getTime())/1000),amount=(Number(job.hourly_rate)||0)*seconds/3600; await addUsage({provider:"kakao",category:"gpu",action:status,label:`${job.flavor_name||"GPU"} · ${job.key}`,amount,meta:{job_id:id,seconds,hourly_rate:job.hourly_rate,status}}); job=await updateJob(id,{usage_amount:amount,usage_seconds:seconds,usage_recorded_at:new Date().toISOString()}); } if ((status === "completed" || status === "failed") && job.instance_id) { try { await cloud("bcs", `instances/${encodeURIComponent(job.instance_id)}`, { method: "DELETE" }); await updateJob(id, { instance_deleted_at: new Date().toISOString() }); } catch (error) { await updateJob(id, { cleanup_error: String(error.message).slice(0, 300) }); } } return response.json({ ok: true, job }); }
  catch (error) { return response.status(404).json({ error: error.message }); }
}
