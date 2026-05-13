# Cloud Credit Lab

네이버클라우드플랫폼, 카카오클라우드 등에서 받은 크레딧을 실제로 써보면서
서비스 후보, API 키, 비용, 실험 결과를 정리하는 연구/회사 R&D repo입니다.

## 현재 설계 판단

지금은 Next.js/Vercel 앱을 바로 만들지 않습니다.

이유:
- 아직 시각화할 데이터 모델과 실험 지표가 확정되지 않았습니다.
- 먼저 크레딧 만료일, 서비스 후보, API 키, 실험 기록이 안정적으로 쌓여야 합니다.
- Next.js를 먼저 만들면 대시보드 구조가 실험 방향을 불필요하게 고정할 수 있습니다.

대신 `apps/` 폴더를 비워두었습니다. 나중에 실제로 보여줄 데이터가 생기면
`apps/dashboard`에 Next.js 앱을 추가하고 Vercel 배포를 붙이면 됩니다.

## 현재 활용 우선순위

1. 연구/지원사업 자료 작업
   - 실제 대상 폴더: `C:\Users\hjyeo\Desktop\웰박\10 TIPS`
   - TIPS/R&D 문서, 실험 자료, 보고서, 근거 정리, OCR/요약/추출 자동화 후보
2. 회사 내부 기능 실험
   - 문서 처리, 파일 저장, 알림, 관리자용 배치 작업, AI 요약/분류 같은 공통 기능
3. 서비스 후보 탐색
   - 여러 클라우드 크레딧을 비교하면서 실제로 재사용 가능한 워크플로우를 찾기

## 빠른 시작

```powershell
cd C:\dev\cloud-credit-lab
Copy-Item .env.example .env.local
notepad .env.local
npm run check:env:naver
```

`.env.local`은 git에 올라가지 않게 막아두었습니다. 실제 API 키는 그 파일에만 넣으세요.

## 로컬 안전장치

```powershell
npm run check:secrets
npm run check:safety
git config core.hooksPath .githooks
```

`check:secrets`는 tracked/staged 파일에 실제 키처럼 보이는 값이 들어갔는지 확인합니다.
로컬 `.env.local`은 배포/커밋 대상이 아니며, 배포 환경에는 필요한 변수 이름만 별도로 등록하세요.

## 폴더 구조

```text
apps/dashboard         Next.js 실험 콘솔
data/                  provider/experiment 예시 데이터
docs/                  설계 문서와 provider별 메모
experiments/           실험 기록 템플릿과 실제 실험 노트
scripts/               로컬 점검 스크립트
.env.example           필요한 환경변수 이름만 정리한 예시
```

## Dashboard

```powershell
npm run dashboard:dev
npm run dashboard:build
```

대시보드는 `apps/dashboard`에 있으며 Vercel 배포를 염두에 둔 Next.js App Router 앱입니다.
NCP 호출은 브라우저가 아니라 서버 API route에서만 실행됩니다.
Vercel에 배포할 때는 `DASHBOARD_RUN_TOKEN`을 환경변수로 설정하고, 실행 버튼을 누르는 사용자만 같은 토큰을 입력하세요.

## 운영 원칙

- 실제 키, 토큰, secret은 `.env.local` 또는 로컬 secret store에만 둡니다.
- 크레딧을 쓰는 실험은 먼저 무료/최소 호출로 API 연결을 확인합니다.
- 비용 한도와 중단 조건은 [docs/cost-controls.md](docs/cost-controls.md)에 맞춰 정합니다.
- 실험마다 목적, 사용 서비스, 예상 비용, 결과, 다음 액션을 `experiments/`에 남깁니다.
- 서비스 비교는 "멋있어 보이는 기능"보다 실제로 재사용 가능한 워크플로우 중심으로 봅니다.
- 현재 Naver Cloud Platform 크레딧은 약 5,300,000 KRW로 기록합니다.

## Next.js를 붙이는 기준

다음 중 2개 이상이 생기면 `apps/dashboard`를 만드는 편이 좋습니다.

- provider별 크레딧 잔액/만료일을 표로 보고 싶다.
- 실험 결과를 날짜/서비스/비용 기준으로 필터링하고 싶다.
- 외부 API 호출 결과를 시각화해야 한다.
- Vercel에 배포해서 모바일에서도 빠르게 확인하고 싶다.

그 전까지는 Markdown + JSON + 작은 스크립트가 더 빠릅니다.
