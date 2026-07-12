import { isAuthorized } from "../lib/auth.js";
import { createJob, deleteJob, listJobs, updateJob } from "../lib/jobs.js";
import { cloud } from "../lib/kakao-cloud.js";
import { downloadObject, listObjects, presignObject } from "../lib/ncp-storage.js";

export default async function handler(request, response) {
  if (!await isAuthorized(new Request("https://work-memory/api/jobs", { headers: { cookie: request.headers.cookie || "" } }))) return response.status(401).json({ error: "unauthorized" });
  try {
    if (request.method === "GET" && request.query?.action === "result") { const job=(await listJobs()).find(x=>x.id===String(request.query?.id||"")); if(!job?.result_key)return response.status(404).json({error:"result_not_found"}); const result=await downloadObject(job.bucket,job.result_key); response.setHeader("content-type","application/json; charset=utf-8"); response.setHeader("content-disposition",`attachment; filename="${job.id}.json"`); return response.status(200).send(result.body); }
    if (request.method === "GET" && request.query?.action === "media-url") { const job=(await listJobs()).find(x=>x.id===String(request.query?.id||"")); if(!job)return response.status(404).json({error:"job_not_found"}); return response.json({ok:true,url:presignObject(job.bucket,job.key,"GET",3600),name:job.key.split("/").pop()}); }
    if (request.method === "GET") return response.json({ ok: true, items: (await listJobs()).slice().reverse() });
    if (request.method === "POST") { const bucket = String(request.body?.bucket || ""), key = String(request.body?.key || ""), language = String(request.body?.language || "ko"); if (!bucket || !key) return response.status(400).json({ error: "input_required" }); const exists = (await listObjects(bucket)).some(item => item.key === key); if (!exists) return response.status(404).json({ error: "input_not_found" }); return response.status(201).json({ ok: true, job: await createJob({ bucket, key, language }) }); }
    if (request.method === "POST" && request.query?.action === "cancel") { const id=String(request.body?.id||""),job=(await listJobs()).find(x=>x.id===id); if(!job)return response.status(404).json({error:"job_not_found"}); if(job.instance_id)await cloud("bcs",`instances/${encodeURIComponent(job.instance_id)}`,{method:"DELETE"}); return response.json({ok:true,job:await updateJob(id,{status:"cancelled",cancelled_at:new Date().toISOString(),instance_deleted_at:job.instance_id?new Date().toISOString():undefined})}); }
    if (request.method === "POST" && request.query?.action === "retry") { const id=String(request.body?.id||""),job=(await listJobs()).find(x=>x.id===id); if(!job)return response.status(404).json({error:"job_not_found"}); return response.json({ok:true,job:await updateJob(id,{status:"queued",error:undefined,cleanup_error:undefined,instance_id:undefined})}); }
    if (request.method === "DELETE") { const id=String(request.query?.id || ""),job=(await listJobs()).find(x=>x.id===id); if(job?.instance_id&&!['completed','failed','cancelled'].includes(job.status))return response.status(409).json({error:"cancel_running_job_first"}); await deleteJob(id); return response.json({ ok: true }); }
    return response.status(405).json({ error: "method_not_allowed" });
  } catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : "jobs_failed" }); }
}
