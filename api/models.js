import { isAuthorized } from "../lib/auth.js";
import { listModels } from "../lib/models.js";

export default async function handler(request, response) {
  if (!await isAuthorized(new Request("https://cloud-gpu-runner/api/models", { headers: { cookie: request.headers.cookie || "" } }))) return response.status(401).json({ error: "unauthorized" });
  if (request.method !== "GET") return response.status(405).json({ error: "method_not_allowed" });
  return response.json({ ok: true, items: (await listModels()).slice().reverse() });
}
