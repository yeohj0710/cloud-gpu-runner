import { isAuthorized } from "../lib/auth.js";
import { estimateGpu, estimateStorage, KAKAO_GPU_HOURLY, STORAGE } from "../lib/usage.js";

export default async function handler(req, res) {
  if (!await isAuthorized(new Request("https://work-memory/api/estimate", { headers: { cookie: req.headers.cookie || "" } }))) return res.status(401).json({ error: "unauthorized" });
  try {
    const type = String(req.query?.type || req.body?.type || "catalog");
    if (type === "catalog") return res.json({ gpu_hourly: KAKAO_GPU_HOURLY, storage: STORAGE, currency: "KRW", vat_included: false });
    if (type === "storage") return res.json(estimateStorage(String(req.body?.provider || "naver"), req.body?.bytes, req.body?.days, req.body?.requests));
    if (type === "gpu") return res.json(estimateGpu(String(req.body?.flavor), req.body?.minutes, req.body?.volume_gb));
    return res.status(400).json({ error: "unknown_estimate_type" });
  } catch (error) { return res.status(400).json({ error: error.message || "estimate_failed" }); }
}
