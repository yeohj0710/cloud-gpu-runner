import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readJson, writeJson } from "./control-store.js";

const KEY = "control/jobs.json";
const SAFE_OBJECT_KEY = /^[\p{L}\p{N}._/()\- ]+$/u;

export async function listJobs() {
  return (await readJson(KEY, { version: 2, jobs: [] })).jobs || [];
}
export async function saveJobs(jobs) {
  return writeJson(KEY, { version: 2, jobs: jobs.slice(-500) });
}
export function validateCustomJob(input) {
  const codeKey = String(input.code_key || "");
  const dataKey = String(input.data_key || "");
  const command = String(input.command || "").trim();
  const outputPath = String(input.output_path || "outputs").trim();
  if (!codeKey || !command) throw new Error("code_and_command_required");
  if (![codeKey, dataKey].filter(Boolean).every((key) => SAFE_OBJECT_KEY.test(key) && !key.includes(".."))) throw new Error("unsafe_object_key");
  if (!/\.(zip|tar\.gz|tgz)$/i.test(codeKey)) throw new Error("code_archive_required");
  if (command.length > 1000 || /[\r\n\0]/.test(command)) throw new Error("unsafe_command");
  if (!/^[\w./-]+$/.test(outputPath) || outputPath.includes("..") || outputPath.startsWith("/")) throw new Error("unsafe_output_path");
  return { codeKey, dataKey, command, outputPath };
}
export async function createJob(input) {
  const jobs = await listJobs(), id = randomUUID(), now = new Date().toISOString();
  let job;
  if (input.type === "custom-gpu") {
    const value = validateCustomJob(input);
    job = {
      id, type: "custom-gpu", status: "queued", provider: "kakao",
      bucket: input.bucket, key: value.codeKey, code_key: value.codeKey,
      data_key: value.dataKey || undefined, command: value.command,
      output_path: value.outputPath, result_key: `results/${Date.now()}-${id}.tar.gz`,
      log_key: `logs/${id}.txt`, created_at: now, updated_at: now,
    };
  } else {
    job = { id, type: "whisper-transcription", status: "queued", provider: "kakao", bucket: input.bucket, key: input.key, language: input.language === "auto" ? "ko" : input.language || "ko", result_key: `results/${Date.now()}-${id}.json`, log_key: `logs/${id}.txt`, created_at: now, updated_at: now };
  }
  await saveJobs([...jobs, job]);
  return job;
}
export async function updateJob(id, patch) {
  const jobs = await listJobs(), index = jobs.findIndex((x) => x.id === id);
  if (index < 0) throw new Error("job_not_found");
  jobs[index] = { ...jobs[index], ...patch, updated_at: new Date().toISOString() };
  await saveJobs(jobs);
  return jobs[index];
}
export async function deleteJob(id) { const jobs = await listJobs(); await saveJobs(jobs.filter((x) => x.id !== id)); }
export function jobToken(id) { return createHmac("sha256", process.env.SESSION_SECRET).update(`worker:${id}`).digest("hex"); }
export function validJobToken(id, value) { const expected = Buffer.from(jobToken(id)), actual = Buffer.from(String(value || "")); return expected.length === actual.length && timingSafeEqual(expected, actual); }
