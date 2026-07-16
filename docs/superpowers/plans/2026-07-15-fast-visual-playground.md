# Faster Visual Playground Implementation Plan

> **For Codex:** Execute this plan in `C:\dev\cloud-gpu-runner` without a paid GPU run. Preserve the existing dirty worktree and deploy only after local verification.

**Goal:** Make the zero-preparation image experiment finish with a useful visible result without requiring a second cold-start GPU inference run.

**Architecture:** The GPU training script already renders `preview-grid.jpg` before shutdown. Reduce the default demo to one 100-step checkpoint, then make the browser display that stored training preview automatically. Keep paid custom inference available only for trying a new prompt, and keep longer training as an explicit advanced option.

**Tech Stack:** Static HTML/CSS/JavaScript, Vercel Node APIs, Python Diffusers SDXL DreamBooth LoRA, Node/Python contract tests.

---

### Task 1: Lock the fast-demo contract

- [x] Add assertions that the bundled zero-preparation demo uses 100 steps.
- [x] Add assertions that completed SDXL training opens the stored preview.
- [x] Add assertions that the UI explains the separate inference cost and delay.

### Task 2: Reduce the default experiment

- [x] Change the prepared dog demo from 400 to 100 training steps.
- [x] Update the experiment card and help copy to describe one base image and one 100-step result.
- [x] Keep 200/400/800-step custom training available under the advanced form.
- [x] Add one-click 100-step continuation for models created from the prepared example.
- [x] Rebuild the deployment ZIP from the canonical SDXL files.

### Task 3: Show the result already produced by training

- [x] Extend completed-result handling to SDXL training jobs.
- [x] Load `preview-grid.jpg` without starting a GPU.
- [x] Separate “saved training result” from optional “new prompt inference” in the UI copy.
- [x] Preserve the existing authenticated model-card preview reopening path.

### Task 4: Verify and deploy

- [x] Run focused Node and Python tests.
- [x] Run the full local test suite.
- [x] Inspect the rendered flow locally and confirm the production deployment is ready.
- [x] Confirm no paid GPU job was started.
