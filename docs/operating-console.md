# 운영 콘솔과 이 저장소의 관계

- **이 저장소 (`cloud-credit-lab`)**: 활용안 조사, 비용 근거, dry-run, 실험 결과
- **운영 콘솔 (`cloud-credit-lab-console` 저장소)**: 인증된 웹 UI, 실제 공급자 API, 비용 원장, 저장소, 네이버·카카오 GPU 실행
- **Work Memory**: 운영 콘솔 안에서 GPU 크레딧을 사용하는 녹화·음성 검색 모듈

운영 주소: https://work-memory-ten.vercel.app

## 2026-07-13 GPU 운영 결정

- 같은 Python 프로젝트를 네이버 L4/L40S 또는 카카오 NVIDIA GPU에서 실행합니다.
- `auto`는 준비된 네이버 GPU를 우선 선택합니다. 신규고객 Plus 크레딧의 만료일이 2026-07-31로 가장 빠르기 때문입니다.
- 입력 코드·데이터·로그·결과는 네이버 Object Storage를 공통 아티팩트 저장소로 사용합니다.
- 작업마다 최대 실행시간과 예상 비용을 표시하고, 완료·실패·취소·시간초과 때 서버와 임시 네트워크 자원을 자동 반납합니다.
- 로컬 프로젝트에는 클라우드 키를 넣지 않습니다. `Submit-GpuJob.ps1`이 보호된 운영 콘솔에 프로젝트를 제출합니다.

이전 `work-memory-ten.vercel.app` alias는 먼저 만들어진 Work Memory 앱에서 운영 콘솔이 확장된 흔적입니다. 사용자 화면, GitHub 저장소와 Vercel 프로젝트는 Cloud Credit Lab Console로 통일했고, 이전 alias만 기존 북마크 호환을 위해 유지합니다.
