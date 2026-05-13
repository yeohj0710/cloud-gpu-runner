# NCP Auth Smoke Test

## Summary

- Provider: Naver Cloud Platform
- Service: VPC Server API metadata
- Status: done
- Date: 2026-05-13
- Cost cap: 0 KRW expected
- Related project/path: `C:\dev\cloud-credit-lab`

## Goal

Verify that local NCP credentials can sign and call a metadata-only API before running any paid service experiment.

## Setup

- Env vars used:
  - `NCP_ACCESS_KEY_ID`
  - `NCP_SECRET_KEY`
  - `NCP_API_ENDPOINT`
- Input data: none
- Minimal verification path:
  - `npm run ncp:smoke`
  - `npm run ncp:smoke:execute`

## Result

- What worked:
  - `npm run ncp:smoke` confirmed the request plan without calling NCP.
  - `npm run ncp:smoke:execute` returned HTTP 200.
  - NCP returned `returnCode: 0`.
  - Available region codes parsed from the response: `KR`, `SGN`, `JPN`.
- What failed:
  - None.
- Actual cost/credit usage:
  - 0 KRW expected. This was a metadata/list call only.

## Next action

- Keep:
  - Metadata-only calls as the first step for new provider integrations.
- Change:
  - Next small paid-capable test should use an explicit Tier 1 cap and clean up created resources immediately.
- Stop:
  - Do not create persistent resources until a Tier 1 experiment note exists.
