import { isAuthorized } from "../lib/auth.js";
import { bcs, cloud, token } from "../lib/kakao-cloud.js";
import { jobToken, listJobs, updateJob } from "../lib/jobs.js";
import { presignObject } from "../lib/ncp-storage.js";
import { addUsage, KAKAO_GPU_HOURLY } from "../lib/usage.js";
import { safeInstanceDescription } from "../lib/cloud-metadata.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function workerScript(job, baseUrl) {
  const input = presignObject(job.bucket, job.key, "GET", 21600),
    output = presignObject(job.bucket, job.result_key, "PUT", 21600),
    log = presignObject(
      job.bucket,
      job.log_key || `logs/${job.id}.txt`,
      "PUT",
      21600,
    ),
    callback = `${baseUrl}/api/worker-callback?id=${encodeURIComponent(job.id)}&token=${jobToken(job.id)}`;
  return `#!/bin/bash\nset -euo pipefail\nCALLBACK='${callback}'\nLOG_URL='${log}'\nSTAGE='bootstrap'\nfail(){ code=$?; curl -fsS -X PUT -H 'content-type: text/plain' --upload-file /var/log/cloud-init-output.log "$LOG_URL" || true; curl -fsS -X POST -H 'content-type: application/json' -d "{\\"status\\":\\"failed\\",\\"error\\":\\"$STAGE failed (exit $code)\\"}" "$CALLBACK" || true; shutdown -h now; }\ntrap fail ERR\ncurl -fsS -X POST -H 'content-type: application/json' -d '{"status":"running"}' "$CALLBACK"\nSTAGE='system packages'\napt-get update\nDEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip python3-venv ffmpeg curl\nSTAGE='python environment'\npython3 -m venv /opt/work-memory-venv\n/opt/work-memory-venv/bin/pip install --upgrade pip\n/opt/work-memory-venv/bin/pip install faster-whisper\nSTAGE='input download'\ncurl -fL '${input}' -o /tmp/input.media\ncat >/tmp/transcribe.py <<'PY'\nimport json\nfrom faster_whisper import WhisperModel\nm=WhisperModel('large-v3',device='cuda',compute_type='float16')\nsegments,info=m.transcribe('/tmp/input.media',language='${job.language || "ko"}',vad_filter=True)\nrows=[{'start':s.start,'end':s.end,'text':s.text.strip()} for s in segments]\nopen('/tmp/result.json','w',encoding='utf-8').write(json.dumps({'language':info.language,'duration':info.duration,'text':' '.join(x['text'] for x in rows),'segments':rows},ensure_ascii=False))\nPY\nSTAGE='whisper transcription'\n/opt/work-memory-venv/bin/python /tmp/transcribe.py\nSTAGE='result upload'\ncurl -fS -X PUT -H 'content-type: application/json' --upload-file /tmp/result.json '${output}'\nSTAGE='completion callback'\ncurl -fsS -X POST -H 'content-type: application/json' -d '{"status":"completed"}' "$CALLBACK"\nshutdown -h now\n`;
}

