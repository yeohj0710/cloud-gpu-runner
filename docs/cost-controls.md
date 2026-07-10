# Cost Controls

This repo can spend cloud credits for real tests, but every experiment should be intentionally small.

## Budget tiers

| Tier | Limit | Use when | Approval |
| --- | ---: | --- | --- |
| 0 | 0 KRW expected | Auth checks, metadata/list APIs, dry runs | OK by default |
| 1 | Up to 1,000 KRW | One-off service smoke tests with tiny inputs | OK after writing an experiment note |
| 2 | Up to 10,000 KRW | Small proof-of-concept with real sample data | Confirm before running |
| 3 | Over 10,000 KRW | Anything that creates persistent compute, GPU, DB, or high-volume AI calls | Explicit approval only |

## Default rules

- Prefer list/read APIs before create/update/delete APIs.
- Every paid or credit-consuming script should have a dry-run mode.
- Every create script should print the planned resource, region, and cost cap before execution.
- Set a stop condition before running: max files, max rows, max tokens, max runtime, or max KRW.
- Delete or scale down temporary resources immediately after the experiment unless the note says why they remain.
- Record actual result and estimated cost in `experiments/`.

## Current safe first path

1. NCP auth smoke test: `npm run ncp:smoke`
2. Execute metadata-only call: `npm run ncp:smoke:execute`
3. Check billing snapshot: `npm run ncp:cost:snapshot:execute`
4. Pick one Tier 1 service test:
   - Object Storage: create one test bucket/object, then delete it.
   - CLOVA Studio: summarize one short sample text with a small token cap.
   - OCR/document extraction: run one short sample document only.

## Current next path

1. NCP: subscribe to Cloud Functions, then add hello-world create/invoke/delete smoke test.
2. NCP: subscribe to CLOVA Studio only when ready to run one token-capped prompt.
3. KakaoCloud: create a project, assign the current user as Project Admin, issue an IAM access key, then run `npm run kakao:token:execute`.
