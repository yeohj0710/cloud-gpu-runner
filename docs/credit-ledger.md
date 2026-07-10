# Credit Ledger

## 확정 발급액

| Provider | Credit | Expiration | Decision |
| --- | ---: | --- | --- |
| Naver Cloud Platform | 300,000 KRW | 2026-07-31 | Cloud-only pilots capped at 230,000 KRW |
| Naver Cloud Platform | 5,000,000 KRW | 2027-04-30 | Fully parked until the urgent pilots prove value |
| KakaoCloud | 10,000,000 KRW | 2027-05-31 | Fully parked until a measured scale bottleneck exists |

Confirmed issued total: **15,300,000 KRW**. Committed cap: **230,000 KRW**. Parked: **15,070,000 KRW**.

KakaoCloud의 20,000,000원 프로그램 선정액과 10,000,000원 발급액을 따로 더하지 않습니다. 현재 확정 발급액은 10,000,000원입니다.

## 지출 원칙

- GPT API와 현재 PC로 제공할 수 있는 결과면 클라우드 크레딧 대상에서 제외합니다.
- 다중 리전 외부 실행, 오프사이트 복구, 통신사·CDN 전달, 측정된 대규모 컴퓨팅만 후보가 됩니다.
- `free credit`은 지출 의무가 아닙니다. 실질 가치가 없으면 만료시키는 편이 운영 부채를 만드는 것보다 낫습니다.
- 제공사·grant·만료일·발급 근거는 `apps/dashboard/src/data/credit-portfolio.json`이 기계 판독 SSOT입니다.

## 추가 발급 가능성

- NCP Greenhouse 추가 5,000,000원: 첫 파일럿의 가동률·복구시간·미디어 변환 결과를 근거로 신청
- KakaoCloud 미발급 가능액 10,000,000원: 프로그램 담당자에게 지급 조건과 일정 확인

가능성은 확정 원장에 합산하지 않습니다.
