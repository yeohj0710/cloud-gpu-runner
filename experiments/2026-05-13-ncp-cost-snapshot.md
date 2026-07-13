# NCP Cost Snapshot

## Summary

- Provider: Naver Cloud Platform
- Service: Billing / Cost and Usage
- Status: done
- Date: 2026-05-13
- Cost cap: 0 KRW expected
- Related project/path: `C:\dev\cloud-gpu-runner`

## Goal

Add a low-friction way to check current monthly billing totals before and after small cloud-credit experiments.

## Setup

- Env vars used:
  - `NCP_ACCESS_KEY_ID`
  - `NCP_SECRET_KEY`
  - `NCP_BILLING_API_ENDPOINT`
- Input data:
  - One billing month in `YYYYMM` format
- Minimal verification path:
  - `npm run ncp:cost:snapshot`
  - `npm run ncp:cost:snapshot:execute`

## Result

- What worked:
  - `npm run ncp:cost:snapshot` confirmed the billing read request plan.
  - `npm run ncp:cost:snapshot:execute` returned HTTP 200.
  - NCP returned `returnCode: 0`.
  - Query month `202605` returned 0 rows.
- What failed:
  - None.
- Actual cost/credit usage:
  - 0 KRW expected. This was a billing read call only.

## Next action

- Keep:
  - Run this before and after Tier 1 or Tier 2 experiments.
- Change:
  - Add a before/after billing snapshot to any future Tier 1 or Tier 2 experiment note.
- Stop:
  - Do not use billing totals as the only cost guard for high-volume AI or compute; set request/token/runtime caps too.
