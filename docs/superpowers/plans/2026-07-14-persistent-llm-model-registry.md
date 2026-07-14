# Persistent LLM Model Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the one-shot demo into a durable 7B LLM playground where trained LoRA versions accumulate and any saved version can be selected for paid GPU inference.

**Architecture:** Train Qwen2.5-7B-Instruct in BF16 with LoRA on a bounded Korean instruction dataset, upload the adapter artifact through the existing worker, and register successful training artifacts in a durable Object Storage-backed model registry. Inference jobs download both the reusable code bundle and the selected registered model artifact, extract the adapter, answer a user prompt, and preserve their own result and cost records.

**Tech Stack:** Vercel Functions, NAVER/Kakao 48GB+ NVIDIA GPUs, Object Storage, Python, PyTorch, Transformers, PEFT, Hugging Face Datasets, vanilla HTML/CSS/JavaScript.

---

### Task 1: Durable model registry

**Files:**
- Create: `lib/models.js`
- Create: `api/models.js`
- Modify: `api/worker-callback.js`
- Test: `scripts/model-registry.test.mjs`

- [ ] Store registered models separately from the 500-job rolling history.
- [ ] Register only completed `qwen-lora-v1` training jobs, using the immutable result object as the adapter artifact.
- [ ] Expose authenticated model listing with version, base model, artifact, provider, GPU, runtime, cost, and creation date.
- [ ] Keep model artifacts when unrelated inference jobs are removed.

### Task 2: Reusable model input

**Files:**
- Modify: `lib/jobs.js`
- Modify: `api/jobs.js`
- Modify: `api/cloud.js`
- Modify: `api/worker-callback.js`
- Test: `scripts/gpu-workbench.test.mjs`

- [ ] Validate and persist `model_key`, `model_id`, and `preset_id` for inference jobs.
- [ ] Require the referenced model artifact to exist before creating a job.
- [ ] Download and extract the selected model artifact into `/workspace/model-artifact`.
- [ ] Export `CGR_MODEL_DIR` so inference code can locate the saved adapter.
- [ ] Account for the additional Object Storage download request.

### Task 3: 48GB-class training and inference bundle

**Files:**
- Create: `examples/qwen-lora-playground/requirements.txt`
- Create: `examples/qwen-lora-playground/train.py`
- Create: `examples/qwen-lora-playground/infer.py`
- Create: `public/playground/qwen-lora-playground.zip`

- [ ] Fine-tune `Qwen/Qwen2.5-7B-Instruct` in BF16 using LoRA rank 32 over attention and MLP projections.
- [ ] Use 2,048 Korean instruction examples, sequence length 512, gradient checkpointing, and bounded steps appropriate for one 48GB GPU.
- [ ] Save only portable adapter/tokenizer files and structured training metadata.
- [ ] Load a selected adapter for inference and emit a structured answer, latency, token count, and GPU name.

### Task 4: Model and inference UI

**Files:**
- Replace: `public/jobs.html`
- Replace: `public/jobs-app.js`
- Modify: `public/jobs.css`

- [ ] Make “새 7B 모델 학습” the paid training action with a 60-minute estimate.
- [ ] List every registered model version without exposing raw object keys or commands.
- [ ] Let the user select a model, enter a question, confirm password, and start paid inference.
- [ ] Display answer, latency, GPU, runtime, cost, training metadata, downloads, and progress.
- [ ] Preserve Korean label wrapping and cache-version protections.

### Task 5: Verification and production release

**Files:**
- Modify: `README.md`

- [ ] Run contract tests, syntax checks, secret scanning, and the full test suite.
- [ ] Render desktop and mobile states without launching paid GPU work.
- [ ] Commit, push, deploy, and verify the production alias and authenticated APIs.

