import { randomUUID } from "node:crypto";
import { isAuthorized } from "../lib/auth.js";
import { readJson, writeJson } from "../lib/control-store.js";
import { searchPubMed, pubmedCsv } from "../lib/pubmed.js";
import { addUsage } from "../lib/usage.js";
const INDEX = "research/index.json";
export default async function handler(req, res) {
  if (
    !(await isAuthorized(
      new Request("https://cloud-gpu-runner/api/research", {
        headers: { cookie: req.headers.cookie || "" },
      }),
    ))
  )
    return res.status(401).json({ error: "unauthorized" });
  try {
    if (req.method === "POST") {
      const query = String(req.body?.query || "").trim(),
        limit = Math.min(200, Math.max(1, Number(req.body?.limit) || 50));
      if (query.length < 3)
        return res.status(400).json({ error: "query_too_short" });
      const result = await searchPubMed(query, limit),
        id = randomUUID(),
        run = {
          id,
          query,
          limit,
          total: result.total,
          count: result.items.length,
          created_at: new Date().toISOString(),
          items: result.items,
        };
      await writeJson(`research/runs/${id}.json`, run);
      const index = await readJson(INDEX, { runs: [] });
      index.runs = [
        {
          id,
          query,
          limit,
          total: run.total,
          count: run.count,
          created_at: run.created_at,
        },
        ...(index.runs || []),
      ].slice(0, 100);
      await writeJson(INDEX, index);
      await addUsage({
        provider: "naver",
        category: "research",
        action: "pubmed_search",
        label: `PubMed · ${query.slice(0, 80)}`,
        amount: 0.018,
        meta: { id, count: run.count, storage_requests: 4 },
      });
      return res.status(201).json({ ok: true, run });
    }
    const id = String(req.query?.id || "");
    if (id) {
      const run = await readJson(`research/runs/${id}.json`, null);
      if (!run) return res.status(404).json({ error: "run_not_found" });
      if (req.query?.format === "csv") {
        res.setHeader("content-type", "text/csv; charset=utf-8");
        res.setHeader(
          "content-disposition",
          `attachment; filename=pubmed-${id}.csv`,
        );
        return res.send(`\ufeff${pubmedCsv(run.items)}`);
      }
      return res.json({ ok: true, run });
    }
    return res.json({ ok: true, ...(await readJson(INDEX, { runs: [] })) });
  } catch (error) {
    return res.status(502).json({ error: error.message || "research_failed" });
  }
}
