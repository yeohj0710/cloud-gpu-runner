# Cloud-Native-Only Portfolio Redesign

## Summary

- Date: 2026-07-10
- Status: locally implemented and verified; provider-console deployment remains gated
- Trigger: the previous plan mostly proposed work a general GPT could already perform
- New hard rule: active opportunities must have `gptSubstitute: false`

## Repository findings that changed the plan

- `wellnessbox-rnd`: the current blocker is synthetic-data/evidence quality and its training gate is `NO-GO`; GPU is not the next solution.
- `insane-search-testbed`: it is a public-web reachability/fetch escalation testbed, not a search engine; managed vector search was a project mismatch.
- `n8n-youtube-shorts-automation`: YouTube already transcodes and distributes the uploaded MP4; adding VOD Station would duplicate an existing platform capability.
- `window-back-recorder`: unlike the Shorts pipeline, it can have a genuine multi-device playback need, so it is the bounded VOD candidate.

## Approved initial cap

- Multi-region outside-in probes: 80,000 KRW
- Restore-proven private storage: 50,000 KRW
- VOD Station sample conversion: 70,000 KRW
- Approved SENS delivery test: 30,000 KRW
- Total committed cap: 230,000 KRW
- Total parked: 15,070,000 KRW

## Implemented evidence

- schema v2 budget and GPT-substitutability validator
- NAVER Cloud Functions Node action for KR/SGN/JPN deployment
- dry-run deployment plan with no response-body or URL retention
- private Object Storage remote GET/SHA-256 verification path
- real NAVER private restore: HTTP 200, 16,029 bytes, SHA-256 match
- review hardening: canonical Kakao bucket variable, streaming restore cap, deployment-bound probe targets, private/metadata URL rejection

## External actions still gated

- Deploy three Actions and Cron Triggers in the NAVER console.
- Create a VOD Station channel only after selecting three non-sensitive sample videos and confirming pricing.
- Do not send SENS messages until the sender number, receiver, and exact test text are approved.
- Do not create KakaoCloud persistent resources until their measured unlock conditions are met.
