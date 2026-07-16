# Zero-Prep GPU Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 이미지나 프롬프트를 준비하지 않고 버튼 한 번으로 SDXL LoRA 학습을 시작하고 체크포인트 결과를 비교하게 만든다.

**Architecture:** Hugging Face Diffusers가 공식 문서에서 사용하는 공개 강아지 예제 5장을 고정된 리비전과 SHA-256으로 GPU 서버가 직접 내려받는다. 기본 화면은 내장 예제 실행만 보여주고 기존 사용자 이미지 업로드 폼은 접힌 고급 메뉴로 유지한다.

**Tech Stack:** 정적 HTML/CSS/JavaScript, Vercel Functions, Python, Diffusers SDXL DreamBooth LoRA, NAVER L40S/Kakao A100, Object Storage

---

### Task 1: 준비물 없는 실행 계약 추가

**Files:**
- Modify: `scripts/home-playground.test.mjs`
- Modify: `scripts/gpu-workbench.test.mjs`

- [ ] **Step 1: 기본 화면 계약을 실패하는 테스트로 작성**

```js
assert.match(html, /id="visualDemoTrain"/);
assert.match(html, /id="customVisualTraining"/);
assert.match(js, /trainVisualDemo/);
assert.match(js, /CGR_DEMO=dog/);
```

- [ ] **Step 2: GPU 예제 데이터 계약을 실패하는 테스트로 작성**

```js
for (const marker of ["DEMO_DOG_IMAGES", "DEMO_DOG_REVISION", "download_demo_images", "CGR_DEMO"]) {
  assert.ok(sdxlTrain.includes(marker));
}
```

- [ ] **Step 3: 실패 확인**

Run: `node scripts/home-playground.test.mjs && node scripts/gpu-workbench.test.mjs`

Expected: `visualDemoTrain` 또는 `DEMO_DOG_IMAGES` 누락으로 실패

### Task 2: 내장 DreamBooth 예제 실행 구현

**Files:**
- Modify: `examples/sdxl-lora-playground/train.py`
- Modify: `public/home-playground.js`
- Modify: `public/playground/sdxl-lora-playground.zip`

- [ ] **Step 1: 고정 데이터 다운로드 구현**

`train.py`는 `CGR_DEMO=dog`일 때 `diffusers/dog-example`의 고정 리비전 5장을 내려받고 각 SHA-256을 검사한다. 사용자 데이터가 있으면 기존 `decode_images()`를 그대로 사용한다.

- [ ] **Step 2: 버튼 하나로 작업 생성**

`trainVisualDemo()`는 입력 데이터 업로드 없이 코드 ZIP만 Object Storage에 올리고 아래 명령으로 학습 작업을 만든다.

```text
python3 -m pip install -r requirements.txt && CGR_DEMO=dog python3 train.py
```

- [ ] **Step 3: ZIP 재생성 및 원본 일치 확인**

Run: `Compress-Archive -Path train.py,infer.py,render_comparison.py,requirements.txt -DestinationPath public/playground/sdxl-lora-playground.zip -Force`

Expected: `scripts/gpu-workbench.test.mjs` ZIP 일치 검사 통과

### Task 3: 기본 화면 단순화와 배포

**Files:**
- Modify: `public/index.html`
- Modify: `public/home-playground.css`

- [ ] **Step 1: 내장 예제를 기본 화면으로 표시**

기본 화면에는 예제 이미지, `이미 준비됨`, `400 steps`, `체크포인트 4개`와 `예제 학습 시작` 버튼만 표시한다.

- [ ] **Step 2: 직접 업로드 폼 접기**

기존 파일·트리거·프롬프트 입력은 `<details id="customVisualTraining">` 안으로 옮기고 `내 이미지로 학습하기`를 눌렀을 때만 표시한다.

- [ ] **Step 3: 데스크톱·모바일 렌더 확인**

Run: Playwright로 1440px와 390px 화면을 캡처하고 버튼, 접힌 고급 메뉴, 탭 전환을 확인한다.

- [ ] **Step 4: 전체 테스트와 프로덕션 배포**

Run: `npm test`

Expected: Node 36개와 Python 4개 통과

Run: `vercel deploy --prod --yes`

Expected: 새 배포가 `READY`이고 `cloud-gpu-runner.vercel.app` 별칭이 연결됨