export function customWorkerScript(job, baseUrl = "https://work-memory-ten.vercel.app") {
  const expiry = Math.min(604800, Math.max(21600, (Number(job.max_minutes) || 60) * 60 + 7200));
  const code = presignObject(job.bucket, job.code_key, "GET", expiry);
  const data = job.data_key ? presignObject(job.bucket, job.data_key, "GET", expiry) : "";
  const output = presignObject(job.bucket, job.result_key, "PUT", expiry);
  const log = presignObject(job.bucket, job.log_key, "PUT", expiry);
  const callback = `${baseUrl}/api/worker-callback?id=${encodeURIComponent(job.id)}&token=${jobToken(job.id)}`;
  const command64 = Buffer.from(job.command, "utf8").toString("base64");
  const outputPath = String(job.output_path || "outputs");
  const outputRoot = outputPath.split("/")[0];
  const archive = /\.zip$/i.test(job.code_key) ? "zip" : "tar";
  return `#!/bin/bash
set -Eeuo pipefail
CALLBACK='${callback}'
LOG_URL='${log}'
exec > >(tee /var/log/cgr-worker.log) 2>&1
finish(){ trap - ERR; status="$1"; error="\${2:-}"; if [ -d "/workspace/${outputPath}" ] && [ -n "$(find "/workspace/${outputPath}" -mindepth 1 -print -quit)" ]; then tar -czf /tmp/result.tar.gz -C /workspace "${outputPath}"; else printf '{"status":"%s","message":"output directory is empty"}\n' "$status" >/tmp/result-status.json; tar -czf /tmp/result.tar.gz -C /tmp result-status.json; fi; curl -fsS -X PUT -H 'content-type: application/gzip' --upload-file /tmp/result.tar.gz '${output}' || true; curl -fsS -X PUT -H 'content-type: text/plain' --upload-file /var/log/cgr-worker.log "$LOG_URL" || true; printf '{"status":"%s","error":"%s"}' "$status" "$error" | curl -fsS -X POST -H 'content-type: application/json' --data-binary @- "$CALLBACK" || true; shutdown -h now || true; }
fail(){ code=$?; if [ "$code" = 124 ]; then finish failed "execution timeout"; else finish failed "worker failed (exit $code)"; fi; }
trap fail ERR
progress(){ printf '{"status":"running","stage":"%s"}' "$1" | curl -fsS --connect-timeout 15 --max-time 30 -X POST -H 'content-type: application/json' --data-binary @- "$CALLBACK"; }
online=0
for attempt in $(seq 1 150); do
  if progress bootstrap; then online=1; break; fi
  sleep 2
done
if [ "$online" != 1 ]; then finish failed "network activation timeout"; exit 70; fi
mkdir -p /workspace /workspace/input /workspace/${outputPath}
progress code_download
curl -fL --connect-timeout 15 --max-time 600 '${code}' -o /tmp/code.${archive === "zip" ? "zip" : "tar.gz"}
progress code_extract
${archive === "zip" ? "python3 -m zipfile -e /tmp/code.zip /workspace" : "tar -xzf /tmp/code.tar.gz -C /workspace"}
${data ? `progress data_download
curl -fL --connect-timeout 15 --max-time 3600 '${data}' -o '/workspace/input/${String(job.data_key).split("/").pop().replace(/'/g, "")}'` : "true"}
export CGR_DATA_DIR=/workspace/input CGR_DATA_FILE='${data ? `/workspace/input/${String(job.data_key).split("/").pop().replace(/'/g, "")}` : ""}' CGR_OUTPUT_DIR=/workspace/${outputPath} CGR_JOB_ID='${job.id}'
WORKDIR=/workspace
mapfile -t roots < <(find /workspace -mindepth 1 -maxdepth 1 -type d ! -name input ! -name '${outputRoot}')
files=$(find /workspace -mindepth 1 -maxdepth 1 -type f | wc -l)
if [ "\${#roots[@]}" = 1 ] && [ "$files" = 0 ]; then WORKDIR="\${roots[0]}"; fi
cd "$WORKDIR"
COMMAND=$(printf '%s' '${command64}' | base64 -d)
progress command
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
    if (request.method === "GET" && action === "public-ips") {
      const data = await cloud("network", "public-ips?limit=100");
      return response.status(200).json({ ok: true, items: data.public_ips || [], total: data.pagination?.total || data.public_ips?.length || 0 });
    }
    if (request.method === "GET" && action === "console-log") {
      const id = String(request.query?.id || "");
      if (!id) return response.status(400).json({ error: "instance_id_required" });
      const data = await bcs(`instances/${encodeURIComponent(id)}/console-logs`);
      return response.status(200).json({ ok: true, instance_id: id, data });
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
        const [images, flavorData] = await Promise.all([
          cloud("image", "images?instance_type=vm&image_type=basic&limit=100"),
          bcs("flavors?instance_type=gpu&limit=100"),
        ]),
          selected = (images.images || []).find(
            (image) => image.id === v.image_id,
          ), selectedFlavor = (flavorData.flavors || []).find((flavor) => flavor.id === v.flavor_id);
        if (!selected || !/nvidia/i.test(selected.name || ""))
          return response.status(400).json({ error: "nvidia_image_required" });
        if (!selectedFlavor || String(selectedFlavor.manufacturer).toLowerCase() !== "nvidia")
          return response.status(400).json({ error: "nvidia_gpu_required" });
      }
      const maxMinutes = Math.min(
        1440,
        Math.max(15, Number(v.max_minutes) || 60),
      );
      const requestHost = String(request.headers.host || "").toLowerCase();
      const baseUrl = /^[a-z0-9.-]+\.vercel\.app$/.test(requestHost) ? `https://${requestHost}` : "https://work-memory-ten.vercel.app";
      const rawScript = job?.type === "custom-gpu" ? customWorkerScript({ ...job, max_minutes: maxMinutes }, baseUrl) : workerScript(job, baseUrl);
      const userData = job
        ? rawScript.replace(
            "python3 /tmp/transcribe.py",
            `timeout ${maxMinutes}m python3 /tmp/transcribe.py`,
          )
        : undefined;
      if (userData && Buffer.byteLength(userData, "utf8") > 16 * 1024)
        return response.status(400).json({ error: "user_data_too_large" });
      const data = await cloud("bcs", "instances", {
        method: "POST",
        body: {
          instance: {
            name: `cgr-${Date.now()}-${String(v.purpose || "job")
              .replace(/[^a-z0-9-]/gi, "-")
              .slice(0, 20)}`,
            description: safeInstanceDescription(
              `Cloud GPU Runner Work Memory ${v.purpose || "GPU job"}; max ${maxMinutes} minutes`,
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
        const instanceId = data.instance?.id || data.id;
        const flavor = (
          await bcs("flavors?instance_type=gpu&limit=100")
        ).flavors?.find((x) => x.id === v.flavor_id);
        await updateJob(job.id, {
          provider: "kakao",
          status: "provisioning",
          instance_id: instanceId,
          max_minutes: Math.min(1440, Math.max(15, Number(v.max_minutes) || 60)),
          volume_gb: Math.max(50, Number(v.volume_gb) || 50),
          flavor_name: flavor?.name,
          hourly_rate: KAKAO_GPU_HOURLY[flavor?.name] || 0,
          billing_started_at: new Date().toISOString(),
        });
        try {
          let activeInstance;
          for (let attempt = 0; attempt < 30; attempt += 1) {
            try {
              const details = await bcs("instances?limit=100");
              const candidate = details.instances?.find((item) => item.id === instanceId);
              if (candidate?.status === "active" && !candidate.task_state) { activeInstance = candidate; break; }
            } catch (error) {
              if (!/404|409/.test(String(error.message))) throw error;
            }
            await wait(1500);
          }
          if (!activeInstance) throw new Error("instance_activation_timeout");
          let networkInterfaceId = activeInstance.addresses?.[0]?.network_interface_id;
          if (!networkInterfaceId) {
            const interfaces = await bcs(`instances/${encodeURIComponent(instanceId)}/network-interfaces`);
            networkInterfaceId = interfaces.network_interfaces?.[0]?.id;
          }
          if (!networkInterfaceId) throw new Error("network_interface_not_ready");
          let publicIpData;
          for (let attempt = 0; attempt < 8; attempt += 1) {
            try { publicIpData = await cloud("bcs", `instances/${encodeURIComponent(instanceId)}/network-interfaces/${encodeURIComponent(networkInterfaceId)}/public-ips`, { method: "POST" }); break; }
            catch (error) { if (!/409/.test(String(error.message)) || attempt === 7) throw error; await wait(1000); }
          }
          const publicIp = publicIpData.public_ip || publicIpData;
          await updateJob(job.id, { network_interface_id: networkInterfaceId, public_ip_id: publicIp.id, public_ip_address: publicIp.public_ip, public_ip_attached_at: new Date().toISOString() });
          data.ephemeral_public_ip = { id: publicIp.id, public_ip: publicIp.public_ip };
        } catch (error) {
          try { await cloud("bcs", `instances/${encodeURIComponent(instanceId)}`, { method: "DELETE" }); } catch {}
          const failedAt = Date.now(), startedAt = new Date((await listJobs()).find((item) => item.id === job.id)?.billing_started_at || failedAt).getTime();
          const seconds = Math.max(1, (failedAt - startedAt) / 1000), hours = seconds / 3600;
          const gpu = (KAKAO_GPU_HOURLY[flavor?.name] || 0) * hours, disk = Math.max(50, Number(v.volume_gb) || 50) * 0.16 * hours, amount = gpu + disk;
          await addUsage({ provider: "kakao", category: "gpu", action: "setup_failed", label: `${flavor?.name || "GPU"} · ${job.key}`, amount, meta: { job_id: job.id, seconds, gpu, disk } });
          await updateJob(job.id, { status: "failed", error: `인터넷 연결 준비 실패: ${String(error.message).slice(0, 180)}`, instance_deleted_at: new Date().toISOString(), usage_amount: amount, usage_gpu_amount: gpu, usage_disk_amount: disk, usage_public_ip_amount: 0, usage_seconds: seconds, usage_recorded_at: new Date().toISOString() });
          throw error;
        }
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
    if (request.method === "DELETE" && action === "delete-public-ip") {
      const id = String(request.query?.id || "");
      if (!id) return response.status(400).json({ error: "public_ip_id_required" });
      await cloud("network", `public-ips/${encodeURIComponent(id)}`, { method: "DELETE" });
      return response.status(200).json({ ok: true, deleted: id });
    }
    return response.status(400).json({ error: "unknown_action" });
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : "cloud_request_failed",
    });
  }
}
