# Cloud Credit Dashboard

크레딧 만료일, 프로젝트별 활용 순서, 비용 상한, 실제 provider 연결 상태를 한 화면에서 확인하는 Next.js App Router 대시보드입니다.

## 로컬 실행

```powershell
cd C:\dev\cloud-credit-lab\apps\dashboard
npm install
npm run dev
```

## 검증

```powershell
npm run lint
npm run build
npm run verify
```

브라우저 검증은 production build를 임시 포트에서 실행한 뒤 다음을 확인합니다.

- desktop/mobile 전체 화면 렌더
- 390px 화면의 가로 overflow 없음
- 크레딧 합계와 프로젝트 우선순위 표시
- Region, Billing, Object Storage, CLOVA Studio dry-run
- 브라우저 콘솔 오류 없음

## 버튼

- `계획 보기`: 로컬 Route Handler에서 요청 계획만 반환합니다. 클라우드 API를 호출하지 않습니다.
- `실행`: 서버에서 실제 API를 호출합니다.
- 배포 환경에서는 `DASHBOARD_RUN_TOKEN`이 없으면 실행할 수 없습니다.

## 환경 변수

앱은 아래 순서로 환경 변수를 읽습니다.

1. `C:\dev\cloud-credit-lab\.env.local`
2. `C:\dev\cloud-credit-lab\apps\dashboard\.env.local`
3. `process.env`

키 값은 브라우저로 보내지 않고 설정 여부만 표시합니다.

## Route Handlers

- `POST /api/ncp/region-smoke`
- `POST /api/ncp/cost-snapshot`
- `POST /api/ncp/object-storage-smoke`
- `POST /api/ncp/clova-studio-smoke`
- `GET /api/config/status`

Reference basis: Toss Home web flow.
