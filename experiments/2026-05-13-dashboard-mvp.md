# Dashboard MVP

## Summary

- Provider: Naver Cloud Platform
- Service: Next.js / Vercel-ready dashboard
- Status: done
- Date: 2026-05-13
- Cost cap: 0 KRW for app verification; NCP metadata and billing read calls only
- Related project/path: `C:\dev\cloud-gpu-runner\apps\dashboard`

## Goal

Let a user test cloud-credit use cases from a browser without exposing provider credentials to the client.

## Setup

- Env vars used:
  - `NCP_ACCESS_KEY_ID`
  - `NCP_SECRET_KEY`
  - `NCP_API_ENDPOINT`
  - `NCP_BILLING_API_ENDPOINT`
  - `NCP_OBJECT_STORAGE_ENDPOINT`
  - `DASHBOARD_RUN_TOKEN` for protected execute actions on deployed environments
- Input data:
  - NCP metadata/list calls
  - Billing month `202605`
- Minimal verification path:
  - `npm run dashboard:lint`
  - `npm run dashboard:build`
  - Playwright desktop/mobile browser check

## Result

- What worked:
  - Next.js dashboard builds and lints successfully.
  - Server API routes handle NCP region smoke test, billing snapshot, and Object Storage dry-run.
  - Browser verification executed the NCP region smoke test and parsed `KR`, `SGN`, `JPN`.
  - Desktop and mobile screenshots rendered without layout-breaking overlap.
- What failed:
  - None for the dashboard MVP.
- Actual cost/credit usage:
  - 0 KRW expected. Verification used metadata and billing read calls only.

## Next action

- Keep:
  - Server-only provider credentials.
  - `DASHBOARD_RUN_TOKEN` for Vercel deployments.
  - Dry-run first, execute second.
- Change:
  - Add Object Storage-specific S3 credentials before retrying the bucket/object execute path.
  - Add persistent experiment history later with a database only after real repeated runs exist.
- Stop:
  - Do not expose execute routes publicly without a run token.
