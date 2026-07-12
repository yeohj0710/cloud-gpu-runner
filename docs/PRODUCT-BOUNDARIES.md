# Product boundaries

## Cloud Credit Lab

회사 클라우드 크레딧의 잔액, 비용, 저장소, 서버와 GPU 작업을 운영하는 상위 제품입니다.

- 배포 UI: `public/`
- 서버 API: `api/`
- 클라우드 연결·원장: `lib/`
- 운영 주소: `https://work-memory-ten.vercel.app` (legacy alias)

## Work Memory

화면 기록과 녹화·음성을 검색 가능한 업무 기록으로 만드는 개별 활용 모듈입니다.

- 로컬 앱: `work_memory/`
- GPU worker: `gpu/`
- 배포 모듈 화면: `/jobs`

## 별도 저장소

`C:\dev\cloud-credit-lab`은 초기 조사·실험·Next.js 대시보드를 보존하는 별도 저장소입니다. 현재 운영 콘솔의 소스는 `C:\dev\work-memory`에 있습니다. 두 Git 저장소의 코드를 자동으로 섞거나 동시에 배포하지 않습니다.

## Legacy identifiers

`work-memory`가 포함된 배포 alias, 저장 버킷, 세션 서명, SSH 키와 Python 패키지명은 기존 데이터 및 인증 호환을 위한 내부 값입니다. 사용자 화면의 제품명이 아닙니다.
