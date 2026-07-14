# Capability-First GPU Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent paid cloud GPUs that do not materially exceed the local RTX 5070 Ti 16GB and select only 48GB-or-larger NVIDIA accelerators.

**Architecture:** Add one shared policy module that classifies NAVER and Kakao flavors by accelerator model, count, and VRAM. Apply it at catalog/readiness, CLI selection, estimate/status, and server-side creation so clients cannot bypass the policy. Keep the existing credit, single-instance, timeout, and cleanup guards.

**Tech Stack:** Node.js ES modules, Vercel Functions, PowerShell CLI, Node test runner.

---

### Task 1: Shared capability policy

**Files:**
- Create: `lib/gpu-policy.js`
- Test: `scripts/gpu-policy.test.mjs`

- [ ] Write tests proving NAVER L4 and Kakao T4 are rejected while NAVER L40S and Kakao A100 are allowed.
- [ ] Implement normalized metadata and `assertHighValueCloudGpu` with a 48GB minimum.
- [ ] Run `node --test scripts/gpu-policy.test.mjs`; expect all tests to pass.

### Task 2: Enforce policy at every paid creation boundary

**Files:**
- Modify: `api/ncp-gpu.js`
- Modify: `api/cloud.js`
- Modify: `lib/ncp-gpu.js`
- Modify: `scripts/Submit-GpuJob.ps1`
- Modify: `scripts/Get-CloudCreditStatus.ps1`

- [ ] Filter readiness to eligible accelerators and expose rejected local-equivalent options separately.
- [ ] Reject direct create requests for ineligible GPU flavors before provisioning.
- [ ] Change auto selection from cheapest GPU to cheapest eligible 48GB+ GPU.
- [ ] Display eligible accelerator count in status.

### Task 3: Documentation, regression, and deployment

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/PRODUCT-BOUNDARIES.md`
- Modify: `scripts/agent-entrypoint.test.mjs`
- Modify: `scripts/gpu-workbench.test.mjs`

- [ ] Document local-first and capability-first invariants.
- [ ] Run `npm test`; expect Node and Python suites to pass.
- [ ] Run `git diff --check`; expect no output.
- [ ] Commit, push `main`, deploy the existing Vercel project, and verify production plus zero paid resources.
