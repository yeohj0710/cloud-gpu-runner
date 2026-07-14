# Cloud GPU Runner Single Repository Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the research repository and production Console into `C:\dev\cloud-gpu-runner` as the only local, GitHub, and Vercel entrypoint.

**Architecture:** Preserve both Git histories with an unrelated-history merge. Keep the production runner, protected control APIs, public dashboard, provider adapters, and tests at the repository root; retain useful research documents and experiments while removing the obsolete Next.js dashboard implementation.

**Tech Stack:** PowerShell, Node.js/Vercel Functions, Python, Git, Vercel

---

### Task 1: Preserve state and merge history

**Files:**
- Modify: `.git/config`
- Preserve: `.env.local`, `config.json`

- [ ] Record clean working trees, remotes, ignored environment files, and Vercel project linkage.
- [ ] Copy Console-only ignored runtime configuration into the target without printing values.
- [ ] Merge `cloud-gpu-runner-console/main` with `--allow-unrelated-histories`.
- [ ] Resolve root contract, README, and runner-script conflicts in favor of the current production implementation.

### Task 2: Remove obsolete duplicate application

**Files:**
- Delete: `apps/dashboard/**`
- Modify: `apps/README.md`
- Modify: `package.json`

- [ ] Remove the superseded Next.js dashboard from the current tree; Git history remains the backup.
- [ ] Keep research documents, experiments, provider notes, and artifact utilities that do not duplicate production code.
- [ ] Replace obsolete package scripts with commands for the unified runner and test suite.

### Task 3: Establish one canonical entrypoint

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `vercel.json`

- [ ] State that `C:\dev\cloud-gpu-runner` is the sole project-independent Codex GPU entrypoint.
- [ ] Document public dashboard versus protected control-plane boundaries.
- [ ] Document local validation, automatic provider selection, cost approval, artifact return, and cleanup verification.
- [ ] Remove documentation references that direct users to the old Console folder or repository.

### Task 4: Verify and publish

**Files:**
- Test: `scripts/run-tests.ps1`
- Test: `scripts/dashboard.test.mjs`
- Test: `scripts/check-secrets.mjs`

- [ ] Run the full Python, Node, runner, dashboard, and secret checks from the unified root.
- [ ] Verify no paid GPU, public IP, or temporary disk remains allocated.
- [ ] Commit and push the merged history to `yeohj0710/cloud-gpu-runner`.
- [ ] Link Vercel to the unified GitHub repository and deploy the existing production alias.
- [ ] Verify anonymous dashboard access and protected administrator APIs in production.
- [ ] Remove `C:\dev\cloud-gpu-runner-console` only after all preceding checks pass.
