# Naver Cloud Platform

Status: active first provider.

Known credit: about 5,300,000 KRW. Expiration date is not recorded yet.

## Credentials

Put actual values in `.env.local`.

Required for generic NCP API access:

```text
NCP_ACCESS_KEY_ID=
NCP_SECRET_KEY=
NCP_REGION=KR
NCP_API_ENDPOINT=https://ncloud.apigw.ntruss.com
NCP_BILLING_API_ENDPOINT=https://billingapi.apigw.ntruss.com
```

Optional service-specific variables:

```text
NCP_OBJECT_STORAGE_ENDPOINT=https://kr.object.ncloudstorage.com
NCP_OBJECT_STORAGE_REGION=kr-standard
NCP_OBJECT_STORAGE_ACCESS_KEY_ID=
NCP_OBJECT_STORAGE_SECRET_KEY=
NCP_CLOVASTUDIO_API_KEY=
NCP_CLOVASTUDIO_API_GATEWAY_KEY=
```

## First setup checklist

- Confirm credit amount and expiration date.
- Confirm which services the credit can actually cover.
- Create access keys with the smallest practical permission scope.
- Run `npm run check:env:naver` after filling `.env.local`.
- Run `npm run check:secrets` before committing or deploying.
- Record the first successful API call as an experiment note.

## Local setup status

- 2026-05-13: Local `.env.local` configured on `C:\dev\cloud-credit-lab`.
- 2026-05-13: `core.hooksPath` configured to `.githooks` so pre-commit runs the secret scan.
- 2026-05-13: NCP metadata smoke test succeeded with region codes `KR`, `SGN`, `JPN`.
- 2026-05-13: Billing snapshot for `202605` succeeded and returned 0 cost rows.
- 2026-05-13: Object Storage smoke test is blocked by `InvalidAccessKeyId`; likely needs Object Storage-specific S3 credentials.
- No actual key values are stored in tracked files.

## Smoke test

Use the metadata-only region list call before any paid service test.

```powershell
npm run ncp:smoke
npm run ncp:smoke:execute
```

The execute command calls `GET /vserver/v2/getRegionList?responseFormatType=json`.
Expected cost is 0 KRW because it only reads provider metadata and does not create resources.

## Billing snapshot

```powershell
npm run ncp:cost:snapshot
npm run ncp:cost:snapshot:execute
npm run ncp:cost:snapshot:execute -- --month=202605
```

The execute command reads monthly contract demand costs for one month and prints only row counts and demand totals.

## Experiment candidates

- Object Storage bucket for generated research/TIPS files.
- OCR/document extraction on sample PDFs from `C:\Users\hjyeo\Desktop\웰박\10 TIPS`.
- CLOVA Studio summarization/extraction test for R&D/reporting material.
- CDN/static delivery for generated assets.

## Object Storage smoke test

```powershell
npm run ncp:object-storage:smoke
npm run ncp:object-storage:smoke:execute
```

The execute command creates one temporary bucket, uploads one tiny text object,
downloads it for verification, deletes the object, and deletes the bucket.
This is a Tier 1 test with a 1,000 KRW cap and expected near-zero usage.

Set `NCP_OBJECT_STORAGE_ACCESS_KEY_ID` and `NCP_OBJECT_STORAGE_SECRET_KEY` in
`.env.local` before running the execute command. The generic NCP API key is not
used for this test because Object Storage's S3-compatible API may reject it.
