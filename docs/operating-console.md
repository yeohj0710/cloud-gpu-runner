# 단일 저장소 운영

`C:\dev\cloud-gpu-runner`가 조사, 비용 통제, GPU 실행, 웹 현황과 결과 보존을 모두 담당합니다.

- 운영 주소: https://cloud-gpu-runner.vercel.app
- GitHub: https://github.com/yeohj0710/cloud-gpu-runner
- 공용 명령: `C:\dev\cloud-gpu-runner\scripts\cloud-gpu.ps1`

## GPU 운영 결정

- Python 프로젝트를 NAVER L4/L40S 또는 KakaoCloud NVIDIA GPU에서 실행합니다.
- `auto`는 만료가 빠른 NAVER 크레딧을 먼저 확인합니다.
- 코드·비민감 데이터·로그·결과는 Object Storage를 통해 전달합니다.
- 작업마다 최대 실행시간과 비용 한도를 적용합니다.
- 완료, 실패, 취소 또는 시간초과 후 GPU, 공인 IP와 임시 디스크 반납을 검증합니다.

## 웹 운영 경계

- 공개 페이지는 크레딧과 익명화된 사용 기록을 조회합니다.
- 관리자 페이지는 로그인 후 원본 작업과 클라우드 제어 기능을 사용합니다.
- Vercel 프로젝트와 도메인은 하나만 운영합니다.
