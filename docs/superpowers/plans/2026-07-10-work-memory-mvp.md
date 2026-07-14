# Work Memory MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 CompanyWorkCapture 기록을 실제로 검색하고 업무 세션·일일 요약·관리자 타임라인으로 활용하는 로컬 우선 사내 업무기억 시스템을 만든다.

**Architecture:** 캡처 원본은 직원 PC에 남기고 이 저장소는 JSONL 매니페스트만 SQLite로 증분 수집한다. Python 표준 라이브러리 HTTP 서버가 검색·설정·동의·감사 API와 반응형 웹 UI를 제공하며, GPU 작업은 입력 목록과 안전 제한을 가진 내보내기 패키지로 분리한다.

**Tech Stack:** Python 3.14, SQLite/FTS5, Python unittest, HTML/CSS/JavaScript, PowerShell, Docker.

---

### Task 1: 저장소와 데이터 계약

**Files:** `pyproject.toml`, `work_memory/config.py`, `work_memory/db.py`, `tests/test_db.py`

- [ ] 설정 기본값과 로컬 데이터 경로를 정의한다.
- [ ] SQLite 스키마, FTS 검색, 동의·감사 로그 저장 테스트를 먼저 작성한다.
- [ ] 테스트가 실패하는지 확인한 뒤 최소 구현으로 통과시킨다.

### Task 2: 캡처 증분 수집과 업무 세션화

**Files:** `work_memory/ingest.py`, `work_memory/sessions.py`, `tests/test_ingest.py`

- [ ] CompanyWorkCapture JSONL 샘플을 이용한 증분·중복·제외 앱 테스트를 작성한다.
- [ ] 앱/창 제목과 시간 간격을 기준으로 세션을 생성한다.
- [ ] 같은 매니페스트를 다시 읽어도 데이터가 늘지 않는지 검증한다.

### Task 3: 로컬 API와 대시보드

**Files:** `work_memory/server.py`, `work_memory/static/index.html`, `work_memory/static/app.js`, `work_memory/static/styles.css`

- [ ] 요약, 타임라인, 검색, 설정, 동의, 삭제, 내보내기 API를 구현한다.
- [ ] 녹화 상태·오늘 업무·검색·개인정보 설정·GPU 작업을 한 화면에 제공한다.
- [ ] 모바일 390px에서 가로 넘침 없이 사용할 수 있게 한다.

### Task 4: GPU 배치와 운영 안전장치

**Files:** `work_memory/gpu.py`, `gpu/Dockerfile`, `gpu/worker.py`, `config.example.json`

- [ ] 원본 파일 해시와 최대 파일 수를 포함한 GPU 작업 명세를 만든다.
- [ ] 기본 dry-run, 4시간 TTL, 비공개 결과 경로를 강제한다.
- [ ] 실행 명세 검증 테스트를 추가한다.

### Task 5: 실행·검증·문서화

**Files:** `Start-WorkMemory.ps1`, `scripts/run-tests.ps1`, `README.md`, `.gitignore`

- [ ] 한 번의 명령으로 DB 초기화·수집·서버 실행이 되게 한다.
- [ ] 전체 단위 테스트와 실제 HTTP smoke test를 실행한다.
- [ ] 민감정보, 직원 동의, 보존기간, 카카오 GPU 연결 절차를 문서화한다.
- [ ] 커밋하고 원격이 있을 때만 push한다.

