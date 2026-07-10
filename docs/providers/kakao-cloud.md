# KakaoCloud

## 크레딧 상태

- 프로그램 선정액: 20,000,000원
- 메일로 확인된 실제 발급액: 10,000,000원
- 만료: 2027-05-31
- 미발급 가능액 10,000,000원의 조건·일정은 별도 확인 필요

확정 원장에는 10,000,000원만 포함합니다.

## 현재 결정: 전액 parked

현재 `C:\dev`에는 상시 GPU, Kubeflow, Kafka, 관리형 OpenSearch를 정당화할 부하가 없습니다. IAM과 S3 키도 아직 없습니다.

### Advanced Managed Search 해제 조건

- 공개 운영 이벤트 100,000건 이상
- SQLite/정적 JSON이 실제 latency 또는 availability 목표를 못 맞춘 측정 결과
- 7일 TTL과 삭제 자동화

KakaoCloud AMS는 다중 가용 영역 OpenSearch의 노드, 샤드, 보안, 모니터링, index lifecycle을 관리합니다. 이 운영 부담이 실제로 생기기 전에는 만들지 않습니다.

### GPU/Kubeflow 해제 조건

- `wellnessbox-rnd` training readiness가 명시적으로 `GO`
- 동일 로컬 작업이 30분 이상
- container, seed, input/output hash 고정
- 완료 후 자동 삭제

현재 프로젝트 문서의 병목은 계산량이 아니라 합성 데이터와 평가 근거입니다. 따라서 GPU 사용은 문제를 해결하지 못합니다.

### 두 번째 Object Storage 해제 조건

- NCP 단일 저장소 장애가 사업 연속성 위험이라는 근거
- Kakao IAM·S3 credential 발급
- 양쪽에서 같은 SHA-256으로 restore를 검증하는 자동 경로

공식 문서:

- [Advanced Managed Search](https://docs.kakaocloud.com/en/service/analytics/advanced-managed-search/ams-overview)
- [Object Storage](https://docs.kakaocloud.com/en/service/storage/object-storage/object-storage-overview)

## 로컬 확인

```powershell
npm run check:env:kakao
npm run kakao:token
```

실제 리소스는 위 해제 조건이 충족되기 전에는 생성하지 않습니다.
