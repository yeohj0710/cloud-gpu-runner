import { updateJob, validJobToken } from "../lib/jobs.js";
import { cloud } from "../lib/kakao-cloud.js";

export default async function handler(request, response) {
  const id = String(request.query?.id || ""), token = String(request.query?.token || "");
  if (request.method !== "POST" || !validJobToken(id, token)) return response.status(401).json({ error: "unauthorized" });
  try { const status = ["running", "completed", "failed"].includes(request.body?.status) ? request.body.status : "failed"; const job = await updateJob(id, { status, error: String(request.body?.error || "").slice(0, 500) || undefined, completed_at: status === "completed" ? new Date().toISOString() : undefined }); if ((status === "completed" || status === "failed") && job.instance_id) { try { await cloud("bcs", `instances/${encodeURIComponent(job.instance_id)}`, { method: "DELETE" }); await updateJob(id, { instance_deleted_at: new Date().toISOString() }); } catch (error) { await updateJob(id, { cleanup_error: String(error.message).slice(0, 300) }); } } return response.json({ ok: true, job }); }
  catch (error) { return response.status(404).json({ error: error.message }); }
}
