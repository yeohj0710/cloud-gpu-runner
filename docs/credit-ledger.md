# Credit Ledger

Use this as the human-readable source of truth for credits.

| Provider | Credit amount | Expiration | Status | Notes |
| --- | ---: | --- | --- | --- |
| Naver Cloud Platform | 300,000 KRW | 2026-07-31 | Issued | New customer credit. Use this first. |
| Naver Cloud Platform | 5,000,000 KRW | 2027-04-30 | Issued | Greenhouse Track 1 first grant. Another 5,000,000 KRW can be requested. |
| KakaoCloud | 10,000,000 KRW | 2027-05-31 | Issued | Confirmed by the 2026-05-28 issuance email. |
| KakaoCloud Boost | 20,000,000 KRW program award | TBD | Awarded | The award email says 20,000,000 KRW. Only 10,000,000 KRW is confirmed as issued, so do not add both amounts. |

Confirmed issued total as of 2026-07-10: **15,300,000 KRW**.

## What to do first

1. Use the 300,000 KRW NCP grant before 2026-07-31 for measured OCR and HyperCLOVA X pilots.
2. Turn the NCP Object Storage smoke test into a shared artifact path for `C:\dev` projects.
3. Issue KakaoCloud IAM and S3 credentials before creating any GPU or Kubernetes resource.
4. Ask the KakaoCloud program contact when the remaining 10,000,000 KRW of the Boost award is issued.

## Update rules

- Update this file when a credit grant, expiration, or billing policy changes.
- Do not write account secrets here.
- If a service has separate free-tier limits, link or summarize them under provider docs.
- Keep program awards separate from credits confirmed in the billing console or issuance email.
