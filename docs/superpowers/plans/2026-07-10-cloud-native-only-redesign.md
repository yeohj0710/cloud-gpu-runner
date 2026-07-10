# Cloud-Native-Only Credit Strategy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic-AI credit plan with a portfolio, dashboard, and executable probes that only approve capabilities a GPT API or local script cannot provide by itself.

**Architecture:** Keep the credit facts and cloud-native decision gates in one versioned JSON file packaged with the dashboard. Validate that file in both Node tests and the Next.js loader, ship a dependency-free NAVER Cloud Functions action for multi-region uptime checks, and extend the existing S3-compatible publisher with an actual remote restore-integrity check. Remove CLOVA/OCR/LLM execution paths from the active product.

**Tech Stack:** Node.js 24, Node test runner, Next.js 16 App Router, React 19, NAVER Cloud Functions Node action contract, S3-compatible SigV4, Playwright, Vercel preview deployments.

---

## File Structure

- Modify `apps/dashboard/src/data/credit-portfolio.json`: schema v2 facts, cloud-only gates, ranked pilots, rejected generic-AI ideas, parked budgets.
- Modify `apps/dashboard/src/lib/credit-portfolio.ts`: schema v2 types and runtime validation.
- Modify `apps/dashboard/src/components/credit-strategy.tsx`: cloud-only dashboard narrative and launch gates.
- Modify `apps/dashboard/src/components/dashboard-console.tsx`: remove CLOVA experiment and AI-specific result fields.
- Modify `apps/dashboard/scripts/verify-dashboard.mjs`: assert the new strategy copy and three infrastructure dry-runs.
- Delete `apps/dashboard/src/app/api/ncp/clova-studio-smoke/route.ts`: remove generic LLM execution from active dashboard.
- Delete `apps/dashboard/src/lib/ncp/clova-studio.ts`: remove generic LLM client.
- Delete `scripts/ncp-clova-studio-smoke-test.mjs`: remove generic LLM CLI.
- Create `scripts/lib/cloud-native-gate.mjs`: portfolio spend-gate validator.
- Create `scripts/cloud-native-gate.test.mjs`: reject GPT-substitutable, unbounded, or internally inconsistent opportunities.
- Create `cloud-functions/multi-region-probe/index.js`: deployable KR/SGN/JPN external uptime probe action.
- Create `cloud-functions/multi-region-probe/package.json`: NAVER module package entry point.
- Create `scripts/multi-region-probe.test.mjs`: deterministic probe action tests with a fake fetch implementation.
- Create `data/cloud-native-probes.example.json`: non-secret monitored endpoint contract.
- Create `scripts/cloud-native-probe-plan.mjs`: validate and print the three-region cron deployment plan without provisioning by default.
- Modify `scripts/lib/artifact-publish.mjs`: remote object download and SHA-256 integrity verification.
- Create `scripts/cloud-artifact-verify.mjs`: dry-run-first restore drill CLI.
- Extend `scripts/cloud-artifact-publish.test.mjs`: remote restore-integrity tests.
- Modify root and provider/use-case docs: explain why generic AI was removed and when parked Kakao credit can unlock.

### Task 1: Make GPT substitutability a hard portfolio gate

- [ ] Write tests that reject `gptSubstitute: true`, missing cloud-only capabilities, missing stop rules, and allocation mismatches.
- [ ] Run `node --test scripts/cloud-native-gate.test.mjs` and confirm the tests fail because the validator does not exist.
- [ ] Implement `validateCloudNativePortfolio()` and `summarizeCommittedBudget()` in `scripts/lib/cloud-native-gate.mjs`.
- [ ] Replace the portfolio with schema v2 and run the tests until they pass.

### Task 2: Ship a real multi-region execution unit

- [ ] Write fake-fetch tests for success, timeout/failure isolation, HTTPS-only validation, and response-body exclusion.
- [ ] Run `node --test scripts/multi-region-probe.test.mjs` and confirm failure before implementation.
- [ ] Implement the NAVER action as `exports.main = main`, returning only status, latency, region, and timestamp.
- [ ] Add a dry-run deployment-plan CLI covering Korea, Singapore, and Japan cron triggers.
- [ ] Run the tests and `node scripts/cloud-native-probe-plan.mjs`.

### Task 3: Turn Object Storage into a verified restore path

- [ ] Add tests that accept a matching downloaded SHA-256 and reject mismatches or oversized objects.
- [ ] Run the focused artifact test and confirm failure before implementation.
- [ ] Export a signed remote GET verifier from `scripts/lib/artifact-publish.mjs`.
- [ ] Add `scripts/cloud-artifact-verify.mjs`, defaulting to dry-run and requiring `--execute` for a network read.
- [ ] Upload the final portfolio and run a real remote SHA-256 restore verification against NAVER Object Storage.

### Task 4: Replace the dashboard and active execution surface

- [ ] Remove CLOVA files, package commands, environment keys, and the fourth experiment card.
- [ ] Add schema v2 types and server-side validation in the dashboard loader.
- [ ] Rewrite the strategy page around three cloud-only capabilities: multi-region presence, off-device recovery, and managed media delivery/notification.
- [ ] Show parked Kakao budget and explicit unlock conditions instead of pretending it should be spent now.
- [ ] Update Toss-inspired responsive styles and browser assertions.

### Task 5: Rewrite operating documentation

- [ ] Update `README.md`, provider notes, service candidates, use cases, cost controls, and the credit ledger.
- [ ] Record the redesign and completed restore drill in `experiments/`.
- [ ] Make every official service claim link to current NAVER or Kakao documentation.

### Task 6: Verify, review, publish

- [ ] Run `npm test` and inspect the full result.
- [ ] Request a repository diff review and fix all Critical/Important findings.
- [ ] Run `npm test`, `git diff --check`, and the secret scanner again after review fixes.
- [ ] Commit, push `main`, and create a new Vercel preview deployment.

## Self-Review

- Spec coverage: the plan removes GPT-replaceable work, corrects project mismatches, implements two genuinely off-device capabilities, rewrites the UI/docs, and includes push/deploy.
- Placeholder scan: no TBD/TODO implementation placeholders are present.
- Type consistency: schema v2 uses the same `gptSubstitute`, `cloudExclusiveCapability`, `unlockConditions`, `pilot`, `budgetCapKrw`, and `stopRule` fields in validator and dashboard types.
