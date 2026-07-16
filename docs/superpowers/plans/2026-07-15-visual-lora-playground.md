# Visual LoRA Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Qwen text experiment and add an SDXL image LoRA experiment whose training effect is visible, versioned, checkpointed, resumable, and independent of an open browser tab.

**Architecture:** The browser packages 5–12 user-selected images and uploads them directly to NAVER Object Storage with a presigned URL. A disposable L40S/A100 worker runs pinned Diffusers SDXL DreamBooth LoRA, periodically snapshots checkpoints to Object Storage, and sends only short state callbacks to the control plane. Completed or recoverable interrupted runs become immutable model versions; later training copies the selected artifact and resumes from its latest checkpoint.

**Tech Stack:** Vercel Functions control plane, NAVER/Kakao GPU workers, NAVER Object Storage, SDXL, Hugging Face Diffusers/Accelerate, PyTorch BF16, vanilla HTML/CSS/JavaScript.

---

### Task 1: Preset and model-family contract

**Files:**
- Create: `lib/playground-presets.js`
- Modify: `lib/models.js`
- Modify: `api/worker-callback.js`
- Test: `scripts/model-registry.test.mjs`

- [ ] Define `qwen-lora-v1` and `sdxl-lora-v1` with IDs, base models, labels, artifact prefixes, and supported modes.
- [ ] Replace the Qwen-only registry guard with preset lookup; preserve old Qwen records and assign SDXL versions independently.
- [ ] Store `parent_model_id`, `checkpoint_steps`, `training_state`, `preview_key`, and sanitized image-training metadata.
- [ ] Register completed SDXL runs and failed/cancelled runs only when a periodic snapshot reported at least one valid checkpoint.
- [ ] Run `node --test scripts/model-registry.test.mjs`; expect all assertions to pass.

### Task 2: Durable checkpoint snapshots

**Files:**
- Modify: `lib/jobs.js`
- Modify: `api/cloud.js`
- Modify: `api/jobs.js`
- Test: `scripts/gpu-workbench.test.mjs`

- [ ] Give every custom job immutable `preview_key` and `manifest_key` object paths and retain the selected model as `source_model_id`.
- [ ] In the GPU worker, every 120 seconds archive non-empty output, upload the same immutable job artifact key, upload `preview-grid.jpg` and `checkpoint-manifest.json` when present, and callback with the sanitized `model-metadata.json`.
- [ ] Stop the snapshot loop before the terminal archive, then upload the final artifact and metadata before shutdown.
- [ ] On explicit cancellation, delete GPU resources first and register a recoverable SDXL version only when the last successful snapshot metadata contains checkpoints.
- [ ] Add authenticated `preview-url` access without routing image bytes through Vercel.
- [ ] Run `node --test scripts/gpu-workbench.test.mjs`; expect worker snapshot, model download, timeout, and cloud-init size assertions to pass.

### Task 3: Reproducible SDXL package

**Files:**
- Create: `examples/sdxl-lora-playground/requirements.txt`
- Create: `examples/sdxl-lora-playground/train.py`
- Create: `examples/sdxl-lora-playground/infer.py`
- Create: `examples/sdxl-lora-playground/render_comparison.py`
- Create: `public/playground/sdxl-lora-playground.zip`
- Test: `scripts/gpu-workbench.test.mjs`

- [ ] Decode the uploaded JSON image bundle into an instance directory; validate 5–12 JPEG/PNG/WebP images, prompts, 200–800 added steps, 100-step checkpoint interval, and deterministic seed.
- [ ] Download the official Diffusers `v0.35.1` SDXL LoRA trainer, verify its pinned SHA-256, and launch it with BF16, 1024px, gradient checkpointing, xFormers, rank 16, and `--resume_from_checkpoint latest` when a parent artifact exists.
- [ ] Monitor `checkpoint-N` directories and atomically refresh `model-metadata.json` plus `checkpoint-manifest.json` so interrupted work is discoverable.
- [ ] Generate a same-prompt/same-seed comparison grid containing base SDXL and selected checkpoint/final LoRA output.
- [ ] Make inference accept prompt, seed, and checkpoint step and emit `CGR_IMAGE_INFERENCE` JSON plus `preview-grid.jpg`.
- [ ] Run `python -m py_compile examples/sdxl-lora-playground/*.py`; expect no syntax errors.

### Task 4: Separate visual and text playgrounds

**Files:**
- Modify: `api/public-dashboard.js`
- Modify: `public/index.html`
- Modify: `public/home-playground.js`
- Modify: `public/home-playground.css`
- Test: `scripts/home-playground.test.mjs`

- [ ] Add `이미지 LoRA` and `텍스트 LoRA` tabs, defaulting to the visual experiment while keeping Qwen training and chat available.
- [ ] For visual training, collect 5–12 images, a subject prompt, a comparison prompt, and added steps; upload the bundle directly to Object Storage after password confirmation.
- [ ] Render model cards per preset with lineage, checkpoint chips, training state, exact job cost, and comparison preview.
- [ ] Add `이어 학습` and `이미지 비교` actions. Continue training must pass the selected artifact as the source model; image comparison must pass the selected checkpoint.
- [ ] Scope restored state by `preset_id` and exact current job ID so Qwen training cost cannot overwrite SDXL inference state or vice versa.
- [ ] Poll only while the page is visible. Closing the tab must not affect the worker; periodic GPU callbacks remain the sole progress heartbeat.
- [ ] Run `node --test scripts/home-playground.test.mjs`; expect public projection, direct upload, separate preset state, resume, and preview assertions to pass.

### Task 5: Verification and operating documentation

**Files:**
- Create: `docs/visual-lora-playground.md`
- Modify: `README.md`

- [ ] Document why Vercel remains a stateless control plane: no browser means no polling invocations; only brief worker callbacks occur while the paid GPU runs.
- [ ] Document snapshot recovery as best-effort with a maximum two-minute loss window and explain that sudden provider termination during upload can leave the previous snapshot.
- [ ] Run `npm run unit:test`, `python -m pytest`, `npm run check:secrets`, and Python syntax checks.
- [ ] Confirm `git diff --check`, inspect the final ZIP contents, and verify no credentials or user images are present.
- [ ] Do not launch a GPU, push, or deploy without a separate explicit instruction.
