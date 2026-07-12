import { isAuthorized } from "../lib/auth.js";
import { bcs, cloud, token } from "../lib/kakao-cloud.js";
import { jobToken, listJobs, updateJob } from "../lib/jobs.js";
import { presignObject } from "../lib/ncp-storage.js";

function workerScript(job) {
  const input = presignObject(job.bucket, job.key, "GET", 21600), output = presignObject(job.bucket, job.result_key, "PUT", 21600), callback = `https://work-memory-ten.vercel.app/api/worker-callback?id=${encodeURIComponent(job.id)}&token=${jobToken(job.id)}`;
  return `#!/bin/bash\nset -euo pipefail\nCALLBACK='${callback}'\nfail(){ curl -fsS -X POST -H 'content-type: application/json' -d '{"status":"failed","error":"worker failed"}' "$CALLBACK" || true; shutdown -h now; }\ntrap fail ERR\ncurl -fsS -X POST -H 'content-type: application/json' -d '{"status":"running"}' "$CALLBACK"\napt-get update\nDEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip ffmpeg curl\npip3 install --break-system-packages faster-whisper\ncurl -fL '${input}' -o /tmp/input.media\ncat >/tmp/transcribe.py <<'PY'\nimport json\nfrom faster_whisper import WhisperModel\nm=WhisperModel('large-v3',device='cuda',compute_type='float16')\nsegments,info=m.transcribe('/tmp/input.media',language='${job.language || "ko"}',vad_filter=True)\nrows=[{'start':s.start,'end':s.end,'text':s.text.strip()} for s in segments]\nopen('/tmp/result.json','w',encoding='utf-8').write(json.dumps({'language':info.language,'duration':info.duration,'text':' '.join(x['text'] for x in rows),'segments':rows},ensure_ascii=False))\nPY\npython3 /tmp/transcribe.py\ncurl -fS -X PUT -H 'content-type: application/json' --upload-file /tmp/result.json '${output}'\ncurl -fsS -X POST -H 'content-type: application/json' -d '{"status":"completed"}' "$CALLBACK"\nshutdown -h now\n`;
}

export default async function handler(request, response) {
  if (!await isAuthorized(new Request("https://work-memory/api/cloud", { headers: { cookie: request.headers.cookie || "" } }))) return response.status(401).json({ error: "unauthorized" });
  try {
    const action = String(request.query?.action || "status");
    if (request.method === "GET" && action === "status") { await token(); return response.status(200).json({ ok: true, provider: "kakao", project: process.env.KAKAO_PROJECT_ID, region: process.env.KAKAO_REGION }); }
    if (request.method === "GET" && action === "instances") { const data = await bcs("instances?limit=100"); return response.status(200).json({ ok: true, items: data.instances || [], total: data.pagination?.total || 0 }); }
    if (request.method === "GET" && action === "gpu-flavors") { const data = await bcs("flavors?instance_type=gpu&limit=100"); return response.status(200).json({ ok: true, items: data.flavors || [] }); }
    if (request.method === "GET" && action === "readiness") {
      const [flavors, images, keypairs, subnets] = await Promise.all([bcs("flavors?instance_type=gpu&limit=100"), cloud("image", "images?instance_type=vm&image_type=basic&limit=100"), bcs("keypairs?limit=100"), cloud("vpc", "subnets?limit=100")]);
      return response.status(200).json({ ok: true, flavors: flavors.flavors || [], images: images.images || [], keypairs: keypairs.keypairs || [], subnets: subnets.subnets || [], security_groups: [{ name: "default" }] });
    }
    if (request.method === "POST" && action === "create") {
      const v = request.body || {};
      if (v.confirm !== "GPU 생성에 동의합니다") return response.status(400).json({ error: "confirmation_required" });
      if (!v.flavor_id || !v.image_id || !v.subnet_id || !v.key_name || !v.security_group) return response.status(400).json({ error: "missing_configuration" });
      const job = v.job_id ? (await listJobs()).find(item => item.id === v.job_id) : null;
      if (v.job_id && !job) return response.status(404).json({ error: "job_not_found" });
      const maxMinutes = Math.min(240, Math.max(15, Number(v.max_minutes) || 60));
      const userData = job ? workerScript(job).replace("python3 /tmp/transcribe.py", `timeout ${maxMinutes}m python3 /tmp/transcribe.py`) : undefined;
      const data = await cloud("bcs", "instances", { method: "POST", body: { instance: { name: `wm-${Date.now()}-${String(v.purpose || "job").replace(/[^a-z0-9-]/gi, "-").slice(0, 20)}`, description: `Work Memory ${v.purpose || "GPU job"}; max ${maxMinutes} minutes`, count: 1, image_id: v.image_id, flavor_id: v.flavor_id, subnets: [{ id: v.subnet_id }], volumes: [{ is_delete_on_termination: true, size: Math.max(50, Number(v.volume_gb) || 50), source_type: "image", uuid: v.image_id }], key_name: v.key_name, security_groups: [{ name: v.security_group }], user_data: userData ? Buffer.from(userData).toString("base64") : undefined } } });
      if (job) await updateJob(job.id, { status: "provisioning", instance_id: data.instance?.id || data.id, max_minutes: Math.min(240, Math.max(15, Number(v.max_minutes) || 60)) });
      return response.status(201).json({ ok: true, instance: data });
    }
    if (request.method === "DELETE" && action === "delete") { const id = String(request.query?.id || ""); if (!id) return response.status(400).json({ error: "instance_id_required" }); await cloud("bcs", `instances/${encodeURIComponent(id)}`, { method: "DELETE" }); return response.status(200).json({ ok: true, deleted: id }); }
    return response.status(400).json({ error: "unknown_action" });
  } catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : "cloud_request_failed" }); }
}
