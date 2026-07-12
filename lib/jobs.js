import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readJson, writeJson } from "./control-store.js";

const KEY = "control/jobs.json";
export async function listJobs() { return (await readJson(KEY, { version: 1, jobs: [] })).jobs || []; }
export async function saveJobs(jobs) { return writeJson(KEY, { version: 1, jobs: jobs.slice(-500) }); }
export async function createJob(input) { const jobs = await listJobs(),id=randomUUID(); const job = { id, type: "whisper-transcription", status: "queued", provider: "ncp", bucket: input.bucket, key: input.key, language: input.language === "auto" ? "ko" : input.language || "ko", result_key: `results/${Date.now()}-${id}.json`, log_key:`logs/${id}.txt`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; await saveJobs([...jobs, job]); return job; }
export async function updateJob(id, patch) { const jobs = await listJobs(), index = jobs.findIndex(x => x.id === id); if (index < 0) throw new Error("job_not_found"); jobs[index] = { ...jobs[index], ...patch, updated_at: new Date().toISOString() }; await saveJobs(jobs); return jobs[index]; }
export async function deleteJob(id) { const jobs = await listJobs(); await saveJobs(jobs.filter(x => x.id !== id)); }
export function jobToken(id) { return createHmac("sha256", process.env.SESSION_SECRET).update(`worker:${id}`).digest("hex"); }
export function validJobToken(id, value) { const expected = Buffer.from(jobToken(id)), actual = Buffer.from(String(value || "")); return expected.length === actual.length && timingSafeEqual(expected, actual); }
