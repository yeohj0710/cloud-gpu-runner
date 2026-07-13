# Cloud Credit Lab

> **저장소 역할:** 이 저장소는 크레딧 활용안의 조사·판정·실험 기록입니다. 실제 로그인, 비용 원장, Object Storage, GPU 실행과 Work Memory 전사를 제공하는 운영 콘솔은 [Cloud Credit Lab Console](https://cloud-credit-lab-console.vercel.app)이며 현재 소스는 [yeohj0710/cloud-credit-lab-console](https://github.com/yeohj0710/cloud-credit-lab-console)에 있습니다. 이전 `work-memory-ten.vercel.app` 주소는 호환 alias로만 유지합니다.

네이버·카카오 크레딧을 **GPT가 대신할 수 없는 클라우드 능력**에만 쓰기 위한 실험 저장소입니다.

기준은 단순합니다.

> GPT가 답을 만들 수 있는 일은 탈락. 개인 PC가 꺼져도 계속 실행되거나, 외부 저장소에서 복구되거나, 통신사·CDN·다중 리전처럼 실제 전달망이 필요한 일만 통과.

## 크레딧과 현재 결정

| 구분 | 확정 발급액 | 만료일 | 현재 결정 |
| --- | ---: | --- | --- |
| NCP 신규 크레딧 | 300,000원 | 2026-07-31 | 네이버 GPU 작업에 우선 사용 |
| NCP Greenhouse | 5,000,000원 | 2027-04-30 | 검증된 Python 학습·추론 작업에 사용 |
| KakaoCloud Boost | 10,000,000원 | 2027-05-31 | 네이버 이후 또는 카카오 GPU가 더 적합할 때 사용 |

확정 발급액은 총 15,300,000원입니다. 2026-07-13부터 운영 콘솔의 멀티클라우드 GPU 작업실을 실제 연구 코드 실행 경로로 사용합니다. 의미 없는 유휴 GPU로 소진하지 않고, 코드·데이터·결과가 남는 학습·추론 작업만 실행합니다.

카카오 Boost의 20,000,000원 선정 메일과 10,000,000원 발급 메일은 중복 합산하지 않습니다.

## 지금 통과한 4개

1. NCP Cloud Functions를 한국·싱가포르·일본에 배포해 공개 서비스 상태를 외부에서 계속 확인
2. Object Storage 객체를 실제로 다시 내려받아 SHA-256이 같은지 확인하는 복구 훈련
3. `window-back-recorder`의 비민감 샘플을 VOD Station에서 SD·HD·썸네일·HLS로 변환
4. 사용자 승인 후 SENS 테스트 번호로 장애 문자 전달과 수신 결과 확인

아래 판정은 초기 조사 당시의 결정 기록입니다. 현재 운영 콘솔은 **네이버·카카오 멀티클라우드 GPU 작업실**로 확장됐습니다. 로컬 Python 프로젝트와 데이터셋을 올리면 선택한 GPU에서 실행하고 결과를 저장한 뒤 서버를 자동 반납합니다.

## 빠른 시작

```powershell
cd C:\dev\cloud-credit-lab
npm --prefix apps/dashboard install
Copy-Item .env.example .env.local
npm run check:env:naver
npm test
```

실제 키는 `.env.local`에만 둡니다.

## 클라우드 전용 판정과 다중 리전 계획

```powershell
npm run unit:test
npm run probe:plan
```

`probe:plan`은 네트워크를 호출하지 않습니다. `cloud-functions/multi-region-probe`에 있는 NAVER Cloud Functions Action을 KR·SGN·JPN에 배포할 계획만 검증합니다.

Action은 응답 본문과 URL을 결과에 저장하지 않습니다. 대상 ID, 리전, HTTP 상태, 지연시간, 시각만 반환합니다. 대상 URL은 배포 패키지의 `targets.json`에 고정되며 실행 요청으로 덮어쓸 수 없습니다.

## private 아티팩트 업로드와 복구 검증

```powershell
npm run artifact:publish -- --provider naver --project wellnessbox-rnd --source C:\dev\wellnessbox-rnd\artifacts\reports\report.json
npm run artifact:publish:execute -- --provider naver --project wellnessbox-rnd --source C:\dev\wellnessbox-rnd\artifacts\reports\report.json

npm run artifact:verify -- --provider naver --object <object-key> --sha256 <digest>
npm run artifact:verify:execute -- --provider naver --object <object-key> --sha256 <digest>
```

보호 규칙:

- 기본값은 dry-run
- 한 번에 명시한 파일 하나만 업로드
- 기본 최대 10 MiB
- private 객체만 사용
- SHA-256 기반 중복 방지와 복구 검증
- `.env`, 키, 토큰, private key, SQLite·n8n DB, `C:\dev` 밖 파일 차단
- 텍스트 내용에서도 시크릿 패턴 검사
- 복구 파일은 디스크에 쓰지 않고 메모리에서 해시 비교

## NCP 인프라 확인

```powershell
npm run ncp:smoke
npm run ncp:cost:snapshot
npm run ncp:object-storage:smoke

npm run ncp:smoke:execute
npm run ncp:cost:snapshot:execute
npm run ncp:object-storage:smoke:execute
```

`:execute`가 없는 명령은 요청 계획만 보여줍니다. 배포 환경에서는 `DASHBOARD_RUN_TOKEN`이 없으면 실제 실행이 차단됩니다.

## 대시보드

```powershell
npm run dashboard:dev
```

대시보드는 다음을 보여줍니다.

- 확정 크레딧과 실제 승인 지출
- 보류한 예산
- GPT 대체 불가 판정 근거
- 프로젝트별 클라우드 전용 활용안
- 해제 조건과 중단 기준
- 탈락시킨 기존 아이디어
- Region·Billing·Object Storage 연결 실험

## 구조

```text
apps/dashboard                         전략·실험 대시보드
cloud-functions/multi-region-probe    KR·SGN·JPN 배포용 Action
data/                                  비밀값 없는 실행 계획 예시
docs/                                  결정 근거와 운영 기준
experiments/                           실제 실행 결과
scripts/                               검증·업로드·복구·비용 도구
```

UI reference: Toss Home web flow. Service facts: NAVER Cloud and KakaoCloud official documentation.
