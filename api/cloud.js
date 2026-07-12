import { isAuthorized } from "../lib/auth.js";
import { bcs, cloud, token } from "../lib/kakao-cloud.js";
import { jobToken, listJobs, updateJob } from "../lib/jobs.js";
import { presignObject } from "../lib/ncp-storage.js";
import { KAKAO_GPU_HOURLY } from "../lib/usage.js";
import { safeInstanceDescription } from "../lib/cloud-metadata.js";

function workerScript(job) {
  const input = presignObject(job.bucket, job.key, "GET", 21600),
    output = presignObject(job.bucket, job.result_key, "PUT", 21600),
    log = presignObject(
      job.bucket,
      job.log_key || `logs/${job.id}.txt`,
      "PUT",
      21600,
    ),
    callback = `${process.env.PUBLIC_BASE_URL || "https://cloud-credit-lab-console.vercel.app"}/api/worker-callback?id=${encodeURIComponent(job.id)}&token=${jobToken(job.id)}`;
  return `#!/bin/bash\nset -euo pipefail\nCALLBACK='${callback}'\nLOG_URL='${log}'\nSTAGE='bootstrap'\nfail(){ code=$?; curl -fsS -X PUT -H 'content-type: text/plain' --upload-file /var/log/cloud-init-output.log "$LOG_URL" || true; curl -fsS -X POST -H 'content-type: application/json' -d "{\\"status\\":\\"failed\\",\\"error\\":\\"$STAGE failed (exit $code)\\"}" "$CALLBACK" || true; shutdown -h now; }\ntrap fail ERR\ncurl -fsS -X POST -H 'content-type: application/json' -d '{"status":"running"}' "$CALLBACK"\nSTAGE='system packages'\napt-get update\nDEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip python3-venv ffmpeg curl\nSTAGE='python environment'\npython3 -m venv /opt/work-memory-venv\n/opt/work-memory-venv/bin/pip install --upgrade pip\n/opt/work-memory-venv/bin/pip install faster-whisper\nSTAGE='input download'\ncurl -fL '${input}' -o /tmp/input.media\ncat >/tmp/transcribe.py <<'PY'\nimport json\nfrom faster_whisper import WhisperModel\nm=WhisperModel('large-v3',device='cuda',compute_type='float16')\nsegments,info=m.transcribe('/tmp/input.media',language='${job.language || "ko"}',vad_filter=True)\nrows=[{'start':s.start,'end':s.end,'text':s.text.strip()} for s in segments]\nopen('/tmp/result.json','w',encoding='utf-8').write(json.dumps({'language':info.language,'duration':info.duration,'text':' '.join(x['text'] for x in rows),'segments':rows},ensure_ascii=False))\nPY\nSTAGE='whisper transcription'\n/opt/work-memory-venv/bin/python /tmp/transcribe.py\nSTAGE='result upload'\ncurl -fS -X PUT -H 'content-type: application/json' --upload-file /tmp/result.json '${output}'\nSTAGE='completion callback'\ncurl -fsS -X POST -H 'content-type: application/json' -d '{"status":"completed"}' "$CALLBACK"\nshutdown -h now\n`;
}

