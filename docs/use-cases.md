# Cloud-Only Use Cases

## 1. Multi-region outside-in monitoring

대상은 공개 health URL만입니다. NCP Cloud Functions Action을 KR·SGN·JPN에 동일하게 배포하고 15분마다 실행합니다.

저장 허용 정보:

- target ID
- region
- HTTP status
- latency
- timestamp

응답 본문과 URL은 결과에 저장하지 않습니다. 이 방식은 개인 PC가 꺼진 시간의 장애와 지역별 네트워크 차이를 관측합니다.

## 2. Restore-proven artifact vault

단순히 “업로드 성공”으로 백업을 끝내지 않습니다. private 객체를 실제 GET으로 다시 내려받고 원본 SHA-256과 일치하는지 메모리에서 확인합니다.

우선 대상:

- `wellnessbox-rnd`의 비민감 평가 보고서와 release manifest
- `studyforge`, `window-back-recorder`의 공개 release checksum/manifest
- `cloud-credit-lab`의 결정 원장

금지 대상:

- `.env`, credential, OAuth, private key
- SQLite, n8n DB, runtime state
- 원본 회사 화면 캡처와 개인정보 포함 녹화

## 3. Managed media delivery

`window-back-recorder`에서 권한이 명확하고 민감정보가 없는 10분 이하 MP4 3개만 사용합니다. SD·HD single-pass, thumbnail, HLS 재생을 확인합니다.

`n8n-youtube-shorts-automation`은 제외합니다. YouTube가 이미 인코딩과 전달망을 제공하므로 VOD Station을 붙이면 중복 비용입니다.

## 4. Carrier-backed alert delivery

SENS는 GPT가 할 수 없는 실제 SMS 전달과 수신 결과 확인을 담당합니다. 발신번호 등록과 사용자 승인 전에는 발송하지 않습니다.

후보 이벤트:

- 세 리전 중 2곳 이상에서 같은 public endpoint 장애
- `attendance`의 승인 대기처럼 사람이 바로 알아야 하는 운영 이벤트

중복 억제, 일일 상한, 수신자 승인 없이는 자동화하지 않습니다.

## Deliberate non-goals

- OCR·요약·일반 추출을 크레딧 소진 이유로 사용하지 않음
- Vercel 앱을 VM으로 옮기지 않음
- company-work-capture 원본 화면을 외부에 업로드하지 않음
- training gate가 NO-GO인 R&D에 GPU를 사용하지 않음
- 작은 데이터에 Kafka·Kubernetes·OpenSearch 클러스터를 상시 운영하지 않음
