# Architecture

## Decision boundary

The repository is an evidence gate, not a catalog of things cloud vendors sell.

An active opportunity must include all of these:

1. `gptSubstitute: false`
2. a concrete `cloudExclusiveCapability`
3. measurable `unlockConditions`
4. a `budgetCapKrw`
5. a `stopRule`

`scripts/lib/cloud-native-gate.mjs` validates those constraints and keeps committed plus parked budgets equal to confirmed grants.

## Layers

1. **Portfolio SSOT**
   - `apps/dashboard/src/data/credit-portfolio.json`
   - issued grants, expiration, committed cap, parked amount, opportunities, rejected ideas

2. **Cloud execution packages**
   - `cloud-functions/multi-region-probe`: dependency-free NAVER Action for KR/SGN/JPN
   - targets are bound in the deployment package and cannot be overridden by runtime parameters
   - output excludes response bodies and endpoint URLs

3. **Offsite durability tools**
   - `scripts/cloud-artifact-publish.mjs`: private, content-addressed upload
   - `scripts/cloud-artifact-verify.mjs`: private GET and in-memory SHA-256 restore proof

4. **Provider safety surface**
   - metadata, billing, and temporary Object Storage smoke tests
   - dry-run by default
   - deployed execute requests protected by `DASHBOARD_RUN_TOKEN`

5. **Dashboard**
   - Next.js Server Component loads the validated portfolio
   - Client Component contains only interactive provider smoke tests
   - provider credentials never enter browser props

## Active data flow

```text
public HTTPS health endpoints
  -> Cloud Functions in KR / SGN / JPN
  -> status + latency + region only
  -> later: private Object Storage history
  -> later and approved: SENS outage alert

selected non-sensitive artifact
  -> local secret/path/size scan
  -> private content-addressed Object Storage upload
  -> signed GET restore
  -> SHA-256 equality proof
```

## Parked architecture

KakaoCloud Advanced Managed Search, GPU, Kubeflow, and second-provider storage are intentionally absent from runtime. They unlock only after the portfolio's measured thresholds are met.

## Decision log

- 2026-05-13: dashboard added after NCP auth and billing checks.
- 2026-07-10: shared private artifact publisher validated against NCP Object Storage.
- 2026-07-10: generic AI plan rejected; OCR, summarization, transcription, and premature GPU/search work removed.
- 2026-07-10: schema v2 introduced with a hard GPT-substitutability gate and parked-budget accounting.
