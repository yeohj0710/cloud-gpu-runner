# NCP Object Storage Smoke Test

## Summary

- Provider: Naver Cloud Platform
- Service: Object Storage
- Status: blocked
- Date: 2026-05-13
- Cost cap: Tier 1, <= 1,000 KRW
- Related project/path: `C:\dev\cloud-credit-lab`

## Goal

Verify that Object Storage can create a bucket, store a small generated artifact, retrieve it, and clean up without leaving persistent resources.

## Setup

- Env vars used:
  - `NCP_ACCESS_KEY_ID`
  - `NCP_SECRET_KEY`
  - `NCP_OBJECT_STORAGE_ENDPOINT`
  - `NCP_OBJECT_STORAGE_REGION`
  - `NCP_OBJECT_STORAGE_ACCESS_KEY_ID` / `NCP_OBJECT_STORAGE_SECRET_KEY` if the generic NCP key is not accepted by the S3-compatible API
- Input data:
  - One generated text object under 1 KB
- Minimal verification path:
  - `npm run ncp:object-storage:smoke`
  - `npm run ncp:object-storage:smoke:execute`

## Result

- What worked:
  - Dry-run completed and showed the planned temporary bucket/object workflow.
  - The execute path attempted only the create-bucket step.
  - No bucket or object was created.
- What failed:
  - Create bucket returned HTTP 403 with `InvalidAccessKeyId`.
  - The generic NCP IAM key works for NCP API Gateway metadata calls, but was not accepted by Object Storage's S3-compatible API.
- Actual cost/credit usage:
  - 0 KRW expected. The request failed before creating storage resources.

## Next action

- Keep:
  - Immediate cleanup after small storage tests.
- Change:
  - Add Object Storage-specific credential env vars and retry after those values are available.
  - Keep the execute path blocked until those S3-compatible credentials are set.
- Stop:
  - Do not keep a bucket alive until there is a named artifact workflow and retention rule.
