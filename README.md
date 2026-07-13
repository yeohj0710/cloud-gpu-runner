# Cloud Credit Lab Console

카카오클라우드와 네이버클라우드 크레딧을 조회하고, 비용을 미리 계산한 뒤 실제 작업을 실행하는 비공개 운영 콘솔입니다.

- 제품명: **Cloud Credit Lab**
- Production: https://cloud-credit-lab-console.vercel.app
- 호환 주소: https://work-memory-ten.vercel.app
- 현재 코드 저장소: https://github.com/yeohj0710/cloud-credit-lab-console
- 원래 실험 저장소: https://github.com/yeohj0710/cloud-credit-lab

## 프로젝트 경계

이 저장소에는 서로 다른 두 계층이 함께 있습니다.

1. `public/`, `api/`, `lib/`: 배포되는 **Cloud Credit Lab Console**
2. `work_memory/`, `gpu/`: 로컬 업무 기록 및 녹화·음성 검색 기능인 **Work Memory**

Work Memory는 Cloud Credit Lab이 크레딧을 활용하는 여러 작업 중 하나입니다. 상위 제품 이름으로 사용하지 않습니다.

기존 Vercel 주소의 `work-memory`는 북마크와 이전 작업 호환을 위해 alias로만 유지합니다. 화면, GitHub 저장소, Vercel 프로젝트와 신규 클라우드 자원 이름은 `Cloud Credit Lab`/`cloud-credit-lab-console`/`ccl-*`을 사용합니다.

## 운영 기능

- 카카오·네이버 크레딧 잔액과 사용량 원장
- 실행 전 GPU·디스크·Object Storage 예상 비용 계산
- 카카오·네이버 Object Storage 파일 관리
- 네이버 Billing 및 Server 조회
- 카카오 GPU 인스턴스 생성·자동 종료
- 안전한 클라우드 API 조회 탐색기
- **Work Memory 모듈**: 녹화·음성 파일을 `faster-whisper large-v3`로 전사하고 결과 검색

## 호환성을 위해 바꾸지 않는 내부 식별자

- 이전 호환 Vercel alias: `work-memory-ten.vercel.app`
- 세션 서명 문자열: `work-memory-authorized`
- 기존 제어 버킷 기본값: `work-memory-control`
- 기존 SSH 키페어: `work-memory`
- Python 패키지/CLI: `work_memory`, `work-memory`

이 값들을 바꾸면 기존 로그인 세션, 저장 데이터, 브라우저 업로드 CORS 또는 GPU 실행이 끊길 수 있습니다.

## 로컬 Work Memory 실행

```powershell
cd C:\dev\cloud-credit-lab-console
.\Start-WorkMemory.ps1
```

## 로컬 Python 프로젝트를 GPU에서 실행

키를 Python 코드에 넣지 않습니다. 로컬 폴더를 압축해 보호된 Cloud Credit Lab 제어면으로 보내면 네이버 또는 카카오 GPU가 실행하고 끝난 뒤 자동 반납합니다.

```powershell
cd C:\dev\cloud-credit-lab-console
.\scripts\Submit-GpuJob.ps1 `
  -ProjectPath C:\dev\my-ml-project `
  -DataPath C:\data\train.parquet `
  -Provider auto `
  -Minutes 120 `
  -Command 'pip install -r requirements.txt && python train.py --data "$CCL_DATA_FILE" --output "$CCL_OUTPUT_DIR"'
```

`auto`는 네이버 GPU가 준비돼 있으면 2026-07-31 만료 크레딧을 먼저 사용하고, 준비되지 않았으면 카카오를 사용합니다. `naver` 또는 `kakao`로 고정할 수도 있습니다.

## 테스트

```powershell
.\scripts\run-tests.ps1
node --check api/cloud.js
```
