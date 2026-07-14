# NAVER GPU And Credit Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove NAVER GPU jobs complete end-to-end while preventing new paid GPU creation when recorded credit cannot cover the bounded job.

**Architecture:** Keep provider provisioning unchanged except for a shared preflight guard. Normalize NAVER resource identifiers at the API boundary, calculate a server-side maximum estimate, compare it with authoritative recorded remaining credit, then reject before any instance call. Verify with contract tests and one bounded real NAVER smoke job.

**Tech Stack:** Node.js ES modules, Vercel Functions, PowerShell CLI, NAVER Cloud VPC GPU API, existing S3 control store.

---

### Task 1: Reproduce NAVER configuration failure

**Files:**
- Modify: `scripts/ncp-gpu.test.mjs`
- Modify: `lib/ncp-gpu.js`

- [ ] Add a regression test proving numeric/string resource identifiers resolve to the same VPC, subnet, and ACG.
- [ ] Run `node --test scripts/ncp-gpu.test.mjs`; expect failure before implementation.
- [ ] Add one identifier-normalization helper and use it for all NAVER resource matches.
- [ ] Re-run the focused test; expect pass.

### Task 2: Add provider-side credit creation guard

**Files:**
- Create: `lib/spend-guard.js`
- Modify: `api/ncp-gpu.js`
- Modify: `api/cloud.js`
- Modify: `scripts/gpu-workbench.test.mjs`

- [ ] Add failing tests for zero/negative remaining credit, insufficient remaining credit, expired credit, and adequate credit.
- [ ] Implement `assertCreditCoversEstimate({ provider, estimate, remaining, expiresAt, now })`; reject unless remaining is positive, unexpired, and at least the full maximum estimate plus a conservative reserve.
- [ ] Invoke guard inside both provider creation APIs before any instance-creation request.
- [ ] Re-run focused tests; expect pass.

### Task 3: Align CLI preflight and status semantics

**Files:**
- Modify: `scripts/Submit-GpuJob.ps1`
- Modify: `scripts/Get-CloudCreditStatus.ps1`
- Modify: `scripts/agent-entrypoint.test.mjs`

- [ ] Add contract assertions that CLI refuses when remaining credit cannot cover maximum estimate and labels readiness as configuration readiness, not execution proof.
- [ ] Implement the CLI preflight refusal before project packaging/upload.
- [ ] Run relevant Node contract tests; expect pass.

### Task 4: Verify locally and deploy

**Files:**
- Preserve: `public/dashboard-improvements.css`
- Preserve: `scripts/dashboard.test.mjs`

- [ ] Run `npm test` and `git diff --check`.
- [ ] Commit all scoped fixes, push `main`, and wait for Vercel production `READY`.
- [ ] Verify `/`, `/api/public-dashboard`, unauthenticated `/api/jobs`, and public-response secret-field exclusions.

### Task 5: Run bounded NAVER smoke job

**Files:**
- Create via runner: `artifacts/cloud-gpu/<job-id>/job.json`
- Create via runner: `artifacts/cloud-gpu/<job-id>/run.log`
- Create via runner: `artifacts/cloud-gpu/<job-id>/result.tar.gz`

- [ ] Create a non-sensitive minimal CUDA project whose command runs `nvidia-smi`, validates CUDA visibility, and writes a result file.
- [ ] Run with provider `naver`, one cheapest L4 GPU, 15-minute maximum, and approved maximum cost below 2,000 KRW + VAT.
- [ ] Wait for terminal completion and download evidence.
- [ ] Confirm actual duration/cost/remaining credit and zero unintended GPU instances, public IPs, temporary disks, and unfinished jobs.

### Task 6: Final production verification

**Files:**
- No additional files unless verification exposes a defect.

- [ ] Re-run `npm test`, `git diff --check`, Git HEAD/origin equality, deployment commit/READY, and production HTTP checks.
- [ ] Report job ID, provider, runtime, estimate, actual cost, remaining credit, artifact path, cleanup state, and credit-exhaustion behavior.

