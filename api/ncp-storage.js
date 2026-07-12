import { isAuthorized } from "../lib/auth.js";
import { createBucket, deleteBucket, deleteObject, downloadObject, listBuckets, listObjects, uploadObject } from "../lib/ncp-storage.js";

export default async function handler(request, response) {
  if (!await isAuthorized(new Request("https://work-memory/api/ncp-storage", { headers: { cookie: request.headers.cookie || "" } }))) return response.status(401).json({ error: "unauthorized" });
  try {
    const action = String(request.query?.action || "buckets");
    const bucket = String(request.query?.bucket || request.body?.bucket || "");
    const key = String(request.query?.key || request.body?.key || "");
    if (request.method === "GET" && action === "buckets") return response.json({ ok: true, items: await listBuckets() });
    if (request.method === "GET" && action === "objects") return response.json({ ok: true, items: await listObjects(bucket) });
    if (request.method === "GET" && action === "download") { const result = await downloadObject(bucket, key); response.setHeader("content-type", result.headers.get("content-type") || "application/octet-stream"); response.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(key.split("/").pop())}`); return response.status(200).send(result.body); }
    if (request.method === "POST" && action === "bucket") { await createBucket(bucket); return response.status(201).json({ ok: true, bucket }); }
    if (request.method === "POST" && action === "upload") { const data = Buffer.from(String(request.body?.base64 || ""), "base64"); if (data.length > 3_500_000) return response.status(413).json({ error: "file_too_large", max_bytes: 3500000 }); await uploadObject(bucket, key, data, String(request.body?.content_type || "application/octet-stream")); return response.status(201).json({ ok: true, bucket, key, size: data.length }); }
    if (request.method === "DELETE" && action === "object") { await deleteObject(bucket, key); return response.json({ ok: true, deleted: key }); }
    if (request.method === "DELETE" && action === "bucket") { await deleteBucket(bucket); return response.json({ ok: true, deleted: bucket }); }
    return response.status(400).json({ error: "unknown_action" });
  } catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : "storage_request_failed" }); }
}
