# Cloud Credit Lab Console

카카오클라우드와 네이버클라우드 크레딧을 조회하고, 비용을 미리 계산한 뒤 실제 작업을 실행하는 비공개 운영 콘솔입니다.

- 제품명: **Cloud Credit Lab**
- Production: https://work-memory-ten.vercel.app
- 현재 코드 저장소: https://github.com/yeohj0710/work-memory
- 원래 실험 저장소: https://github.com/yeohj0710/cloud-credit-lab

## 프로젝트 경계

이 저장소에는 서로 다른 두 계층이 함께 있습니다.

1. `public/`, `api/`, `lib/`: 배포되는 **Cloud Credit Lab Console**
2. `work_memory/`, `gpu/`: 로컬 업무 기록 및 녹화·음성 검색 기능인 **Work Memory**

Work Memory는 Cloud Credit Lab이 크레딧을 활용하는 여러 작업 중 하나입니다. 상위 제품 이름으로 사용하지 않습니다.

GitHub 저장소 slug와 Vercel 주소의 `work-memory`는 기존 배포·환경변수·Object Storage CORS·GPU 콜백 호환을 위해 유지하는 레거시 식별자입니다. 화면과 신규 클라우드 자원 이름은 `Cloud Credit Lab`/`ccl-*`을 사용합니다.

## 운영 기능

- 카카오·네이버 크레딧 잔액과 사용량 원장
- 실행 전 GPU·디스크·Object Storage 예상 비용 계산
- 카카오·네이버 Object Storage 파일 관리
- 네이버 Billing 및 Server 조회
- 카카오 GPU 인스턴스 생성·자동 종료
- 안전한 클라우드 API 조회 탐색기
- **Work Memory 모듈**: 녹화·음성 파일을 `faster-whisper large-v3`로 전사하고 결과 검색

## 호환성을 위해 바꾸지 않는 내부 식별자

- Vercel alias: `work-memory-ten.vercel.app`
- 세션 서명 문자열: `work-memory-authorized`
- 기존 제어 버킷 기본값: `work-memory-control`
- 기존 SSH 키페어: `work-memory`
- Python 패키지/CLI: `work_memory`, `work-memory`

이 값들을 바꾸면 기존 로그인 세션, 저장 데이터, 브라우저 업로드 CORS 또는 GPU 실행이 끊길 수 있습니다.

## 로컬 Work Memory 실행

```powershell
cd C:\dev\work-memory
.\Start-WorkMemory.ps1
```

## 테스트

```powershell
.\scripts\run-tests.ps1
node --check api/cloud.js
```
