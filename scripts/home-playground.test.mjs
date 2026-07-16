import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findActivePlaygroundJob } from "../lib/playground-presets.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "home-playground.css"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "public-dashboard.js"), "utf8");
const jsPath = path.join(root, "public", "home-playground.js");

assert.match(html, /id="ai-playground"/);
assert.match(html, /data-playground-preset="sdxl-lora-v1"/);
assert.match(html, /data-playground-preset="qwen-lora-v1"/);
assert.match(html, /id="playgroundProvider"/);
assert.match(html, /option value="auto"/);
assert.match(html, /option value="naver"/);
assert.match(html, /option value="kakao"/);
assert.match(html, /id="playgroundProviderHint"/);
assert.match(html, /id="visualImages"[^>]+multiple/);
assert.match(html, /id="visualDemoTrain"/);
assert.match(html, /100 steps/);
for (const filename of [
  "alvan-nee-9M0tSjb-cpA-unsplash.jpg",
  "alvan-nee-bQaAJCbNq3g-unsplash.jpg",
  "alvan-nee-eoqnr8ikwFE-unsplash.jpg",
]) {
  const assetPath = path.join(root, "public", "assets", "playground", "dog-example", filename);
  assert.match(html, new RegExp(`/assets/playground/dog-example/${filename}`));
  assert.ok(fs.existsSync(assetPath), `${filename} must be served as a local homepage asset`);
  assert.ok(fs.statSync(assetPath).size > 10_000, `${filename} must contain the actual dog photo`);
}
assert.match(html, /별도 GPU 실행 없이/);
assert.match(html, /id="customVisualTraining"/);
assert.match(html, /id="visualCheckpoint"/);
assert.match(html, /id="visualInference"[^>]+data-playground-output="sdxl-lora-v1"/);
assert.match(html, /id="homeInference"[^>]+data-playground-output="qwen-lora-v1"/);
assert.match(html, /home-playground\.js\?v=visual-lora-14/);
assert.match(html, /id="homeModelList"[^>]+aria-busy="true"/);
assert.match(html, /class="model-loading"[^>]+role="status"/);
assert.match(html, /home-playground\.css\?v=9/);
assert.match(html, /id="homeProgress"[^>]+role="status"[^>]+aria-live="polite"/);
assert.match(html, /id="ai-playground"[^>]+data-active-preset="sdxl-lora-v1"/);
assert.match(html, /data-output-close="sdxl-lora-v1"/);
assert.match(html, /data-output-close="qwen-lora-v1"/);
assert.match(html, /id="playgroundHelpDialog"[^>]+aria-labelledby="playgroundHelpTitle"/);
assert.match(html, /data-help-topic="experiment"/);
assert.match(html, /data-help-topic="library"/);
assert.match(html, /data-help-topic="result"/);
assert.match(html, /data-help-topic="checkpoint"/);
assert.match(html, /data-help-topic="seed"/);
assert.match(html, /id="visualAnswerGuide"/);
assert.match(
  css,
  /\.home-model-card\.visual-model\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
);
assert.doesNotMatch(html, />\s*관리자(?: 페이지)?\s*</);
assert.ok(fs.existsSync(jsPath));
const js = fs.readFileSync(jsPath, "utf8");
assert.match(js, /\/api\/login/);
assert.match(js, /requestPassword/);
assert.match(js, /\/api\/models/);
assert.match(js, /naver_gpu_quota_unavailable/);
assert.match(js, /kakaoFallback/);
assert.match(js, /kakao_gpu_unavailable/);
assert.match(js, /kakaoT4Fallback/);
assert.match(js, /const PROVIDERS = new Set\(\["auto", "naver", "kakao"\]\)/);
assert.match(js, /function selectedProvider\(\)/);
assert.match(js, /requestedProvider === "naver"/);
assert.match(js, /requestedProvider === "kakao"/);
assert.match(js, /environment = null/);
assert.match(js, /playgroundProviderHint/);
assert.match(js, /\/api\/jobs\?action=retry/);
assert.match(js, /\/api\/cloud\?action=provision/);
assert.match(js, /restorePublicJob/);
assert.match(js, /document\.visibilityState/);
assert.match(js, /sdxl-lora-playground\.zip/);
assert.match(js, /sdxl-lora-playground\.zip\?v=5/);
assert.match(js, /const shownResults = new Set\(\)/);
assert.match(js, /function placeProgress\(/);
assert.match(js, /function progressAnchorForJob\(/);
assert.match(js, /insertAdjacentElement\("afterend", progress\)/);
assert.match(js, /button\.closest\("\.home-model-card"\) \? \$\("#homeModelList"\) : button/);
assert.match(js, /classList\.toggle\("is-loading"/);
assert.match(js, /triggerButton \|\| "#visualDemoTrain"/);
assert.match(js, /startActivity\("GPU와 비용을 확인하고 있어요", "아직 GPU 과금은 시작되지 않았어요", progressAnchor\)/);
assert.match(js, /visualTrainingBundle/);
assert.match(js, /trainVisualDemo/);
assert.match(js, /CGR_DEMO=dog/);
assert.match(js, /job\.task_mode === "training"/);
assert.match(js, /저장된 학습 결과/);
assert.match(js, /resume-demo/);
assert.match(js, /100 step 더 학습/);
assert.match(js, /model_key: parent\?\.artifact_key/);
assert.match(api, /demo_id: model\.training\.demo_id/);
assert.match(api, /model\.training\.dataset === "Hugging Face Diffusers dog example"/);
assert.match(js, /source_model_id|model_key: parent\?\.artifact_key/);
assert.match(js, /demoModel \? "resume-demo" : "resume"/);
assert.match(js, /checkpoint_step/);
assert.match(js, /api\/jobs\?action=preview-url/);
assert.match(api, /playground_job/);
assert.match(api, /playground_jobs/);
assert.match(api, /preset_id: model\.preset_id/);
assert.doesNotMatch(api, /preview_url|trigger_word|instance_prompt|validation_prompt/);
assert.doesNotMatch(api, /playground_job:[^\n]*error:/);
assert.match(api, /listModels/);
assert.match(api, /models/);
assert.doesNotMatch(api, /artifact_key:\s*model\.artifact_key|bucket:\s*model\.bucket/);
assert.match(js, /PRIVATE MODEL/);
assert.match(js, /const currentJobs = \{\};/);
assert.doesNotMatch(js, /lastInferenceJobs/);
assert.match(js, /const targetBucket = parent\?\.bucket \|\| env\.bucket/);
assert.match(js, /\[data-playground-output\]/);
assert.match(js, /activePreset !== job\.preset_id/);
assert.match(js, /setAttribute\("aria-busy", "false"\)/);
assert.match(js, /function openPlaygroundHelp/);
assert.match(js, /function syncOutputVisibility\(reset = false\)/);
assert.match(js, /homeAnswer"\)\.hidden = true/);
assert.match(js, /data-help-topic="model"/);
assert.match(js, /배경과 파란 안경/);
assert.match(js, /기본 SDXL/);
assert.match(js, /과학습/);
assert.match(css, /\.help-dialog/);
assert.match(css, /\.comparison-guide/);
assert.match(css, /\.provider-selector/);
assert.match(css, /\.home-progress\.inline-progress/);
assert.match(css, /data-active-preset="sdxl-lora-v1"[^\n]+data-playground-output="qwen-lora-v1"/);

const restoredJob = findActivePlaygroundJob([
  { id: "cancelled-test", preset_id: "sdxl-lora-v1", status: "cancelled" },
  { id: "running-user-job", preset_id: "sdxl-lora-v1", status: "running" },
], "sdxl-lora-v1");
assert.equal(restoredJob?.id, "running-user-job", "a cancelled smoke test must not replace the current Playground status");
assert.equal(findActivePlaygroundJob([{ id: "finished", preset_id: "sdxl-lora-v1", status: "completed" }], "sdxl-lora-v1"), null, "terminal history must not remain as a current status banner");

const restorePrivateJobsSource = js.match(/async function restorePrivateJobs\(\)[\s\S]*?\n  \}/)?.[0] || "";
const restorePublicJobSource = js.match(/function restorePublicJob\(job\)[\s\S]*?\n  \}/)?.[0] || "";
const switchPresetSource = js.match(/function switchPreset\(presetId\)[\s\S]*?\n  \}/)?.[0] || "";
assert.doesNotMatch(restorePrivateJobsSource, /showCompletedResult/);
assert.match(restorePublicJobSource, /!ACTIVE\.has\(job\.status\)/, "cached terminal jobs must be hidden defensively");
assert.doesNotMatch(switchPresetSource, /showCompletedResult/);

console.log("homepage playground contract tests passed");
