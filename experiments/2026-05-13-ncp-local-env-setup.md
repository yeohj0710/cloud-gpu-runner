# NCP Local Env Setup

## Summary

- Provider: Naver Cloud Platform
- Service: Account/API credentials
- Status: done
- Date: 2026-05-13
- Cost cap: 0 KRW
- Related project/path: `C:\dev\cloud-gpu-runner`

## Goal

Set up Naver Cloud Platform credentials locally without exposing values in tracked files or future deployments.

## Setup

- Env vars used:
  - `NCP_ACCESS_KEY_ID`
  - `NCP_SECRET_KEY`
  - `NCP_REGION`
  - `NCP_API_ENDPOINT`
  - `NCP_OBJECT_STORAGE_ENDPOINT`
- Input data: user-provided NCP access key and secret key
- Minimal verification path:
  - `.env.local` exists locally and is ignored by git
  - `npm run check:env:naver`
  - `npm run check:secrets`
  - `git config core.hooksPath .githooks`

## Result

- What worked:
  - Required NCP env vars are present locally.
  - Secret scan passes for tracked files.
  - Pre-commit hook is configured to run `npm run check:secrets`.
- What failed:
  - None.
- Actual cost/credit usage:
  - 0 KRW. No cloud API call was made.

## Next action

- Keep:
  - Store real credentials only in `.env.local` or a local secret store.
  - Keep deployment env vars separate from repo files.
- Change:
  - Add a provider-specific minimal API smoke test after choosing the first NCP service.
- Stop:
  - Do not paste or commit real key values into docs, examples, source files, or deployment previews.
