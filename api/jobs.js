import { isAuthorized } from "../lib/auth.js";
import { createJob, deleteJob, listJobs } from "../lib/jobs.js";
import { downloadObject, listObjects } from "../lib/ncp-storage.js";

export default async function handler(request, response) {
  if (!await isAuthorized(new Request("https://work-memory/api/jobs", { headers: { cookie: request.headers.cookie || "" } }))) return response.status(401).json({ error: "unauthorized" });
  try {
    if (request.method === "GET" && request.query?.action === "result") { const job=(await listJobs()).find(x=>x.id===String(request.query?.id||"")); if(!job?.result_key)return response.status(404).json({error:"result_not_found"}); const result=await downloadObject(job.bucket,job.result_key); response.setHeader("content-type","application/json; charset=utf-8"); response.setHeader("content-disposition",`attachment; filename="${job.id}.json"`); return response.status(200).send(result.body); }
    if (request.method === "GET") return response.json({ ok: true, items: (await listJobs()).slice().reverse() });
    if (request.method === "POST") { const bucket = String(request.body?.bucket || ""), key = String(request.body?.key || ""), language = String(request.body?.language || "ko"); if (!bucket || !key) return response.status(400).json({ error: "input_required" }); const exists = (await listObjects(bucket)).some(item => item.key === key); if (!exists) return response.status(404).json({ error: "input_not_found" }); return response.status(201).json({ ok: true, job: await createJob({ bucket, key, language }) }); }
    if (request.method === "DELETE") { await deleteJob(String(request.query?.id || "")); return response.json({ ok: true }); }
    return response.status(405).json({ error: "method_not_allowed" });
  } catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : "jobs_failed" }); }
}