export function customWorkerScript(job) {
  const code = presignObject(job.bucket, job.code_key, "GET", 21600);
  const data = job.data_key ? presignObject(job.bucket, job.data_key, "GET", 21600) : "";
  const output = presignObject(job.bucket, job.result_key, "PUT", 21600);
  const log = presignObject(job.bucket, job.log_key, "PUT", 21600);
  const callback = `${process.env.PUBLIC_BASE_URL || "https://cloud-credit-lab-console.vercel.app"}/api/worker-callback?id=${encodeURIComponent(job.id)}&token=${jobToken(job.id)}`;
  const command64 = Buffer.from(job.command, "utf8").toString("base64");
  const outputPath = String(job.output_path || "outputs");
  const archive = /\.zip$/i.test(job.code_key) ? "zip" : "tar";
  return `#!/bin/bash
set -Eeuo pipefail
CALLBACK='${callback}'
LOG_URL='${log}'
exec > >(tee /var/log/ccl-worker.log) 2>&1
finish(){ status="$1"; error="\${2:-}"; tar -czf /tmp/result.tar.gz -C /workspace "${outputPath}" 2>/dev/null || tar -czf /tmp/result.tar.gz -C /workspace .; curl -fsS -X PUT -H 'content-type: application/gzip' --upload-file /tmp/result.tar.gz '${output}' || true; curl -fsS -X PUT -H 'content-type: text/plain' --upload-file /var/log/ccl-worker.log "$LOG_URL" || true; curl -fsS -X POST -H 'content-type: application/json' -d "{\"status\":\"$status\",\"error\":\"$error\"}" "$CALLBACK" || true; shutdown -h now; }
trap 'finish failed "worker failed"' ERR
curl -fsS -X POST -H 'content-type: application/json' -d '{"status":"running"}' "$CALLBACK"
apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y curl unzip tar python3 python3-pip python3-venv git
mkdir -p /workspace /workspace/input /workspace/${outputPath}
curl -fL '${code}' -o /tmp/code.${archive === "zip" ? "zip" : "tar.gz"}
${archive === "zip" ? "unzip -q /tmp/code.zip -d /workspace" : "tar -xzf /tmp/code.tar.gz -C /workspace"}
${data ? `curl -fL '${data}' -o '/workspace/input/${String(job.data_key).split("/").pop().replace(/'/g, "")}'` : "true"}
export CCL_DATA_DIR=/workspace/input CCL_OUTPUT_DIR=/workspace/${outputPath} CCL_JOB_ID='${job.id}'
cd /workspace
COMMAND=$(printf '%s' '${command64}' | base64 -d)
timeout ${Math.min(1440, Math.max(15, Number(job.max_minutes) || 60))}m bash -lc "$COMMAND"
trap - ERR
finish completed ""
`;
}

export default async function handler(request, response) {
  if (
    !(await isAuthorized(
      new Request("https://work-memory/api/cloud", {
        headers: { cookie: request.headers.cookie || "" },
      }),
    ))
  )
    return response.status(401).json({ error: "unauthorized" });
  try {
    const action = String(request.query?.action || "status");
    if (request.method === "GET" && action === "status") {
      await token();
      return response.status(200).json({
        ok: true,
        provider: "kakao",
        project: process.env.KAKAO_PROJECT_ID,
        region: process.env.KAKAO_REGION,
      });
    }
    if (request.method === "GET" && action === "instances") {
      const data = await bcs("instances?limit=100");
      return response.status(200).json({
        ok: true,
        items: data.instances || [],
        total: data.pagination?.total || 0,
      });
    }
    if (request.method === "GET" && action === "gpu-flavors") {
      const data = await bcs("flavors?instance_type=gpu&limit=100");
      return response.status(200).json({ ok: true, items: data.flavors || [] });
    }
    if (request.method === "GET" && action === "readiness") {
      const [flavors, images, keypairs, subnets] = await Promise.all([
        bcs("flavors?instance_type=gpu&limit=100"),
        cloud("image", "images?instance_type=vm&image_type=basic&limit=100"),
        bcs("keypairs?limit=100"),
        cloud("vpc", "subnets?limit=100"),
      ]);
      return response.status(200).json({
        ok: true,
        flavors: flavors.flavors || [],
        images: images.images || [],
        keypairs: keypairs.keypairs || [],
        subnets: subnets.subnets || [],
        security_groups: [{ name: "default" }],
        pricing: {
          gpu_hourly: KAKAO_GPU_HOURLY,
          block_storage_gib_hour: 0.16,
          currency: "KRW",
          vat_included: false,
        },
      });
    }
    if (request.method === "POST" && action === "create") {
      const v = request.body || {};
      if (!v.job_id)
        return response.status(400).json({ error: "analysis_job_required" });
      if (
        !v.flavor_id ||
        !v.image_id ||
        !v.subnet_id ||
        !v.key_name ||
        !v.security_group
      )
        return response.status(400).json({ error: "missing_configuration" });
      const job = (await listJobs()).find((item) => item.id === v.job_id);
      if (!job) return response.status(404).json({ error: "job_not_found" });
      if (job.status !== "queued")
        return response.status(409).json({ error: "job_not_queued" });
      if (job) {
        const images = await cloud(
            "image",
            "images?instance_type=vm&image_type=basic&limit=100",
          ),
          selected = (images.images || []).find(
            (image) => image.id === v.image_id,
          );
        if (!selected || !/nvidia/i.test(selected.name || ""))
          return response.status(400).json({ error: "nvidia_image_required" });
      }
      const maxMinutes = Math.min(
        240,
        Math.max(15, Number(v.max_minutes) || 60),
      );
      const rawScript = job?.type === "custom-gpu" ? customWorkerScript({ ...job, max_minutes: maxMinutes }) : workerScript(job);
      const userData = job
        ? rawScript.replace(
            "python3 /tmp/transcribe.py",
            `timeout ${maxMinutes}m python3 /tmp/transcribe.py`,
          )
        : undefined;
      const data = await cloud("bcs", "instances", {
        method: "POST",
        body: {
          instance: {
            name: `ccl-${Date.now()}-${String(v.purpose || "job")
              .replace(/[^a-z0-9-]/gi, "-")
              .slice(0, 20)}`,
            description: safeInstanceDescription(
              `Cloud Credit Lab Work Memory ${v.purpose || "GPU job"}; max ${maxMinutes} minutes`,
            ),
            count: 1,
            image_id: v.image_id,
            flavor_id: v.flavor_id,
            subnets: [{ id: v.subnet_id }],
            volumes: [
              {
                is_delete_on_termination: true,
                size: Math.max(50, Number(v.volume_gb) || 50),
                source_type: "image",
                uuid: v.image_id,
              },
            ],
            key_name: v.key_name,
            security_groups: [{ name: v.security_group }],
            user_data: userData
              ? Buffer.from(userData).toString("base64")
              : undefined,
          },
        },
      });
      if (job) {
        const flavor = (
          await bcs("flavors?instance_type=gpu&limit=100")
        ).flavors?.find((x) => x.id === v.flavor_id);
        await updateJob(job.id, {
          status: "provisioning",
          instance_id: data.instance?.id || data.id,
          max_minutes: Math.min(240, Math.max(15, Number(v.max_minutes) || 60)),
          flavor_name: flavor?.name,
          hourly_rate: KAKAO_GPU_HOURLY[flavor?.name] || 0,
          billing_started_at: new Date().toISOString(),
        });
      }
      return response.status(201).json({ ok: true, instance: data });
    }
    if (request.method === "DELETE" && action === "delete") {
      const id = String(request.query?.id || "");
      if (!id)
        return response.status(400).json({ error: "instance_id_required" });
      await cloud("bcs", `instances/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      return response.status(200).json({ ok: true, deleted: id });
    }
    return response.status(400).json({ error: "unknown_action" });
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : "cloud_request_failed",
    });
  }
}
