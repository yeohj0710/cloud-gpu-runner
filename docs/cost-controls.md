# Cost Controls

## 지출 전 4단계 문

1. **GPT 대체 문:** 범용 GPT나 기존 로컬 도구로 충분하면 탈락
2. **중복 문:** Vercel, GitHub, YouTube가 이미 같은 역할을 하면 탈락
3. **증거 문:** 현재 프로젝트에 측정된 외부 실행·복구·전달·규모 병목이 없으면 보류
4. **종료 문:** 비용 상한, 기간, 삭제 방법, 중단 기준이 없으면 실행 금지

## 예산 등급

| Tier | Limit | Example | Rule |
| --- | ---: | --- | --- |
| 0 | 0 KRW expected | dry-run, metadata, billing read | 기본 허용 |
| 1 | 1,000 KRW 이하 | 작은 Object Storage 왕복 | 실험 기록 필요 |
| 2 | 10,000 KRW 이하 | 짧은 복구 훈련 | 실행 전 입력·삭제 범위 확인 |
| 3 | 10,000 KRW 초과 | 다중 리전, VOD, SENS 파일럿 | 명시된 portfolio cap 안에서만 |
| 4 | Persistent cluster/GPU | AMS, GPU, Kubeflow | unlock 조건 전부 충족 전 금지 |

## 현재 승인 한도

- KR·SGN·JPN 프로브: 80,000원
- Object Storage 복구 훈련: 50,000원
- VOD Station 3파일 파일럿: 70,000원
- 승인된 SENS 테스트 문자: 30,000원
- NCP 긴급 크레딧 잔여 70,000원: 보류
- NCP Greenhouse와 KakaoCloud: 전액 보류

유료 리소스는 생성 즉시 과금될 수 있습니다. VOD 채널, VM, 클러스터는 시험 종료와 함께 삭제해야 합니다.
