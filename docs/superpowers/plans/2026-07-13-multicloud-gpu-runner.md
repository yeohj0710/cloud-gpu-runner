# Multi-cloud GPU Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the same uploaded Python project on NAVER Cloud GPU or KakaoCloud GPU, prioritizing NAVER credits that expire first while preserving cost and cleanup controls.

**Architecture:** Keep NAVER Object Storage as the artifact plane. Add a provider-neutral job model and a dedicated NAVER VPC GPU adapter that discovers GPU images/specs and account networking, creates an init script and ephemeral GPU VM, then stops/terminates the VM after callback or timeout. The browser selects `auto`, `naver`, or `kakao`; auto ranks expiry, availability, data locality, and estimated cost.

**Tech Stack:** Vercel Functions, Node.js ES modules, NAVER Cloud VPC API, KakaoCloud BCS API, S3-compatible Object Storage, vanilla HTML/CSS/JS.

---

### Task 1: Provider-neutral contracts and pricing

**Files:**
- Modify: `lib/jobs.js`
- Modify: `lib/usage.js`
- Test: `scripts/gpu-workbench.test.mjs`

- [ ] Add `provider`, provider configuration, and expiry-priority fields to custom GPU jobs.
- [ ] Add official NAVER L4/L40S hourly prices and provider-aware estimates.
- [ ] Test provider validation, NAVER estimates, and auto-selection metadata.

### Task 2: NAVER GPU adapter

**Files:**
- Create: `lib/ncp-gpu.js`
- Create: `api/ncp-gpu.js`
- Modify: `lib/ncp-cloud.js`
- Test: `scripts/ncp-gpu.test.mjs`

- [ ] Implement signed form/query requests and deterministic response parsing.
- [ ] Discover KR GPU images/specs, VPC, subnet, ACG, and login key without creating resources.
- [ ] Create init script and hourly GPU VM with public IP and preinstalled driver.
- [ ] Poll lifecycle, then stop, terminate, and remove init script idempotently.
- [ ] Expose authenticated readiness/create/delete actions.

### Task 3: Unified worker lifecycle and accounting

**Files:**
- Modify: `api/worker-callback.js`
- Modify: `api/cleanup.js`
- Modify: `api/jobs.js`
- Modify: `api/estimate.js`
- Create: `lib/gpu-resources.js`

- [ ] Route cleanup to the job provider.
- [ ] Record provider-specific GPU, disk, network, and Object Storage costs.
- [ ] Preserve artifacts, logs, cancellation, timeouts, and idempotency for both clouds.

### Task 4: Simple local-project workflow

**Files:**
- Modify: `public/jobs.html`
- Modify: `public/jobs-app.js`
- Modify: `public/jobs.css`
- Create: `scripts/Submit-GpuJob.ps1`
- Modify: `README.md`

- [ ] Add auto/NAVER/Kakao provider cards with expiry, readiness, GPU, and estimates.
- [ ] Keep ZIP upload but add a PowerShell command that archives the current Python project, uploads it, and starts a job.
- [ ] Display exact environment variables, command examples, live stages, provider, estimated cost, actual cost, and cleanup state.
- [ ] Verify responsive Korean UI against Toss typography and spacing references.

### Task 5: Verification and release

**Files:**
- Modify: `docs/PRODUCT-BOUNDARIES.md`
- Modify: `C:/dev/cloud-credit-lab/docs/operating-console.md`
- Modify: `C:/dev/cloud-credit-lab/README.md`

- [ ] Run syntax, contract, Python, authentication, and full repository tests.
- [ ] Deploy production and run authenticated read-only NAVER readiness checks.
- [ ] Run one minimal GPU smoke only if an available NAVER GPU spec and all prerequisites are returned.
- [ ] Confirm no GPU VM/public IP/init script remains after smoke.
- [ ] Commit and push both repositories, then inspect production deployment status.
