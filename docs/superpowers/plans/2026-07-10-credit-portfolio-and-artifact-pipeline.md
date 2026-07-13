# Cloud Credit Portfolio and Artifact Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the verified Naver/Kakao credit grants into an executable portfolio: show the deadlines and best project fits, provide bounded NCP/Kakao artifact publishing, and expose safe cloud smoke tests from the dashboard.

**Architecture:** Keep `apps/dashboard/src/data/credit-portfolio.json` as the factual source for grants, allocations, and project candidates so Vercel packages it with the app. The Next.js server page imports that data and renders a static strategy section, while the existing client console remains responsible only for interactive API calls. A dependency-free CLI signs S3-compatible requests for NCP or KakaoCloud, rejects risky local files, defaults to dry-run, and requires explicit flags for persistent bucket creation or upload.

**Tech Stack:** Node.js 20+, Next.js 16 App Router, React 19, TypeScript, native `fetch`/`node:crypto`, Playwright.

---

### Task 1: Record the verified credit portfolio

**Files:**
- Create: `apps/dashboard/src/data/credit-portfolio.json`
- Modify: `data/providers.example.json`
- Modify: `docs/credit-ledger.md`
- Modify: `docs/service-candidates.md`
- Modify: `docs/use-cases.md`
- Modify: `docs/providers/kakao-cloud.md`

- [ ] **Step 1: Add exact grants and evidence status**

Record NCP 300,000 KRW through 2026-07-31, NCP 5,000,000 KRW through 2027-04-30, KakaoCloud 10,000,000 KRW issued through 2027-05-31, and KakaoCloud Boost 20,000,000 KRW awarded but not fully confirmed as issued.

- [ ] **Step 2: Add bounded allocation caps**

Allocate the expiring NCP grant first to OCR, HyperCLOVA X evaluation, Speech, and a buffer. Allocate longer grants to shared artifacts, batch jobs, search, and bounded GPU/Kubeflow work.

- [ ] **Step 3: Add project-fit decisions**

Capture concrete fits for `nutrition-safety-engine`, `otc-nutrient-safety-engine`, `wellnessbox-rnd`, `company-work-capture`, `insane-search-testbed`, `window-back-recorder`, and `n8n-youtube-shorts-automation`, including explicit non-goals.

- [ ] **Step 4: Validate the JSON**

Run:

```powershell
node -e "JSON.parse(require('fs').readFileSync('apps/dashboard/src/data/credit-portfolio.json','utf8')); console.log('credit portfolio JSON: OK')"
```

Expected: `credit portfolio JSON: OK`.

### Task 2: Build the safe multi-cloud artifact publisher

**Files:**
- Create: `scripts/lib/artifact-publish.mjs`
- Create: `scripts/cloud-artifact-publish.mjs`
- Create: `scripts/cloud-artifact-publish.test.mjs`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write failing safety and key tests**

Test these contracts with `node:test`:

```js
assert.equal(buildObjectKey({ project: "wellnessbox-rnd", digest: "abcdef123456", filename: "eval.json", date: "2026-07-10" }), "projects/wellnessbox-rnd/2026-07-10/abcdef123456-eval.json");
assert.throws(() => assertPublishableSource("C:/dev/app/.env.local"), /sensitive/i);
assert.throws(() => assertPublishableSource("C:/Users/example/file.txt"), /C:\\dev/i);
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
node --test scripts/cloud-artifact-publish.test.mjs
```

Expected: failure because the module does not exist yet.

- [ ] **Step 3: Implement planning and safety**

Implement provider env mapping, `C:\dev` containment checks, sensitive path/extension denial, 10 MiB default size cap, SHA-256 content addressing, content-type detection, and dry-run output that never prints credentials.

- [ ] **Step 4: Implement SigV4 requests**

Implement signed `HEAD` bucket/object, optional bucket `PUT`, and object `PUT` for NCP and KakaoCloud path-style S3 endpoints. Existing objects are treated as idempotent success; bucket creation requires `--create-bucket`.

- [ ] **Step 5: Run unit and dry-run verification**

Run:

```powershell
npm run artifact:test
npm run artifact:publish -- --provider naver --project cloud-gpu-runner --source apps/dashboard/src/data/credit-portfolio.json
```

Expected: all tests pass; dry-run prints provider, bucket readiness, object key, digest, size, and cost guardrail without uploading.

