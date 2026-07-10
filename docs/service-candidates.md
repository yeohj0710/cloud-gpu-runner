# Cloud-Native Service Candidates

## 통과한 서비스

| Priority | Projects | Service | GPT가 대신 못 하는 결과 | First proof |
| ---: | --- | --- | --- | --- |
| 1 | 여러 공개 앱, `insane-search-testbed` | NCP Cloud Functions KR·SGN·JPN | PC와 분리된 24시간 리전별 네트워크 관측 | 3 URLs × 3 regions × 7 days |
| 2 | R&D reports, release manifests | NCP Object Storage | PC 고장과 분리된 private 복구와 SHA-256 증명 | 10 uploads, 3 random restores |
| 3 | `window-back-recorder` | NCP VOD Station + Global Edge | 관리형 다중 해상도·thumbnail·HLS·CDN | 3 non-sensitive videos |
| 4 | `attendance`, uptime probes | NCP SENS | 통신사 SMS 전달과 실제 단말 수신 결과 | 3 approved messages |

Cloud Functions는 공식 문서상 한국·싱가포르·일본 리전과 Cron/Object Storage/API Gateway trigger를 지원합니다. VOD Station은 인코딩·thumbnail·HLS/DASH·CDN 연동을 제공합니다. SENS는 SMS·알림톡과 발송 결과 조회를 제공합니다.

## 지금은 보류한 KakaoCloud

| Service | Unlock threshold | 현재 판단 |
| --- | --- | --- |
| Advanced Managed Search | 운영 이벤트 100,000건 이상 + 로컬 검색 SLA 실패 | 데이터 규모 부족 |
| GPU VM / Kubeflow | R&D training gate GO + 로컬 30분 이상 + 자동 삭제 | 현재 병목은 데이터·증거 |
| Object Storage second copy | NCP 단일 장애가 사업 연속성 위험 + IAM/S3 keys | 중요도 근거 부족 |

관리형이라는 사실만으로 가치가 생기지 않습니다. 클러스터 운영을 외부화할 만큼 데이터와 SLA가 커졌을 때만 엽니다.

## 탈락한 기존 후보

- CLOVA OCR·Studio: 범용 GPT로 대체 가능
- CLOVA Speech: 범용 음성 모델로 대체 가능하고 현재 병목 아님
- `insane-search-testbed`용 벡터 검색: 프로젝트 정체를 잘못 해석한 안
- `n8n-youtube-shorts-automation`용 VOD: YouTube가 이미 변환·배포
- 상시 GPU·Kubernetes·Kafka: 현재 규모에서 운영 부채만 증가
