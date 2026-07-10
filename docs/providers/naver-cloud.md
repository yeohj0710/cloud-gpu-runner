# Naver Cloud Platform

확정 크레딧:

- 300,000원, 2026-07-31 만료
- 5,000,000원, 2027-04-30 만료
- Greenhouse 추가 5,000,000원은 별도 신청 가능성

## 현재 역할

NCP는 범용 AI 공급자가 아니라 첫 **외부 실행·복구·전달 인프라** 공급자로 사용합니다.

- Cloud Functions: KR·SGN·JPN cron probe
- Object Storage: private upload와 실제 restore hash check
- VOD Station: 관리형 인코딩·thumbnail·HLS
- SENS: 승인된 테스트 SMS와 수신 결과

공식 문서:

- [Cloud Functions overview](https://guide.ncloud-docs.com/docs/en/cloudfunctions-overview)
- [Node.js Action contract](https://guide.ncloud-docs.com/docs/en/cloudfunctions-example-nodejs)
- [Current runtime support](https://guide.ncloud-docs.com/docs/en/cloudfunctions-spec-runtime) — Node.js 22
- [VOD Station product](https://www.ncloud.com/api-cms/service-product/static/newVodStation)
- [SENS overview](https://guide.ncloud-docs.com/docs/sens-overview)

## 환경 변수

```text
NCP_ACCESS_KEY_ID=
NCP_SECRET_KEY=
NCP_REGION=KR
NCP_API_ENDPOINT=https://ncloud.apigw.ntruss.com
NCP_BILLING_API_ENDPOINT=https://billingapi.apigw.ntruss.com
NCP_OBJECT_STORAGE_ENDPOINT=https://kr.object.ncloudstorage.com
NCP_OBJECT_STORAGE_REGION=kr-standard
NCP_OBJECT_STORAGE_ACCESS_KEY_ID=
NCP_OBJECT_STORAGE_SECRET_KEY=
NCP_ARTIFACT_BUCKET=
```

## 확인된 상태

- Region API: HTTP 200, KR·SGN·JPN 확인
- Billing snapshot: 2026-07 비용 0원
- Object Storage: create·put·get·delete 성공
- private content-addressed object 업로드 성공
- restore SHA-256 CLI와 Cloud Functions Action package 구현

## 다음 외부 설정

1. 공개 health URL을 확정
2. `cloud-functions/multi-region-probe`를 KR·SGN·JPN에 배포
3. 15분 Cron Trigger 설정
4. 비민감 영상 3개를 고른 뒤 VOD 채널을 파일럿 기간에만 생성
5. SENS는 발신번호·수신자·문구 승인 후 3건만 발송

CLOVA Studio/OCR/Speech는 크레딧 우선순위에서 제거했습니다.
