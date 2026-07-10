# NCP Object Storage Smoke Test

## Summary

- Provider: Naver Cloud Platform
- Service: Object Storage
- Status: completed
- Date: 2026-05-13, retested 2026-07-10
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
  - The 2026-07-10 retest created one bucket, uploaded and downloaded one tiny object, and deleted both resources.
  - Create returned HTTP 200, object upload and read returned HTTP 200, object deletion returned HTTP 204, and bucket deletion returned HTTP 204.
- What failed:
  - The first 2026-05-13 run returned `InvalidAccessKeyId` before S3-compatible credentials were configured.
- Actual cost/credit usage:
  - Near 0 KRW expected. The successful test retained no resources.

## Next action

- Keep:
  - Immediate cleanup after small storage tests.
- Change:
  - Keep Object Storage-specific credentials separate from generic NCP API keys.
  - Use content-addressed keys and private ACLs for persistent project artifacts.
- Stop:
  - Do not upload `.env`, OAuth credentials, private keys, n8n databases, or files outside `C:\dev`.
