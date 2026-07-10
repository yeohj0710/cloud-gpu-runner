# Work Memory

직원 화면 기록을 **감시 점수**가 아니라 검색 가능한 업무 기억, 업무일지, 장애 재현 자료로 바꾸는 로컬 우선 사내 도구입니다.

현재 완성된 범위:

- `C:\dev\company-work-capture`의 JSONL 캡처 기록 증분 수집
- 직원 동의 전 수집 차단 및 동의/철회 이력
- 비밀번호 관리자·인증 창·설정된 민감 제목 자동 제외
- SQLite FTS5 기반 앱/창 제목 검색
- 연속 작업을 앱별 업무 세션으로 자동 묶기
- 오늘 기록 수, 세션 수, 최초/최종 기록 시간 표시
- 검색·상세보기·삭제·GPU 작업 생성 감사 로그
- 카카오 A100 분석용 bounded dry-run 명세 생성
- 반응형 로컬 웹 대시보드
- 네이버·카카오 1,530만원 크레딧 원장, 공급자별 잔액과 만료 크레딧
- 확정 청구액·예상 작업액·수동 조정을 분리한 사용 내역과 14일 추세

## 1분 실행

화면 수집기는 기존 도구를 사용합니다.

```powershell
cd C:\dev\company-work-capture
.\Start-Capture.bat
```

Work Memory 실행:

```powershell
cd C:\dev\work-memory
.\Start-WorkMemory.ps1
```

브라우저에서 `http://127.0.0.1:8765`가 열립니다. 처음에는 화면 아래의 `수집에 동의`를 누른 후 `지금 기록 가져오기`를 누릅니다.

## CLI

```powershell
python -m work_memory init
python -m work_memory consent agree
python -m work_memory ingest
python -m work_memory search "배포 오류"
python -m work_memory gpu-job --limit 1000
python -m work_memory billing
python -m work_memory add-usage naver "Object Storage" 1200 --kind actual
python -m work_memory serve
```

## 개인정보와 운영 원칙

- 원본 화면은 기본적으로 직원 PC의 CompanyWorkCapture 데이터 폴더에만 있습니다.
- 이 앱은 동의가 없거나 철회된 상태에서 새 기록을 읽지 않습니다.
- `config.json`의 `excluded_apps`, `excluded_title_keywords`를 회사 환경에 맞게 늘리세요.
- 기본 원본 보존기간 표시는 7일입니다. 실제 원본 삭제는 캡처 앱 또는 별도 Windows 예약 작업에 연결해야 합니다.
- 기록 메타데이터 삭제는 대시보드에서 가능하며 원본 파일은 캡처 앱 보존정책을 따릅니다.
- 근무 참고 구간은 최초/최종 캡처 시간일 뿐 출퇴근 확정이나 인사평가 점수가 아닙니다.
- 소규모 회사의 전원 동의가 있더라도 목적, 열람자, 보존기간, 철회 방법은 사내 문서로 남기세요.

## GPU 연결

대시보드의 `작업 명세 만들기`는 `gpu/jobs/latest.json`만 생성하며 카카오 VM을 만들거나 비용을 발생시키지 않습니다.

실제 연결 전 확인:

1. 카카오클라우드 IAM 키, VPC, 서브넷, 키페어 준비
2. A100 VM 이미지에서 OCR/비전 임베딩 모델 고정
3. 입력 버킷과 결과 버킷을 private로 제한
4. 작업 명세를 `execute`로 승격하는 별도 관리자 승인 추가
5. 최대 240분 종료 타이머와 작업 완료 후 VM 삭제 자동화
6. 샘플 100장으로 정확도·처리시간·실제 차감액 확인 후 확대

기본 `gpu/worker.py`는 `mode=execute`와 `WORK_MEMORY_ALLOW_EXECUTE=YES`가 모두 없으면 실행을 거부합니다.

## 크레딧 사용액 동기화

현재 대시보드는 확정 지급된 15,300,000원을 자동 등록하고 수동 사용액·예상액·조정을 지원합니다. 네이버 자동 동기화는 공식 `getDemandCostList` Billing API를 연결하도록 데이터 구조가 준비돼 있습니다. 카카오 사용액은 계정용 Billing API 권한과 단가를 확인하기 전까지 임의 추정하지 않습니다.

- NCP Cost and Usage API: https://api.ncloud-docs.com/docs/en/platform-costandusage
- NCP getDemandCostList: https://api.ncloud-docs.com/docs/en/platform-costandusage-getdemandcostlist

## 테스트

```powershell
.\scripts\run-tests.ps1
```
