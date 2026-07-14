# One-click AI Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the upload-first GPU workbench with a ready-made AI experiment that trains an MNIST model and shows real inference results after one button press.

**Architecture:** Ship a versioned PyTorch experiment bundle with the site. The browser automatically uploads that bundle to the existing private object storage, creates a bounded custom GPU job, asks for the paid-execution password, and launches the eligible provider; completed logs are parsed into accuracy and prediction UI while raw logs and model artifacts remain downloadable.

**Tech Stack:** Vercel Functions, vanilla HTML/CSS/JavaScript, Python, PyTorch, NAVER/Kakao GPU workers, Node.js tests.

---

### Task 1: Ready-made experiment

**Files:**
- Create: `examples/mnist-playground/train_and_infer.py`
- Create: `examples/mnist-playground/requirements.txt`
- Create: `public/playground/mnist-playground.zip`

- [ ] Train a deterministic CUDA MNIST classifier for three epochs.
- [ ] Emit machine-readable epoch metrics and ten sample predictions to stdout.
- [ ] Save `model.pt`, `metrics.json`, and `predictions.json` under `$CGR_OUTPUT_DIR`.
- [ ] Package the source as a versioned static ZIP consumed automatically by the browser.

### Task 2: Result API

**Files:**
- Modify: `api/jobs.js`
- Modify: `scripts/gpu-workbench.test.mjs`

- [ ] Add an authenticated `log-text` action that returns a bounded UTF-8 log for a completed job.
- [ ] Preserve attachment downloads and existing authorization.
- [ ] Add contract checks for the preset bundle and result markers.

### Task 3: One-button Korean UI

**Files:**
- Replace: `public/jobs.html`
- Replace: `public/jobs-app.js`
- Replace: `public/jobs.css`

- [ ] Present one prepared “손글씨 숫자 AI” experiment with model, dataset, runtime, and expected output explained.
- [ ] Resolve provider and estimate automatically without exposing uploads, commands, GPU flavors, disks, or paths.
- [ ] On click, ask for password, upload the bundled experiment, create and launch the paid GPU job.
- [ ] Show provisioning/training/completion states, epoch accuracy, ten predictions, actual cost, downloads, cancellation, and retry.

### Task 4: Verification and deployment

**Files:**
- Modify: `README.md`

- [ ] Document the one-click playground and its real billing behavior.
- [ ] Run syntax checks, secret scan, full tests, and desktop/mobile browser screenshots.
- [ ] Commit, push, and deploy to the production alias after visual verification.

