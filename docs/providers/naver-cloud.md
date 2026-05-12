# Naver Cloud Platform

Status: active first provider.

## Credentials

Put actual values in `.env.local`.

Required for generic NCP API access:

```text
NCP_ACCESS_KEY_ID=
NCP_SECRET_KEY=
NCP_REGION=KR
NCP_API_ENDPOINT=https://ncloud.apigw.ntruss.com
```

Optional service-specific variables:

```text
NCP_OBJECT_STORAGE_ENDPOINT=https://kr.object.ncloudstorage.com
NCP_CLOVASTUDIO_API_KEY=
NCP_CLOVASTUDIO_API_GATEWAY_KEY=
```

## First setup checklist

- Confirm credit amount and expiration date.
- Confirm which services the credit can actually cover.
- Create access keys with the smallest practical permission scope.
- Run `npm run check:env:naver` after filling `.env.local`.
- Record the first successful API call as an experiment note.

## Experiment candidates

- Object Storage bucket for generated files.
- OCR/document extraction on sample PDFs.
- CLOVA Studio summarization/extraction test.
- CDN/static delivery for generated assets.
