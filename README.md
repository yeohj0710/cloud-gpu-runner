# Cloud Credit Lab

네이버·카카오 클라우드 크레딧을 실제 프로젝트 성과로 바꾸기 위한 실험 저장소입니다. 모든 유료 호출은 기본값이 dry-run이고, 비용 상한과 중단 기준이 있는 작업만 실행합니다.

## 지금 가진 크레딧

| 구분 | 확인된 발급액 | 만료일 | 지금 할 일 |
| --- | ---: | --- | --- |
| NCP 신규 크레딧 | 300,000원 | 2026-07-31 | OCR·HyperCLOVA X 평가에 먼저 사용 |
| NCP Greenhouse | 5,000,000원 | 2027-04-30 | 공용 문서 처리·스토리지·배치 작업 |
| KakaoCloud Boost | 10,000,000원 | 2027-05-31 | IAM 키 발급 후 R&D GPU 실험 |

카카오 Boost 선정 메일의 20,000,000원과 실제 발급 메일의 10,000,000원은 중복 합산하지 않습니다. 현재 확인된 발급액은 총 15,300,000원입니다. 자세한 근거와 배분안은 `apps/dashboard/src/data/credit-portfolio.json`과 `docs/credit-ledger.md`에 있습니다.

## 빠른 시작

```powershell
cd C:\dev\cloud-credit-lab
npm --prefix apps/dashboard install
Copy-Item .env.example .env.local
notepad .env.local
npm run check:env:naver
npm test
```

실제 키는 `.env.local`에만 둡니다. 이 파일은 Git에서 제외됩니다.

## 자주 쓰는 명령

```powershell
npm run check:safety
npm run ncp:smoke
npm run ncp:cost:snapshot
npm run ncp:object-storage:smoke
npm run ncp:clova
npm run dashboard:dev
npm test
```

`:execute`가 없는 명령은 요청 계획만 보여줍니다.

## 공용 아티팩트 보관

`C:\dev` 아래의 평가 보고서나 생성 결과 한 파일을 NCP/KakaoCloud S3 호환 스토리지에 올릴 수 있습니다.

```powershell
npm run artifact:publish -- --provider naver --project wellnessbox-rnd --source C:\dev\wellnessbox-rnd\artifacts\reports\report.json
npm run artifact:publish:execute -- --provider naver --project wellnessbox-rnd --source C:\dev\wellnessbox-rnd\artifacts\reports\report.json
```

보호 규칙:

- 한 번에 한 파일만 업로드
- 기본 최대 10 MiB
- private ACL만 사용
- SHA-256 기반 키로 중복 업로드 방지
- 텍스트 파일은 키·토큰·private key 패턴을 내용에서도 검사
- `.env`, OAuth/secret/token 파일, private key, SQLite·n8n DB, `C:\dev` 밖의 파일 차단
- archive·key-container 파일은 차단하고, PDF·미디어 같은 바이너리는 경로·확장자 규칙만 적용
- 새 버킷 생성은 `--create-bucket`을 명시한 첫 실행에서만 허용

## NCP 연결 실험

```powershell
npm run ncp:smoke:execute
npm run ncp:cost:snapshot:execute
npm run ncp:object-storage:smoke:execute
npm run ncp:clova:execute
```

- Region: 읽기 전용, 0원 예상
- Billing: 읽기 전용, 0원 예상
- Object Storage: 임시 버킷·객체를 만들고 검증한 뒤 즉시 삭제
- CLOVA Studio: 합성 제품 라벨 1건, 출력 120토큰 상한

## KakaoCloud 상태

조직·프로젝트 식별자는 설정돼 있지만 IAM access key와 S3 자격 증명이 없습니다. 키 발급 전에는 VM, Kubernetes, Kubeflow 리소스를 만들지 않습니다.

```powershell
npm run check:env:kakao
npm run kakao:token
```

설정 순서는 `docs/providers/kakao-cloud.md`에 있습니다.

## 대시보드

```powershell
npm run dashboard:dev
```

대시보드에는 크레딧 만료일, 프로젝트별 활용 순위, 예산 상한, 중단 기준, 실제 연결 실험이 함께 표시됩니다. `계획 보기`는 클라우드를 호출하지 않습니다. `실행`은 서버 Route Handler에서만 키를 사용하며 브라우저에는 키를 보내지 않습니다.

## 폴더

```text
apps/dashboard   Next.js 전략·실험 대시보드
data/            크레딧 원장과 프로젝트 배분 데이터
docs/            서비스 조사와 운영 기준
experiments/     실행 일자별 결과
scripts/         안전 검사와 provider smoke test
```

Reference basis: Toss Home web flow + Tossfeed practical guide prose.
