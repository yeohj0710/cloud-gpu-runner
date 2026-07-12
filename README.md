# Work Memory

카카오클라우드와 네이버클라우드 크레딧을 실제 업무에 사용하는 비공개 제어 콘솔입니다.

- Production: https://work-memory-ten.vercel.app
- Repository: https://github.com/yeohj0710/work-memory
- 인증: 서버 검증 비밀번호 + 서명된 HttpOnly 세션 쿠키
- 비밀키: Vercel 암호화 환경변수 및 로컬 `.env.local`에만 저장

## 운영 기능

- 카카오 Object Storage: 버킷·파일 생성, 조회, 업로드, 다운로드, 삭제
- 네이버 Object Storage: 버킷·파일 CRUD와 서명 URL 기반 대용량 직접 업로드
- 네이버 Billing: 이번 달 실제 청구 내역 조회
- 네이버 Server: 실제 서버 목록 조회
- 카카오 GPU: 사양·이미지·서브넷·키페어 조회 및 확인 절차가 있는 인스턴스 생성·삭제
- 녹화·음성 분석: 저장소 파일을 `faster-whisper large-v3` GPU 작업으로 전사하고 JSON 결과 저장
- 작업 안전장치: 최대 실행시간, 실패/완료 콜백, 인스턴스 자동 삭제 요청, 부팅 디스크 동시 삭제
- 팀 공용 비용 원장: 네이버 Object Storage에 영구 저장

## 분석 사용 순서

1. `/ncp-storage`에서 버킷을 선택하고 녹화 또는 음성 파일을 업로드합니다.
2. `/jobs`에서 해당 파일을 선택해 전사 작업을 등록합니다.
3. 메인 화면의 GPU 실행에서 작업·GPU·이미지·네트워크를 선택합니다.
4. 확인 문구 `GPU 생성에 동의합니다`를 입력하고 생성합니다.
5. 작업이 끝나면 `/jobs`에서 JSON 결과를 내려받습니다.

GPU 생성 시 즉시 과금됩니다. 작업 완료 또는 실패 콜백에서 인스턴스 삭제를 요청하지만, 공급자 장애에 대비해 실행 서버 목록도 확인해야 합니다.

## 로컬 업무기억 도구

```powershell
cd C:\dev\work-memory
.\Start-WorkMemory.ps1
```

로컬 화면 기록 원본은 직원 PC 밖으로 자동 전송하지 않습니다. 동의·제외 앱·보존기간 정책은 `config.json`에서 관리합니다.

## 테스트

```powershell
.\scripts\run-tests.ps1
node --check api/cloud.js
```
