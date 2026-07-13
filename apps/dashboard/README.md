# Cloud GPU Dashboard

확정 크레딧보다 **지금 지출을 승인할 근거**를 먼저 보여주는 Next.js App Router 대시보드입니다.

## 보여주는 내용

- GPT로 대체 가능한 작업을 탈락시키는 판정 규칙
- 확정 15,300,000원 중 승인 230,000원과 보류 15,070,000원
- 다중 리전 실행, 외부 복구, 관리형 미디어, 통신사 알림 파일럿
- KakaoCloud 검색·GPU·이중화의 해제 조건
- 기존 OCR·요약·전사·무조건 GPU 계획을 제외한 이유

## 로컬 실행과 검증

```powershell
cd C:\dev\cloud-gpu-runner\apps\dashboard
npm install
npm run dev
npm run lint
npm run build
npm run verify
```

브라우저 검증 항목:

- 데스크톱·390px 모바일 전체 렌더
- 가로 overflow 없음
- schema v2 크레딧 합계와 cloud-native copy
- Region, Billing, Object Storage dry-run
- 운영 환경의 무토큰 execute 요청 HTTP 403
- 브라우저 콘솔 오류 없음

## Route Handlers

- `POST /api/ncp/region-smoke`
- `POST /api/ncp/cost-snapshot`
- `POST /api/ncp/object-storage-smoke`
- `HEAD|GET /api/health`
- `GET /api/config/status`

실제 키는 서버에서만 사용합니다. 배포 환경은 `DASHBOARD_RUN_TOKEN`이 없으면 execute를 허용하지 않습니다.
