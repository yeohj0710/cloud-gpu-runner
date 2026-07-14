# Paid GPU Playground Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing GPU workbench safe to use as a paid training playground by requiring password `0903` immediately before any GPU is provisioned, and fix the GitHub repository homepage link.

**Architecture:** Keep the existing upload, training, progress, artifact, and inference-ready command workflow. Add a server-side paid-execution password check at both provider provisioning boundaries and a browser prompt before uploads begin; the browser check is convenience, while provider APIs remain the authoritative enforcement point.

**Tech Stack:** Vercel Functions, vanilla HTML/CSS/JavaScript, Node.js tests, GitHub CLI.

---

### Task 1: Paid execution password contract

**Files:**
- Modify: `lib/auth.js`
- Modify: `scripts/auth.test.mjs`

- [ ] Add constant-time verification using `EXECUTION_PASSWORD`, falling back to the existing `APP_PASSWORD`.
- [ ] Add tests for accepted, rejected, and missing execution passwords.

### Task 2: Provider-side enforcement

**Files:**
- Modify: `api/cloud.js`
- Modify: `api/ncp-gpu.js`
- Modify: `scripts/gpu-workbench.test.mjs`

- [ ] Reject Kakao instance creation unless the request contains the execution password.
- [ ] Reject NAVER GPU creation unless the request contains the execution password.
- [ ] Keep readiness, status, cancellation, and artifact access unchanged.

### Task 3: Workbench confirmation

**Files:**
- Modify: `public/jobs.html`
- Modify: `public/jobs-app.js`
- Modify: `public/jobs.css`

- [ ] Show a password dialog with the selected provider and estimated maximum cost before upload or provisioning.
- [ ] Send the entered password only with the provider launch request and clear it after the request finishes.
- [ ] Explain that a successful confirmation starts real billing and consumes cloud credit.

### Task 4: Canonical URL and verification

**Files:**
- Modify: `README.md`

- [ ] Set the GitHub repository homepage URL to `https://cloud-gpu-runner.vercel.app/`.
- [ ] Document `EXECUTION_PASSWORD=0903` as a deployment secret without committing the password to browser code.
- [ ] Run focused tests, secret scanning, and the complete test suite.