### Task 3: Add a capped CLOVA Studio pilot

**Files:**
- Create: `scripts/ncp-clova-studio-smoke-test.mjs`
- Modify: `.env.example`
- Modify: `scripts/check-env.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add a dry-run request**

Build one OpenAI-compatible `chat/completions` request with a short Korean extraction prompt, `temperature: 0`, and `max_tokens <= 120`.

- [ ] **Step 2: Add execute guards**

Require `NCP_CLOVASTUDIO_API_KEY` only in execute mode. Never print the key or full response metadata that may contain secrets.

- [ ] **Step 3: Verify dry-run and missing-key behavior**

Run:

```powershell
npm run ncp:clova
npm run check:env:naver
```

Expected: dry-run succeeds; environment check reports CLOVA variables as optional until provisioned.

### Task 4: Render the portfolio in the dashboard

**Files:**
- Create: `apps/dashboard/src/lib/credit-portfolio.ts`
- Create: `apps/dashboard/src/components/credit-strategy.tsx`
- Modify: `apps/dashboard/src/app/page.tsx`
- Modify: `apps/dashboard/src/components/dashboard-console.tsx`
- Modify: `apps/dashboard/src/app/globals.css`
- Modify: `apps/dashboard/scripts/verify-dashboard.mjs`

- [ ] **Step 1: Add typed portfolio loading**

Import the root JSON at build time, validate totals and allocation sums, and calculate expiry days on the server.

- [ ] **Step 2: Add strategy sections**

Render Korean copy for the urgent 2026-07-31 NCP grant, confirmed/awarded Kakao distinction, ranked project opportunities, allocation caps, completed connection checks, and blockers.

- [ ] **Step 3: Keep the experiment console isolated**

Refactor the client component to render inside the server-owned page shell. Keep provider keys server-only and retain the run-token guard.

- [ ] **Step 4: Apply the Toss reference family**

Use Pretendard-first typography, `#191f28` text, `#3182f6` accent, white/`#f9fafb` bands, restrained cards, clear Korean copy, and mobile widths based on the inspected Toss Home references.

- [ ] **Step 5: Extend browser verification**

Assert the strategy heading, exact credit amounts, project opportunity rows, dry-run interactions, no console errors, and no horizontal overflow at 390 px.

### Task 5: Verify and publish one real NCP artifact

**Files:**
- Modify locally only: `.env.local` with `NCP_ARTIFACT_BUCKET`
- Create through NCP: one private Object Storage bucket and one JSON object
- Create: `experiments/2026-07-10-shared-artifact-pipeline.md`

- [ ] **Step 1: Run the complete local gate**

Run:

```powershell
npm test
```

Expected: secret scan, env checks, unit tests, lint, build, and Playwright verification all pass.

- [ ] **Step 2: Create a bounded persistent bucket and upload**

Run the publisher with `--execute --create-bucket` against `apps/dashboard/src/data/credit-portfolio.json`. Expected storage is under 100 KiB and monthly cost is effectively negligible; no public-read ACL is set.

- [ ] **Step 3: Verify idempotency**

Run the same execute command again. Expected: object already present; no duplicate upload.

- [ ] **Step 4: Record the experiment**

Document bucket privacy, object key shape, exact commands, cost cap, result, and deletion command without recording credentials.

### Task 6: Review, push, and deploy

**Files:**
- Review all tracked changes in `C:\dev\cloud-gpu-runner`

- [ ] **Step 1: Run fresh verification**

Run `npm test`, `git diff --check`, and `npm run check:secrets`. Do not commit unless each exits 0.

- [ ] **Step 2: Review the full diff**

Check requirement coverage, server-only secret handling, persistent-resource guards, mobile layout, and compatibility with the current user changes.

- [ ] **Step 3: Commit and push**

Commit all relevant cloud-gpu-runner changes with a concise conventional commit, then push the current branch to its configured origin.

- [ ] **Step 4: Deploy a Vercel preview**

Run:

```powershell
vercel deploy C:\dev\cloud-gpu-runner\apps\dashboard -y
```

Expected: a preview URL. Do not promote to production without an explicit production request.

---

Inline execution selected because the user explicitly requested implementation, push, and deployment in the same task. No subagents are used because the active repository instructions do not authorize delegation.
