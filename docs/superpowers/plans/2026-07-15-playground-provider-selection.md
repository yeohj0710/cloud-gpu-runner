# Playground GPU Provider Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 Playground GPU를 자동 선택, 네이버 L40S, 카카오 A100 중에서 직접 고르고 선택한 공급자로만 학습·추론을 실행할 수 있게 한다.

**Architecture:** 기존 브라우저의 `loadEnvironment()`가 네이버와 카카오 준비 상태를 한 번에 읽는 구조는 유지한다. 선택값에 따라 네이버 환경, 카카오 48GB 이상 환경, 네이버 우선 자동 폴백 환경 중 하나만 반환하고, 선택 변경 시 캐시된 환경을 폐기한다. 서버의 단일 GPU 작업 제한, 비용 확인, 실행 비밀번호, 공급자별 생성 API는 그대로 사용한다.

**Tech Stack:** 정적 HTML/CSS, 브라우저 JavaScript, Node.js 계약 테스트, Vercel Functions

---

### Task 1: 공급자 선택 계약 테스트

**Files:**
- Modify: `scripts/home-playground.test.mjs`

- [ ] **Step 1: 실패하는 HTML 계약 테스트 추가**

  `playgroundProvider` 선택기에 `auto`, `naver`, `kakao` 옵션이 있고 공급자 안내 문구가 존재하는지 검사한다.

- [ ] **Step 2: 실패하는 JavaScript 계약 테스트 추가**

  선택값 검증, 선택 변경 시 환경 캐시 초기화, 명시적 네이버 선택 시 카카오 폴백 금지, 명시적 카카오 선택 시 카카오 환경 반환을 검사한다.

- [ ] **Step 3: 테스트 실패 확인**

  Run: `node scripts/home-playground.test.mjs`

  Expected: 공급자 선택기 또는 선택 분기 패턴 누락으로 실패한다.

### Task 2: 공급자 선택 UI 구현

**Files:**
- Modify: `public/index.html`
- Modify: `public/home-playground.css`

- [ ] **Step 1: 선택기 마크업 추가**

  Playground 상단에 `GPU 공급자` 레이블과 `자동 선택`, `네이버 L40S`, `카카오 A100` 옵션을 추가한다. 안내 문구는 선택만으로 비용이 발생하지 않고 실행 버튼을 눌러야 서버가 생성된다고 명시한다.

- [ ] **Step 2: 데스크톱·모바일 스타일 추가**

  기존 탭과 같은 Toss 계열 색상·모서리·간격을 사용하고, 모바일에서는 레이블과 선택기가 한 열로 배치되도록 한다.

### Task 3: 선택한 공급자만 실행하도록 연결

**Files:**
- Modify: `public/home-playground.js`

- [ ] **Step 1: 선택 상태와 안내 문구 구현**

  허용값을 `auto`, `naver`, `kakao`로 제한하고 선택에 따라 카드 배지와 설명을 갱신한다.

- [ ] **Step 2: 환경 선택 분기 구현**

  `auto`는 네이버 L40S를 우선하고 한도 부족일 때만 카카오 A100으로 폴백한다. `naver`는 네이버만 반환하고 `kakao`는 48GB 이상 카카오 GPU만 반환한다.

- [ ] **Step 3: 선택 변경 시 캐시 초기화**

  `change` 이벤트에서 `environment = null`로 만들어 다음 실행이 새 선택값을 사용하게 한다.

- [ ] **Step 4: 계약 테스트 통과 확인**

  Run: `node scripts/home-playground.test.mjs`

  Expected: `homepage playground contract tests passed`

### Task 4: 동작 및 배포 검증

**Files:**
- Verify: `public/index.html`
- Verify: `public/home-playground.js`
- Verify: `public/home-playground.css`

- [ ] **Step 1: 정적·전체 테스트 실행**

  Run: `node --check public/home-playground.js`

  Run: `npm test`

  Expected: 모든 Node·Python 테스트 통과

- [ ] **Step 2: 브라우저 검증**

  데스크톱과 모바일에서 선택기 레이아웃, 안내 문구, 선택 변경, 가로 넘침이 없는지 확인한다. GPU 실행 버튼은 누르지 않는다.

- [ ] **Step 3: 운영 배포와 상태 확인**

  승인된 기존 운영 범위에서 Vercel production에 배포하고 READY 상태와 런타임 오류가 없는지 확인한다. 커밋과 푸시는 하지 않는다.

- [ ] **Step 4: 실제 카카오 테스트 전 안전 조건 확인**

  기존 네이버·카카오 GPU가 0대인지 확인하고 예상 비용이 승인 범위에 들어오는 경우에만 카카오 A100 테스트를 실행한다. 현재 15분 예상 상한이 기본 2,000원 한도를 넘으므로 별도 비용 승인이 없으면 실행하지 않는다.
