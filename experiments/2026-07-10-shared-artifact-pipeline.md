# Shared Project Artifact Pipeline

## Summary

- Provider: Naver Cloud Platform
- Service: Object Storage
- Status: completed
- Date: 2026-07-10
- Cost cap: one private object, <= 1,000 KRW guardrail
- Related project/path: `C:\dev\cloud-gpu-runner`

## Goal

Give projects under `C:\dev` one safe path for keeping evaluation reports and generated artifacts without uploading source trees or secrets.

## Setup

- Env vars used:
  - `NCP_OBJECT_STORAGE_ENDPOINT`
  - `NCP_OBJECT_STORAGE_REGION`
  - `NCP_OBJECT_STORAGE_ACCESS_KEY_ID`
  - `NCP_OBJECT_STORAGE_SECRET_KEY`
  - `NCP_ARTIFACT_BUCKET`
- Input data:
  - `apps/dashboard/src/data/credit-portfolio.json`, 16,029 bytes
  - SHA-256: `7638e969d8ae40fded3624662a6023c6244a31226e0e00f652168a013f2406c1`
- Minimal verification path:
  - `npm run artifact:publish -- --provider naver --project cloud-gpu-runner --source apps/dashboard/src/data/credit-portfolio.json`
  - `npm run artifact:publish:execute -- --provider naver --project cloud-gpu-runner --source apps/dashboard/src/data/credit-portfolio.json`

## Result

- What worked:
  - Dry-run printed the source, content hash, object key, size, and cost guardrail without credentials.
  - Execute mode created one private bucket and uploaded the JSON object with HTTP 200.
  - The latest object key is content-addressed: `projects/cloud-gpu-runner/2026-07-10/7638e969d8ae-credit-portfolio.json`.
  - Running the same execute command again detected the existing object and skipped the upload.
  - A signed private GET streamed 16,029 bytes with a hard size cap and matched the expected SHA-256 exactly.
- What failed:
  - Nothing in the final run.
- Actual cost/credit usage:
  - Near 0 KRW expected for one 16,029-byte private object and a handful of API calls.

## Next action

- Keep:
  - Single-file uploads, 10 MiB default cap, private ACL, content hashes, and idempotent object keys.
- Change:
  - Add a lifecycle policy only after real retention requirements are known.
  - Use the same adapter for KakaoCloud after IAM and S3 credentials are issued.
- Stop:
  - Never upload `.env`, credentials, private keys, databases, n8n runtime data, or files outside `C:\dev`.

If the persistent bucket is no longer needed, remove its objects and bucket with the NCP console or an S3-compatible client using `NCP_ARTIFACT_BUCKET`. Do not delete it while other projects still reference the shared path.
