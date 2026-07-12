# 운영 콘솔과 이 저장소의 관계

- **이 저장소 (`cloud-credit-lab`)**: 활용안 조사, 비용 근거, dry-run, 실험 결과
- **운영 콘솔 (`work-memory` 저장소)**: 인증된 웹 UI, 실제 공급자 API, 비용 원장, 저장소, GPU 실행
- **Work Memory**: 운영 콘솔 안에서 GPU 크레딧을 사용하는 녹화·음성 검색 모듈

운영 주소: https://work-memory-ten.vercel.app

현재 `work-memory`라는 저장소와 Vercel alias는 이전에 먼저 만들어진 Work Memory 앱에서 운영 콘솔이 확장된 결과입니다. 사용자 화면의 상위 제품명은 Cloud Credit Lab으로 통일합니다. 기존 버킷, 세션 서명, GPU 콜백과 CORS를 보호하기 위해 내부 slug는 즉시 변경하지 않습니다.
