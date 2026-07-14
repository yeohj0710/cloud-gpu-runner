import { randomUUID } from "node:crypto";
import { isAuthorized } from "../lib/auth.js";
import { readJson, writeJson } from "../lib/control-store.js";

const KEY = "control/ledger.json";
const validProvider = value => ["naver", "kakao"].includes(value);
const validKind = value => ["actual", "estimated", "adjustment"].includes(value);

export default async function handler(request, response) {
  if (!await isAuthorized(new Request("https://work-memory/api/ledger", { headers: { cookie: request.headers.cookie || "" } }))) return response.status(401).json({ error: "unauthorized" });
  try {
    const data = await readJson(KEY, { version: 1, entries: [] });
    if (request.method === "GET") return response.json({ ok: true, entries: data.entries || [] });
    if (request.method === "POST") {
      const v = request.body || {}, amount = Number(v.amount), service = String(v.service || "").trim().slice(0, 120);
      if (!validProvider(v.provider) || !validKind(v.kind) || !service || !Number.isFinite(amount) || amount < 0) return response.status(400).json({ error: "invalid_entry" });
      const entry = { id: randomUUID(), provider: v.provider, kind: v.kind, service, amount: Math.round(amount), created_at: new Date().toISOString() };
      data.entries = [...(data.entries || []), entry].slice(-1000); await writeJson(KEY, data); return response.status(201).json({ ok: true, entry });
    }
    if (request.method === "DELETE") { const id = String(request.query?.id || ""); data.entries = (data.entries || []).filter(item => item.id !== id); await writeJson(KEY, data); return response.json({ ok: true, deleted: id }); }
    return response.status(405).json({ error: "method_not_allowed" });
  } catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : "ledger_failed" }); }
}
