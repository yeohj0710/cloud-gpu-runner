import { isAuthorized } from "../lib/auth.js";
import { bcs, cloud, token } from "../lib/kakao-cloud.js";

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
      const data = await cloud("bcs", "instances", { method: "POST", body: { instance: { name: `wm-${Date.now()}-${String(v.purpose || "job").replace(/[^a-z0-9-]/gi, "-").slice(0, 20)}`, description: `Work Memory ${v.purpose || "GPU job"}; max ${Math.min(240, Math.max(15, Number(v.max_minutes) || 60))} minutes`, count: 1, image_id: v.image_id, flavor_id: v.flavor_id, subnets: [{ id: v.subnet_id }], volumes: [{ is_delete_on_termination: true, size: Math.max(50, Number(v.volume_gb) || 50), source_type: "image", uuid: v.image_id }], key_name: v.key_name, security_groups: [{ name: v.security_group }] } } });
      return response.status(201).json({ ok: true, instance: data });
    }
    if (request.method === "DELETE" && action === "delete") { const id = String(request.query?.id || ""); if (!id) return response.status(400).json({ error: "instance_id_required" }); await cloud("bcs", `instances/${encodeURIComponent(id)}`, { method: "DELETE" }); return response.status(200).json({ ok: true, deleted: id }); }
    return response.status(400).json({ error: "unknown_action" });
  } catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : "cloud_request_failed" }); }
}
