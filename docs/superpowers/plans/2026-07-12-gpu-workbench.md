# GPU Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Cloud GPU Runner into a simple, guarded GPU workbench where a user uploads data and code, enters one command, sees the estimated maximum cost, runs it on an ephemeral Kakao GPU, and downloads logs and outputs.

**Architecture:** Keep durable inputs, job state, logs, and results in the existing Naver Object Storage control plane. Use the existing Kakao BCS VM API to create an NVIDIA image VM with cloud-init, execute the submitted bundle in an isolated working directory, upload a compressed output archive and log, call back with status, and shut down. The browser exposes one linear workflow and never receives cloud credentials.

**Tech Stack:** Vercel Functions, vanilla HTML/CSS/JavaScript, Kakao Cloud BCS, Naver Object Storage, Bash cloud-init, NVIDIA GPU VM.

---

### Task 1: General GPU job contract

**Files:**
- Modify: `lib/jobs.js`
- Modify: `api/jobs.js`

- [ ] Add a `custom-gpu` job type with code bundle, optional dataset, command, output path, provider, and execution limits.
- [ ] Validate object existence, safe paths, command length, and duration before persisting.
- [ ] Keep legacy transcription jobs readable.

### Task 2: Ephemeral worker

**Files:**
- Modify: `api/cloud.js`
- Modify: `api/worker-callback.js`

- [ ] Generate cloud-init that downloads inputs through expiring signed URLs.
- [ ] Extract the code archive, expose the dataset path, execute the command with a hard timeout, and capture a log.
- [ ] Archive the selected output directory, upload output and logs, report completion or failure, and power off.
- [ ] Preserve automatic instance cleanup and actual usage tracking.

### Task 3: One-screen workbench

**Files:**
- Replace: `public/jobs.html`
- Replace: `public/jobs-app.js`
- Replace: `public/jobs.css`
- Replace: `public/jobs-extra.css`

- [ ] Build a Korean-first four-step flow: upload, configure, estimate, run/results.
- [ ] Display provider readiness, selected file sizes, maximum price, what is charged, and automatic deletion behavior.
- [ ] Include a TIPS-specific explanation and starter command without claiming the current CPU trainer benefits from GPU.
- [ ] Support job status, cancellation, log download, result download, and clear error messages.

### Task 4: Verification and release

**Files:**
- Modify: `scripts/cloud-metadata.test.mjs`
- Modify: `README.md`

- [ ] Add contract tests for custom jobs and generated worker script safety.
- [ ] Run syntax checks and the existing test suite.
- [ ] Verify the protected production flow, commit, push, and deploy.
