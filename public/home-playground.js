(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const won = (value) => `${Math.round(Number(value || 0)).toLocaleString("ko-KR")}원`;
  const minutes = (seconds) => seconds ? `${Math.max(1, Math.round(Number(seconds) / 60))}분` : "기록 중";
  const ACTIVE = new Set(["queued", "provisioning", "running"]);
  const TERMINAL = new Set(["completed", "failed", "cancelled"]);
  const PROVIDERS = new Set(["auto", "naver", "kakao"]);
  const ACTION_BUTTONS = ["#visualDemoTrain", "#visualTrain", "#playgroundTrain", "#visualInfer", "#playgroundInfer"];
  const PRESETS = {
    "sdxl-lora-v1": { kind: "image", bundle: "/playground/sdxl-lora-playground.zip?v=5", filename: "sdxl-lora-playground.zip" },
    "qwen-lora-v1": { kind: "text", bundle: "/playground/qwen-lora-playground.zip?v=2", filename: "qwen-lora-playground.zip" },
  };
  let activePreset = "sdxl-lora-v1", publicModels = [], publicJobs = {}, selectedModelId = "", resumeModelId = "";
  let environment = null, pollTimer = null, publicPollTimer = null, settlementPolls = 0;
  const currentJobs = {};
  const shownResults = new Set();
  let activityTimer = null, activityStartedAt = 0, activityDetail = "", activityAnchor = null;

  async function api(url, options = {}) {
    const response = await fetch(url, { headers: { "content-type": "application/json" }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`);
    return data;
  }

  function message(target, text) { $(target).textContent = text; }
  function friendly(error) {
    if (/3010022|\[5001\]/i.test(error.message)) return "네이버 GPU와 서브넷의 지원 지역이 맞지 않아 서버 생성이 거절됐어요.";
    if (/^kakao_gpu_unavailable/i.test(error.message)) return "카카오 A100을 할당받지 못했어요. 다른 가용 영역을 확인하거나 잠시 후 다시 시도해주세요.";
    return ({ invalid_password: "비밀번호가 올바르지 않아요.", execution_password_invalid: "실행 비밀번호가 올바르지 않아요.", another_gpu_job_active: "이미 실행 중인 GPU 작업이 있어요.", credit_insufficient: "남은 크레딧이 부족해요.", naver_gpu_quota_unavailable: "네이버 GPU 한도가 없어 다른 공급자를 확인할게요.", kakao_gpu_unavailable: "카카오 A100 GPU를 현재 생성할 수 없어요.", kakao_gpu_activation_timeout: "카카오 GPU 준비가 지연돼 자동으로 취소했어요.", model_not_found: "저장된 모델을 찾지 못했어요.", checkpoint_not_found: "선택한 체크포인트를 찾지 못했어요." }[error.message] || error.message);
  }

  function resolveProgressAnchor(anchor) {
    if (typeof anchor === "string") return $(anchor);
    return anchor instanceof Element ? anchor : null;
  }
  function setButtonsBusy(busy, anchor = activityAnchor) {
    const activeButton = resolveProgressAnchor(anchor);
    const buttons = ACTION_BUTTONS.map((selector) => $(selector)).filter(Boolean);
    if (activeButton && !buttons.includes(activeButton)) buttons.push(activeButton);
    buttons.forEach((button) => {
      button.disabled = busy;
      button.classList.toggle("is-loading", busy && button === activeButton);
      button.setAttribute("aria-busy", String(busy && button === activeButton));
    });
  }
  function placeProgress(anchor) {
    const button = resolveProgressAnchor(anchor), progress = $("#homeProgress");
    if (!button || !progress) return null;
    activityAnchor = button;
    if (button.id === "visualTrain") $("#customVisualTraining").open = true;
    if (button.id === "visualInfer") $("#visualInference").hidden = false;
    if (button.id === "playgroundInfer") $("#homeInference").hidden = false;
    const placement = button.closest(".home-model-card") ? $("#homeModelList") : button;
    placement.insertAdjacentElement("afterend", progress);
    progress.classList.add("inline-progress");
    return button;
  }
  function progressAnchorForJob(job) {
    const image = job.preset_id === "sdxl-lora-v1", inference = job.task_mode === "inference";
    if (image && inference) return $("#visualInfer");
    if (!image && inference) return $("#playgroundInfer");
    if (!image) return $("#playgroundTrain");
    if (!/CGR_DEMO=dog/.test(job.command || "")) return job.command ? $("#visualTrain") : $("#visualDemoTrain");
    const resumeButton = job.source_model_id ? $$('[data-model-action="resume-demo"]').find((button) => button.dataset.modelId === job.source_model_id) : null;
    return resumeButton || $("#visualDemoTrain");
  }
  function selectedProvider() {
    const value = $("#playgroundProvider")?.value || "auto";
    return PROVIDERS.has(value) ? value : "auto";
  }
  function updateProviderUi() {
    const copy = {
      auto: { badge: "네이버 우선 · 카카오 폴백", hint: "자동 선택은 네이버 L40S를 먼저 사용하고, 한도가 없을 때 카카오 A100으로 전환합니다." },
      naver: { badge: "네이버 L40S 48GB", hint: "네이버 L40S만 사용합니다. 한도가 없거나 실행할 수 없으면 카카오로 전환하지 않고 중단합니다." },
      kakao: { badge: "카카오 A100 80GB", hint: "카카오 A100만 사용합니다. 네이버 GPU로 전환하지 않습니다." },
    }[selectedProvider()];
    $("#playgroundProviderHint").textContent = copy.hint;
    $$('[data-provider-badge]').forEach((badge) => { badge.textContent = copy.badge; });
  }
  function setActivity(title, detail = "") {
    const elapsed = activityStartedAt ? Math.max(0, Math.floor((Date.now() - activityStartedAt) / 1000)) : 0;
    activityDetail = detail || activityDetail;
    $("#homeProgress").hidden = false; $("#homeProgress").classList.remove("failed"); $("#homeProgress").classList.add("active");
    $("#homeProgressTitle").textContent = title;
    $("#homeProgressCopy").textContent = `${activityDetail}${activityDetail ? " · " : ""}${elapsed}초 경과`;
  }
  function startActivity(title, detail, anchor) {
    placeProgress(anchor); activityStartedAt = Date.now(); setButtonsBusy(true, activityAnchor); setActivity(title, detail);
    clearInterval(activityTimer); activityTimer = setInterval(() => setActivity($("#homeProgressTitle").textContent), 1000);
  }
  function stopActivity() { clearInterval(activityTimer); activityTimer = null; setButtonsBusy(false); $("#homeProgress").classList.remove("active"); }
  function syncOutputVisibility(reset = false) {
    $("#ai-playground").dataset.activePreset = activePreset;
    $$('[data-playground-output]').forEach((output) => {
      if (reset || output.dataset.playgroundOutput !== activePreset) output.hidden = true;
    });
  }

  function helpModel(modelId) {
    return publicModels.find((model) => model.id === modelId)
      || publicModels.find((model) => model.id === selectedModelId)
      || currentModels()[0]
      || null;
  }
  function helpFact(label, value) { return `<div><span>${safe(label)}</span><b>${safe(value)}</b></div>`; }
  function playgroundHelpContent(topic, modelId) {
    const model = helpModel(modelId), checkpoints = model?.checkpoints || [];
    const prompt = $("#visualInferencePrompt")?.value.trim() || "a studio photo of sks dog wearing blue sunglasses, clean background";
    const seed = $("#visualSeed")?.value || "903";
    const selectedCheckpoint = $("#visualCheckpoint")?.selectedOptions?.[0]?.textContent || "최종 LoRA";
    if (topic === "experiment") return {
      title: "이 실험은 강아지의 생김새를 학습해요",
      lead: "SDXL 전체를 새로 만드는 작업이 아닙니다. LoRA라는 작은 추가 모델에 예제 강아지 사진 5장의 특징을 기록합니다.",
      body: `<div class="help-flow"><section><i>1</i><div><b>사진 5장을 학습해요</b><p>서로 다른 각도에서 찍은 같은 강아지를 1024px 크기로 사용합니다.</p></div></section><section><i>2</i><div><b>첫 100 step만 실행해요</b><p>가장 이른 체크포인트에서 멈춰 대기 시간과 비용을 줄입니다. 저장된 모델은 나중에 더 학습할 수 있습니다.</p></div></section><section><i>3</i><div><b>전후 결과를 함께 만들어요</b><p>학습이 끝나기 전에 기본 SDXL과 100 step LoRA에 같은 문장과 시드를 적용합니다. 결과를 보려고 GPU를 다시 실행할 필요가 없습니다.</p></div></section></div><div class="help-callout"><b>배경과 파란 안경은 학습 대상이 아니에요</b><p>비교 문장에 “파란 선글라스”와 “깔끔한 배경”을 요청했습니다. LoRA는 강아지의 생김새를 기억하고, 비교 문장이 액세서리와 배경을 정합니다.</p></div><div class="help-term"><b>왜 48GB GPU를 쓰나요?</b><p>SDXL을 1024px·BF16으로 학습하고 비교 이미지까지 만드는 작업에는 큰 GPU 메모리가 필요합니다. L40S나 A100은 이 고해상도 학습을 안정적으로 처리합니다.</p></div>`,
    };
    if (topic === "library") return {
      title: "모델과 체크포인트는 이렇게 저장돼요",
      lead: "학습 결과는 GPU 서버가 사라져도 남습니다. 모델 파일과 중간 체크포인트를 Object Storage에 저장하기 때문입니다.",
      body: `<div class="help-flow"><section><i>1</i><div><b>MODEL v1</b><p>한 번의 학습으로 만든 LoRA 파일과 설정을 묶은 저장 모델입니다.</p></div></section><section><i>2</i><div><b>100·200·300·400 step</b><p>모델 가중치를 갱신하다가 100 step마다 저장한 복구 지점입니다.</p></div></section><section><i>3</i><div><b>이어 학습</b><p>가장 최근 체크포인트를 불러와 기존 학습량에 200·400·800 step을 추가합니다.</p></div></section></div><div class="help-callout"><b>웹사이트가 학습을 계속 돌리는 구조가 아니에요</b><p>Vercel은 작업 시작과 상태 조회만 담당합니다. 실제 학습과 체크포인트 저장은 클라우드 GPU 서버가 수행하고, 작업이 끝나면 GPU 서버를 반납합니다.</p></div>`,
    };
    if (topic === "checkpoint") return {
      title: "체크포인트는 학습 중간 저장본이에요",
      lead: `${safe(selectedCheckpoint)}은 모델 가중치를 그 시점까지 갱신한 저장본입니다. 숫자는 이미지 수가 아니라 학습 가중치 갱신 횟수입니다.`,
      body: `<div class="help-flow"><section><i>100</i><div><b>초기 특징이 보이기 시작해요</b><p>대상의 색이나 얼굴 형태가 아직 불안정할 수 있습니다.</p></div></section><section><i>200</i><div><b>대상 특징이 더 뚜렷해져요</b><p>학습 사진과 닮아지면서 비교 문장의 조건도 함께 따르는지 봅니다.</p></div></section><section><i>400</i><div><b>더 많이 학습한 결과예요</b><p>항상 400 step이 최고는 아닙니다. 너무 학습하면 사진을 복사하듯 만드는 과학습이 생길 수 있습니다.</p></div></section></div><div class="help-callout"><b>어느 체크포인트를 선택해야 하나요?</b><p>대상은 잘 닮았지만 자세·배경·액세서리 요청도 자연스럽게 따르는 시점을 선택하세요.</p></div>`,
    };
    if (topic === "seed") return {
      title: "시드는 이미지의 출발점을 고정하는 숫자예요",
      lead: `현재 시드 ${safe(seed)}은 이미지 생성이 시작되는 무작위 노이즈를 다시 만들 수 있게 합니다.`,
      body: `<div class="help-flow"><section><i>1</i><div><b>같은 시드</b><p>기본 SDXL과 LoRA가 비슷한 출발점에서 이미지를 만들게 해 모델 차이를 비교하기 쉬워집니다.</p></div></section><section><i>2</i><div><b>다른 시드</b><p>구도와 자세가 다른 새 이미지를 시험할 수 있습니다.</p></div></section></div><div class="help-callout"><b>같은 시드가 완전히 같은 구도를 보장하지는 않아요</b><p>LoRA를 적용하면 모델 계산 자체가 달라지므로 세부 구도도 바뀔 수 있습니다. 시드는 비교 조건을 최대한 비슷하게 맞추는 장치입니다.</p></div>`,
    };
    if (topic === "prompt") return {
      title: "배경과 소품은 비교 문장이 정해요",
      lead: "학습은 대상의 생김새를 기억시키고, 비교 문장은 그 대상을 어떤 장면에 놓을지 지정합니다.",
      body: `<div class="help-code"><span>현재 비교 문장</span><p>${safe(prompt)}</p></div><div class="help-flow"><section><i>A</i><div><b>a studio photo</b><p>스튜디오 사진 같은 구도와 조명을 요청합니다.</p></div></section><section><i>B</i><div><b>sks dog</b><p>사진 5장으로 학습한 강아지를 불러오는 전용 이름입니다.</p></div></section><section><i>C</i><div><b>blue sunglasses · clean background</b><p>파란 선글라스와 깔끔한 배경을 새로 만들어 달라는 조건입니다.</p></div></section></div><div class="help-callout"><b>배경이 비슷한 이유</b><p>모든 체크포인트에 같은 비교 문장과 같은 시드를 사용했기 때문입니다. 배경은 학습 성과라기보다 비교 조건에 가깝습니다.</p></div>`,
    };
    if (topic === "model" && model) {
      const checkpointText = checkpoints.length ? `${checkpoints.join(" · ")} step` : "아직 저장된 체크포인트 없음";
      return {
        title: `${safe(model.name)} v${safe(model.version)} 설명`,
        lead: "이 카드는 한 번의 이미지 LoRA 학습 결과와 다시 사용할 수 있는 중간 저장본을 보여줍니다.",
        body: `<div class="help-facts">${helpFact("학습 자료", model.dataset || "이미지 기록")}${helpFact("학습 방식", model.method || "SDXL LoRA")}${helpFact("저장 시점", checkpointText)}${helpFact("GPU·시간", `${model.gpu || "GPU 기록 중"} · ${minutes(model.runtime_seconds)}`)}</div><div class="help-callout"><b>이 모델이 기억한 것</b><p>LoRA는 학습 이미지 속 대상의 생김새를 기억합니다. 배경·자세·조명·액세서리는 결과를 만들 때 입력하는 비교 문장이 정합니다.</p></div><div class="help-term"><b>결과 비교</b><p>기본 SDXL과 저장된 체크포인트 이미지를 확인합니다. GPU를 새로 쓰지 않고 저장된 미리보기부터 보여줍니다.</p></div><div class="help-term"><b>이어 학습</b><p>최근 체크포인트부터 학습량을 추가합니다. 기존 모델을 덮어쓰지 않고 새 버전으로 저장합니다.</p></div>`,
      };
    }
    return {
      title: "이 비교 이미지는 이렇게 읽어요",
      lead: "같은 비교 문장과 같은 시드를 사용하고, LoRA 적용 여부나 학습 시점만 바꿨습니다.",
      body: `<div class="help-code"><span>현재 비교 문장</span><p>${safe(prompt)}</p><small>시드 ${safe(seed)} · 선택 ${safe(selectedCheckpoint)}</small></div><div class="help-flow"><section><i>왼쪽</i><div><b>기본 SDXL</b><p>강아지 사진 5장을 학습하기 전의 기본 모델 결과입니다.</p></div></section><section><i>오른쪽</i><div><b>LoRA 또는 체크포인트</b><p>100·200·300·400 step으로 갈수록 사진 속 강아지의 특징이 얼마나 반영되는지 봅니다.</p></div></section></div><div class="help-callout"><b>배경과 파란 안경이 계속 나오는 이유</b><p>모든 이미지에 같은 “파란 선글라스, 깔끔한 배경” 문장을 넣었기 때문입니다. 강아지 얼굴과 체형이 학습 사진에 가까워지는지가 핵심 비교 대상입니다.</p></div><div class="help-term"><b>좋은 학습</b><p>강아지는 점점 학습 사진과 닮아가면서도 파란 안경과 새 배경 요청을 자연스럽게 따릅니다.</p></div><div class="help-term warning"><b>과학습</b><p>학습 사진의 자세나 배경을 그대로 복사하고 새 문장을 잘 따르지 못하면 너무 많이 학습한 상태입니다.</p></div>`,
    };
  }
  function openPlaygroundHelp(topic, modelId = "") {
    const content = playgroundHelpContent(topic, modelId), dialog = $("#playgroundHelpDialog");
    $("#playgroundHelpTitle").textContent = content.title;
    $("#playgroundHelpLead").textContent = content.lead;
    $("#playgroundHelpBody").innerHTML = content.body;
    dialog.showModal(); dialog.querySelector(".dialog-close").focus();
  }

  function currentModels() { return publicModels.filter((model) => model.preset_id === activePreset); }
  function checkpointHtml(model) {
    const steps = model.checkpoints || [];
    return steps.length ? `<div class="checkpoint-list">${steps.slice(-6).map((step) => `<i>${safe(step)} step</i>`).join("")}</div>` : "";
  }
  function renderModels() {
    const models = currentModels();
    $("#homeModelList").setAttribute("aria-busy", "false");
    $("#libraryTitle").textContent = activePreset === "sdxl-lora-v1" ? "이미지 LoRA 모델" : "텍스트 LoRA 모델";
    if (!models.length) {
      $("#homeModelList").innerHTML = `<p class="playground-empty">${activePreset === "sdxl-lora-v1" ? "이미지 5~12장으로 첫 LoRA를 학습해보세요." : "아직 완료된 텍스트 모델이 없어요."}</p>`;
      return;
    }
    $("#homeModelList").innerHTML = models.map((model) => {
      const status = model.training_state === "interrupted" ? "중단 시점 복구본" : "학습 완료";
      if (model.kind === "image") {
        const demoModel = model.training?.demo_id === "dog";
        return `<article class="home-model-card visual-model"><div><span>IMAGE MODEL v${safe(model.version)} · ${status}</span><h4>${safe(model.name)}</h4><p>${safe(model.dataset)} · ${safe(model.method)}<br>${safe(model.gpu || "GPU 기록 중")} · ${minutes(model.runtime_seconds)} · ${model.cost_krw == null ? "비용 정산 중" : won(model.cost_krw)}</p>${checkpointHtml(model)}<div class="home-model-actions"><button class="primary-small" type="button" data-model-action="compare" data-model-id="${safe(model.id)}">저장 결과 보기</button><button type="button" data-model-action="${demoModel ? "resume-demo" : "resume"}" data-model-id="${safe(model.id)}">${demoModel ? "100 step 더 학습" : "이어 학습"}</button><button type="button" data-help-topic="model" data-model-id="${safe(model.id)}">모델 설명</button></div></div></article>`;
      }
      return `<article class="home-model-card"><div><span>TEXT MODEL v${safe(model.version)}</span><h4>${safe(model.name)}</h4><p>${safe(model.base_model)} · ${safe(model.method)}<br>${safe(model.gpu || "GPU 기록 중")} · ${minutes(model.runtime_seconds)} · ${model.cost_krw == null ? "비용 정산 중" : won(model.cost_krw)}</p></div><button type="button" data-model-action="chat" data-model-id="${safe(model.id)}">대화하기</button></article>`;
    }).join("");
  }

  async function loadPublicModels() {
    const data = await api(`/api/public-dashboard?playground=${Date.now()}`);
    publicModels = data.models || []; publicJobs = data.playground_jobs || { "qwen-lora-v1": data.playground_job };
    renderModels(); restorePublicJob(publicJobs[activePreset]);
  }

  async function restorePrivateJobs() {
    const data = await api("/api/jobs");
    for (const presetId of Object.keys(PRESETS)) {
      const items = data.items.filter((job) => job.preset_id === presetId);
      const active = items.find((job) => ACTIVE.has(job.status));
      if (active) currentJobs[presetId] = active;
    }
    const active = currentJobs[activePreset];
    if (active) {
      renderJobStatus(active);
      ensureJobPolling();
    }
  }

  function jobCopy(job) {
    const image = job.preset_id === "sdxl-lora-v1", inference = job.task_mode === "inference";
    const running = image ? (inference ? "SDXL과 LoRA 이미지를 같은 조건으로 만들고 있어요" : "SDXL LoRA를 학습하고 체크포인트를 저장하고 있어요") : (inference ? "저장된 모델이 답변을 만들고 있어요" : "Qwen 7B 모델을 학습하고 있어요");
    return { queued: "GPU 실행을 기다리고 있어요", provisioning: "48GB GPU 서버를 준비하고 있어요", running, completed: inference ? "추론과 GPU 자원 반납이 완료됐어요" : "학습과 GPU 자원 반납이 완료됐어요", failed: "GPU 작업을 완료하지 못했어요", cancelled: "GPU 작업이 취소됐어요" }[job.status] || job.status;
  }
  function renderJobStatus(job) {
    const provider = job.provider === "kakao" ? "카카오" : "네이버", cost = job.usage_amount == null ? (TERMINAL.has(job.status) ? "비용 정산 중" : "비용 기록 전") : won(job.usage_amount);
    const checkpoint = Number(job.latest_checkpoint_step || job.model_metadata?.latest_checkpoint_step || 0);
    const anchor = placeProgress(progressAnchorForJob(job)) || activityAnchor;
    setButtonsBusy(ACTIVE.has(job.status), anchor);
    $("#homeProgress").hidden = false; $("#homeProgress").classList.toggle("failed", job.status === "failed"); $("#homeProgress").classList.toggle("active", ACTIVE.has(job.status));
    $("#homeProgressTitle").textContent = jobCopy(job);
    $("#homeProgressCopy").textContent = `${provider} ${job.flavor_name || "GPU"} · ${cost}${checkpoint ? ` · 최근 체크포인트 ${checkpoint} step` : ""}`;
  }
  function restorePublicJob(job) {
    clearTimeout(publicPollTimer); publicPollTimer = null;
    if (!job || !ACTIVE.has(job.status)) { $("#homeProgress").hidden = true; return; }
    if (currentJobs[activePreset]) return;
    renderJobStatus(job);
    const waitingForCost = TERMINAL.has(job.status) && job.usage_amount == null && settlementPolls < 10;
    if ((ACTIVE.has(job.status) || waitingForCost) && document.visibilityState === "visible") {
      if (waitingForCost) settlementPolls += 1;
      publicPollTimer = setTimeout(() => loadPublicModels().catch(() => {}), 30000);
    } else settlementPolls = 0;
  }

  function switchPreset(presetId) {
    activePreset = presetId; settlementPolls = 0;
    $$('[data-playground-preset]').forEach((button) => { const active = button.dataset.playgroundPreset === presetId; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); });
    $$('[data-playground-panel]').forEach((panel) => { panel.hidden = panel.dataset.playgroundPanel !== presetId; });
    syncOutputVisibility(true);
    renderModels();
    if (currentJobs[presetId]) renderJobStatus(currentJobs[presetId]);
    else restorePublicJob(publicJobs[presetId]);
  }

  function requestPassword(summary, paid = true) {
    const dialog = $("#playgroundPasswordDialog");
    $("#playgroundPasswordKind").textContent = paid ? "PAID GPU RUN" : "PRIVATE MODEL";
    $("#playgroundPasswordTitle").textContent = paid ? "실행 비밀번호" : "모델 설정 확인";
    $("#playgroundPasswordSubmit").textContent = paid ? "확인하고 실행" : "확인하고 불러오기";
    $("#playgroundPasswordSummary").textContent = summary; $("#playgroundPassword").value = ""; $("#playgroundPasswordError").textContent = "";
    dialog.showModal(); $("#playgroundPassword").focus();
    return new Promise((resolve) => {
      const finish = (value) => { $("#playgroundPasswordForm").removeEventListener("submit", submit); $("#playgroundPasswordClose").removeEventListener("click", cancel); dialog.removeEventListener("cancel", cancel); if (dialog.open) dialog.close(); resolve(value); };
      const submit = async (event) => { event.preventDefault(); const password = $("#playgroundPassword").value.trim(); if (!password) return $("#playgroundPasswordError").textContent = "비밀번호를 입력해주세요."; dialog.setAttribute("busy", ""); try { await api("/api/login", { method: "POST", body: JSON.stringify({ password }) }); finish(password); } catch (error) { $("#playgroundPasswordError").textContent = friendly(error); } finally { dialog.removeAttribute("busy"); } };
      const cancel = (event) => { event.preventDefault(); finish(""); };
      $("#playgroundPasswordForm").addEventListener("submit", submit); $("#playgroundPasswordClose").addEventListener("click", cancel); dialog.addEventListener("cancel", cancel);
    });
  }

  async function loadEnvironment() {
    if (environment) return environment;
    const requestedProvider = selectedProvider();
    const [storage, initialNaver, kakao, kakaoAll] = await Promise.all([api("/api/ncp-storage?action=buckets"), api("/api/ncp-gpu").catch(() => null), api("/api/cloud?action=readiness").catch(() => null), api("/api/cloud?action=gpu-flavors").catch(() => null)]);
    let naver = initialNaver;
    if (requestedProvider !== "kakao" && naver?.specs?.length && !naver.ok && naver.missing?.some((item) => /GPU 지원 존/.test(item))) {
      setActivity("L40S용 네트워크를 준비하고 있어요", "KR-2 전용 서브넷을 확인하고 있어요");
      await api("/api/ncp-gpu?action=bootstrap", { method: "POST", body: "{}" });
      for (let attempt = 0; attempt < 12 && !naver?.ok; attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 5000)); naver = await api("/api/ncp-gpu").catch(() => naver); }
    }
    const bucket = storage.items.find((item) => /artifact|cloud-gpu|work-memory/i.test(item.name))?.name || storage.items[0]?.name;
    if (!bucket) throw new Error("모델을 저장할 버킷이 없어요.");
    let kakaoFallback = null, kakaoT4Fallback = null;
    const image = kakao?.images?.find((item) => /nvidia/i.test(item.name || "")), subnet = kakao?.subnets?.find((item) => item.availability_zone === "kr-central-2-a") || kakao?.subnets?.[0], common = image && kakao?.keypairs?.[0] && subnet && kakao?.security_groups?.[0] ? { provider: "kakao", bucket, image, keypair: kakao.keypairs[0], subnet, securityGroup: kakao.security_groups[0], volume: 80 } : null;
    if (common) { const t4 = [...(kakaoAll?.items || [])].filter((item) => /^gn1i\./i.test(item.name) && kakao.pricing?.gpu_hourly?.[item.name]).sort((a, b) => kakao.pricing.gpu_hourly[a.name] - kakao.pricing.gpu_hourly[b.name])[0]; if (t4) kakaoT4Fallback = { ...common, flavor: t4, profile: "qlora-4bit" }; }
    if (kakao?.flavors?.length && common) { const flavor = [...kakao.flavors].filter((item) => item.vram_per_gpu_gb >= 48 && kakao.pricing?.gpu_hourly?.[item.name]).sort((a, b) => kakao.pricing.gpu_hourly[a.name] - kakao.pricing.gpu_hourly[b.name])[0]; if (flavor) kakaoFallback = { ...common, flavor, kakaoT4Fallback, profile: "bf16-lora" }; }
    let naverEnvironment = null;
    if (naver?.ok) { const spec = [...naver.specs].filter((item) => item.vram_per_gpu_gb >= 48).sort((a, b) => a.hourly_rate - b.hourly_rate)[0]; const launch = naver.launch_configs.find((item) => !spec?.required_zone_code || item.zone_code === spec.required_zone_code); if (spec && launch) naverEnvironment = { provider: "naver", bucket, spec, launch, key: naver.keys[0], volume: 50 }; }
    if (requestedProvider === "naver") environment = naverEnvironment;
    else if (requestedProvider === "kakao") environment = kakaoFallback ? { ...kakaoFallback, kakaoT4Fallback: null } : null;
    else environment = naverEnvironment ? { ...naverEnvironment, kakaoFallback } : kakaoFallback || kakaoT4Fallback;
    if (requestedProvider === "naver" && !environment) throw new Error("네이버 L40S 실행 설정을 사용할 수 없어요.");
    if (requestedProvider === "kakao" && !environment) throw new Error("kakao_gpu_unavailable");
    if (!environment) throw new Error("사용 가능한 GPU가 없어요.");
    return environment;
  }

  async function uploadBlob(bucket, blob, filename, contentType) {
    const key = `gpu-workbench/${Date.now()}-${crypto.randomUUID()}-${filename}`;
    const signed = await api("/api/ncp-storage?action=upload-url", { method: "POST", body: JSON.stringify({ bucket, key }) });
    const uploaded = await fetch(signed.url, { method: "PUT", body: blob, headers: { "content-type": contentType } });
    if (!uploaded.ok) throw new Error("Object Storage 직접 업로드에 실패했어요.");
    await api("/api/ncp-storage?action=upload-complete", { method: "POST", body: JSON.stringify({ bucket, key, size: blob.size }) });
    return key;
  }
  async function uploadBundle(bucket, presetId) { const preset = PRESETS[presetId], response = await fetch(preset.bundle); if (!response.ok) throw new Error("학습 코드를 불러오지 못했어요."); return uploadBlob(bucket, await response.blob(), preset.filename, "application/zip"); }
  function fileBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
  async function visualTrainingBundle() {
    const files = [...$("#visualImages").files], total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.length < 5 || files.length > 12) throw new Error("학습 이미지는 5~12장을 선택해주세요.");
    if (total > 80 * 1024 * 1024 || files.some((file) => file.size > 15 * 1024 * 1024)) throw new Error("이미지는 장당 15MB, 전체 80MB 이하여야 해요.");
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) throw new Error("JPG, PNG, WebP 이미지만 사용할 수 있어요.");
    const trigger = $("#visualTrigger").value.trim(), instancePrompt = $("#visualInstancePrompt").value.trim(), validationPrompt = $("#visualPrompt").value.trim();
    if (!trigger || !instancePrompt.includes(trigger) || !validationPrompt.includes(trigger)) throw new Error("학습 설명과 비교 프롬프트에 트리거 단어를 넣어주세요.");
    const images = await Promise.all(files.map(async (file) => ({ name: file.name.slice(0, 100), type: file.type, data: await fileBase64(file) })));
    return new Blob([JSON.stringify({ version: 1, trigger_word: trigger, instance_prompt: instancePrompt, validation_prompt: validationPrompt, steps_added: Number($("#visualSteps").value), checkpointing_steps: 100, seed: 903, images })], { type: "application/json;charset=utf-8" });
  }

  async function launch(job, password, maxMinutes, purpose) {
    currentJobs[job.preset_id] = job; renderJobStatus(job); ensureJobPolling();
    if (environment.provider === "naver") {
      try { await api("/api/ncp-gpu", { method: "POST", body: JSON.stringify({ job_id: job.id, spec_code: environment.spec.serverSpecCode, vpc_no: environment.launch.vpc_no, subnet_no: environment.launch.subnet_no, login_key_name: environment.key.loginKeyName || environment.key.keyName, acg_no: environment.launch.acg_no, max_minutes: maxMinutes, volume_gb: 50, execution_password: password }) }); }
      catch (error) { if (error.message !== "naver_gpu_quota_unavailable" || !environment.kakaoFallback) throw error; environment = environment.kakaoFallback; setActivity("카카오 48GB GPU로 자동 전환하고 있어요"); await launchKakao(job, password, maxMinutes, purpose); }
    } else await launchKakao(job, password, maxMinutes, purpose);
    await pollJob(job.preset_id);
  }
  function ensureJobPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") Object.keys(currentJobs).forEach((presetId) => pollJob(presetId).catch(() => {}));
    }, 30000);
  }
  async function launchKakao(job, password, maxMinutes, purpose) {
    try { await api("/api/cloud?action=create", { method: "POST", body: JSON.stringify({ job_id: job.id, purpose, flavor_id: environment.flavor.id, image_id: environment.image.id, subnet_id: environment.subnet.id, key_name: environment.keypair.name, security_group: environment.securityGroup.name, max_minutes: maxMinutes, volume_gb: 80, execution_password: password }) }); }
    catch (error) {
      const canUseT4 = job.preset_id === "qwen-lora-v1" && (error.message === "kakao_gpu_activation_timeout" || error.message.startsWith("kakao_gpu_unavailable")) && environment.kakaoT4Fallback;
      if (!canUseT4) throw error;
      await api("/api/jobs?action=retry", { method: "POST", body: JSON.stringify({ id: job.id }) }); environment = environment.kakaoT4Fallback;
      setActivity("카카오 T4에서 4-bit QLoRA로 전환하고 있어요"); await launchKakao(job, password, maxMinutes, purpose);
    }
  }

  function parseTextResult(text) { for (const line of text.split(/\r?\n/)) if (line.includes("CGR_INFERENCE ")) try { return JSON.parse(line.slice(line.indexOf("CGR_INFERENCE ") + 14)); } catch {} return null; }
  function parseImageResult(text) { for (const line of text.split(/\r?\n/)) if (line.includes("CGR_IMAGE_INFERENCE ")) try { return JSON.parse(line.slice(line.indexOf("CGR_IMAGE_INFERENCE ") + 20)); } catch {} return null; }
  async function showCompletedResult(job) {
    if (activePreset !== job.preset_id) return;
    if (job.preset_id === "sdxl-lora-v1") {
      const trainingResult = job.task_mode === "training";
      const [preview, log] = await Promise.all([api(`/api/jobs?action=preview-url&id=${encodeURIComponent(job.id)}`), trainingResult ? Promise.resolve({ text: "" }) : api(`/api/jobs?action=log-text&id=${encodeURIComponent(job.id)}`)]), result = parseImageResult(log.text);
      if (activePreset !== job.preset_id) return;
      const metadata = job.model_metadata || {}, checkpoints = metadata.checkpoint_steps || [];
      selectedModelId = job.registered_model_id || job.model_id || selectedModelId; syncOutputVisibility(); $("#visualInference").hidden = false;
      if (trainingResult) {
        $("#visualInferenceTitle").textContent = "저장된 학습 결과";
        $("#visualInferenceCopy").textContent = "학습 GPU가 종료되기 전에 만든 결과입니다. 아래 버튼은 비교 문장을 바꿀 때만 사용하세요.";
        if (metadata.validation_prompt) $("#visualInferencePrompt").value = metadata.validation_prompt;
        $("#visualCheckpoint").innerHTML = `<option value="0">최종 LoRA</option>${checkpoints.slice().reverse().map((step) => `<option value="${safe(step)}">${safe(step)} step</option>`).join("")}`;
      }
      $("#visualAnswer").hidden = false; $("#visualAnswerImage").src = preview.url;
      const shown = trainingResult ? checkpoints.slice(-4).join(" → ") : result?.checkpoint_step;
      $("#visualAnswerGuide").textContent = `왼쪽은 학습 전 기본 SDXL, 오른쪽은 ${shown ? `${shown} step` : "최종 LoRA"} 결과예요. 배경과 소품은 같은 비교 문장이 정합니다.`;
      $("#visualAnswerMeta").textContent = trainingResult
        ? `${job.flavor_name || metadata.gpu || "GPU"} · ${minutes(job.usage_seconds || metadata.seconds)} · ${job.usage_amount == null ? "비용 정산 중" : won(job.usage_amount)} · 저장된 학습 결과`
        : `${result?.gpu || job.flavor_name || "GPU"} · ${result?.seconds || "-"}초 · ${job.usage_amount == null ? "비용 정산 중" : won(job.usage_amount)}`;
      $("#visualAnswer").scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (job.task_mode === "inference") {
      const log = await api(`/api/jobs?action=log-text&id=${encodeURIComponent(job.id)}`), result = parseTextResult(log.text);
      if (activePreset !== job.preset_id) return;
      if (result) { selectedModelId = job.model_id || selectedModelId; syncOutputVisibility(); $("#homeInference").hidden = false; $("#homeAnswer").hidden = false; $("#homeAnswerText").textContent = result.answer; $("#homeAnswerMeta").textContent = `${result.gpu} · ${result.seconds}초 · ${job.usage_amount == null ? "비용 정산 중" : won(job.usage_amount)}`; }
    }
  }
  async function pollJob(presetId) {
    const currentJob = currentJobs[presetId];
    if (!currentJob) return;
    let data = await api("/api/jobs"), job = data.items.find((item) => item.id === currentJob.id);
    if (!job) return;
    if (job.provider === "kakao" && job.status === "provisioning" && !job.public_ip_id) {
      await api("/api/cloud?action=provision", { method: "POST", body: JSON.stringify({ job_id: job.id }) }).catch(() => {});
      data = await api("/api/jobs"); job = data.items.find((item) => item.id === currentJob.id) || job;
    }
    currentJobs[presetId] = job;
    if (activePreset === presetId) renderJobStatus(job);
    if (!TERMINAL.has(job.status)) return;
    if (job.status === "completed" && job.registered_model_id && activePreset === presetId) selectedModelId = job.registered_model_id;
    if (job.status === "completed" && activePreset === presetId && !shownResults.has(job.id)) {
      try { await showCompletedResult(job); shownResults.add(job.id); } catch {}
    }
    const costReady = job.usage_amount != null || !job.billing_started_at;
    if (!costReady) return;
    delete currentJobs[presetId];
    if (!Object.keys(currentJobs).length) { clearInterval(pollTimer); pollTimer = null; stopActivity(); }
    await loadPublicModels().catch(() => {});
  }

  async function trainVisualDemo(parent = null, authorizedPassword = "", triggerButton = null) {
    const continuing = Boolean(parent);
    const password = authorizedPassword || await requestPassword(`${continuing ? "저장된 예제 체크포인트부터" : "준비된 강아지 사진 5장으로"} SDXL LoRA를 100 step 학습하고 전후 비교 이미지를 함께 만들어요. L40S/A100을 최대 60분 사용하며 실제 크레딧이 차감됩니다.`);
    if (!password) return;
    const messageTarget = continuing ? "#visualMessage" : "#visualDemoMessage";
    const progressAnchor = triggerButton || "#visualDemoTrain";
    startActivity("GPU와 비용을 확인하고 있어요", "아직 GPU 과금은 시작되지 않았어요", progressAnchor); message(messageTarget, "");
    try {
      const env = await loadEnvironment(); if (env.profile === "qlora-4bit") throw new Error("이미지 LoRA는 48GB 이상 GPU가 필요해요.");
      const flavor = env.provider === "naver" ? env.spec.serverSpecCode : env.flavor.name;
      const estimate = await api("/api/estimate?type=gpu", { method: "POST", body: JSON.stringify({ provider: env.provider, flavor, minutes: 60, volume_gb: env.volume }) });
      setActivity("준비된 예제와 학습 코드를 보내고 있어요", `최대 예상 ${won(estimate.total)}`);
      const targetBucket = parent?.bucket || env.bucket;
      const codeKey = await uploadBundle(targetBucket, "sdxl-lora-v1");
      const created = await api("/api/jobs", { method: "POST", body: JSON.stringify({ type: "custom-gpu", task_mode: "training", preset_id: "sdxl-lora-v1", provider: env.provider, bucket: targetBucket, code_key: codeKey, model_key: parent?.artifact_key, model_id: parent?.id, command: "python3 -m pip install -r requirements.txt && CGR_DEMO=dog python3 train.py", output_path: "outputs" }) });
      setActivity("48GB GPU 서버를 생성하고 있어요", "서버 생성 뒤부터 비용이 계산돼요");
      await launch(created.job, password, 60, continuing ? "sdxl-lora-demo-continuation" : "sdxl-lora-zero-prep-demo");
    } catch (error) {
      const text = friendly(error); stopActivity(); message(messageTarget, text); $("#homeProgress").hidden = false; $("#homeProgress").classList.add("failed"); $("#homeProgressTitle").textContent = "예제 학습을 시작하지 못했어요"; $("#homeProgressCopy").textContent = text;
    }
  }

  async function trainVisual() {
    let bundle;
    try { bundle = await visualTrainingBundle(); } catch (error) { return message("#visualMessage", friendly(error)); }
    const continuing = Boolean(resumeModelId), steps = Number($("#visualSteps").value);
    const password = await requestPassword(`${continuing ? "선택한 체크포인트에서" : "새 SDXL LoRA를"} ${steps} step 학습해요. L40S/A100을 최대 90분 사용하며 실제 크레딧이 차감됩니다.`); if (!password) return;
    startActivity("GPU와 비용을 확인하고 있어요", "아직 GPU 과금은 시작되지 않았어요", "#visualTrain"); message("#visualMessage", "");
    try {
      const env = await loadEnvironment(); if (env.profile === "qlora-4bit") throw new Error("이미지 LoRA는 48GB 이상 GPU가 필요해요.");
      const flavor = env.provider === "naver" ? env.spec.serverSpecCode : env.flavor.name;
      const estimate = await api("/api/estimate?type=gpu", { method: "POST", body: JSON.stringify({ provider: env.provider, flavor, minutes: 90, volume_gb: env.volume }) });
      setActivity("이미지와 학습 코드를 Object Storage로 보내고 있어요", `최대 예상 ${won(estimate.total)}`);
      const privateModels = continuing ? await api("/api/models") : { items: [] }, parent = privateModels.items.find((model) => model.id === resumeModelId);
      if (continuing && (!parent || parent.preset_id !== "sdxl-lora-v1")) throw new Error("model_not_found");
      const targetBucket = parent?.bucket || env.bucket;
      const [codeKey, dataKey] = await Promise.all([uploadBundle(targetBucket, "sdxl-lora-v1"), uploadBlob(targetBucket, bundle, "sdxl-training-bundle.json", "application/json;charset=utf-8")]);
      const created = await api("/api/jobs", { method: "POST", body: JSON.stringify({ type: "custom-gpu", task_mode: "training", preset_id: "sdxl-lora-v1", provider: env.provider, bucket: targetBucket, code_key: codeKey, data_key: dataKey, model_key: parent?.artifact_key, model_id: parent?.id, command: "python3 -m pip install -r requirements.txt && python3 train.py", output_path: "outputs" }) });
      setActivity("48GB GPU 서버를 생성하고 있어요", "서버 생성 뒤부터 비용이 계산돼요"); await launch(created.job, password, 90, "sdxl-lora-training");
    } catch (error) { const text = friendly(error); stopActivity(); message("#visualMessage", text); $("#homeProgress").hidden = false; $("#homeProgress").classList.add("failed"); $("#homeProgressTitle").textContent = "이미지 LoRA 작업을 시작하지 못했어요"; $("#homeProgressCopy").textContent = text; }
  }

  async function trainText() {
    const password = await requestPassword("기존 Qwen2.5-7B를 최대 60분 학습해요. 실제 크레딧이 차감됩니다."); if (!password) return;
    startActivity("GPU와 비용을 확인하고 있어요", "아직 GPU 과금은 시작되지 않았어요", "#playgroundTrain"); message("#playgroundMessage", "");
    try {
      const env = await loadEnvironment(), flavor = env.provider === "naver" ? env.spec.serverSpecCode : env.flavor.name;
      const estimate = await api("/api/estimate?type=gpu", { method: "POST", body: JSON.stringify({ provider: env.provider, flavor, minutes: 60, volume_gb: env.volume }) });
      setActivity("Qwen 학습 파일을 준비하고 있어요", `최대 예상 ${won(estimate.total)}`);
      const codeKey = await uploadBundle(env.bucket, "qwen-lora-v1"), created = await api("/api/jobs", { method: "POST", body: JSON.stringify({ type: "custom-gpu", task_mode: "training", preset_id: "qwen-lora-v1", provider: env.provider, bucket: env.bucket, code_key: codeKey, command: "python3 -m pip install -r requirements.txt && python3 train.py", output_path: "outputs" }) });
      await launch(created.job, password, 60, "qwen-lora-training");
    } catch (error) { stopActivity(); message("#playgroundMessage", friendly(error)); }
  }

  async function inferVisual() {
    const prompt = $("#visualInferencePrompt").value.trim(); if (!prompt) return message("#visualInferenceMessage", "비교 프롬프트를 입력해주세요.");
    const password = await requestPassword("기본 SDXL과 선택한 LoRA 이미지를 같은 조건으로 생성해요. 48GB GPU를 최대 45분 사용합니다."); if (!password) return;
    startActivity("모델과 GPU를 확인하고 있어요", "아직 GPU 과금은 시작되지 않았어요", "#visualInfer"); message("#visualInferenceMessage", "");
    try {
      const env = await loadEnvironment(); if (env.profile === "qlora-4bit") throw new Error("이미지 비교는 48GB 이상 GPU가 필요해요.");
      const models = await api("/api/models"), model = models.items.find((item) => item.id === selectedModelId); if (!model) throw new Error("model_not_found");
      const flavor = env.provider === "naver" ? env.spec.serverSpecCode : env.flavor.name, estimate = await api("/api/estimate?type=gpu", { method: "POST", body: JSON.stringify({ provider: env.provider, flavor, minutes: 45, volume_gb: env.volume }) });
      setActivity("비교 생성 파일을 준비하고 있어요", `최대 예상 ${won(estimate.total)}`);
      const input = new Blob([JSON.stringify({ prompt, seed: Number($("#visualSeed").value), checkpoint_step: Number($("#visualCheckpoint").value) })], { type: "application/json;charset=utf-8" });
      const [codeKey, dataKey] = await Promise.all([uploadBundle(model.bucket, "sdxl-lora-v1"), uploadBlob(model.bucket, input, "sdxl-inference.json", "application/json;charset=utf-8")]);
      const created = await api("/api/jobs", { method: "POST", body: JSON.stringify({ type: "custom-gpu", task_mode: "inference", preset_id: "sdxl-lora-v1", provider: env.provider, bucket: model.bucket, code_key: codeKey, data_key: dataKey, model_key: model.artifact_key, model_id: model.id, command: "python3 -m pip install -r requirements.txt && python3 infer.py", output_path: "outputs" }) });
      await launch(created.job, password, 45, "sdxl-lora-inference");
    } catch (error) { stopActivity(); message("#visualInferenceMessage", friendly(error)); }
  }

  async function inferText() {
    const prompt = $("#homePrompt").value.trim(); if (!prompt) return message("#homeInferenceMessage", "질문을 입력해주세요.");
    const password = await requestPassword("저장된 Qwen LoRA를 불러와 최대 30분 추론해요. 실제 크레딧이 차감됩니다."); if (!password) return;
    startActivity("모델과 GPU를 확인하고 있어요", "아직 GPU 과금은 시작되지 않았어요", "#playgroundInfer"); message("#homeInferenceMessage", "");
    try {
      const env = await loadEnvironment(), models = await api("/api/models"), model = models.items.find((item) => item.id === selectedModelId); if (!model) throw new Error("model_not_found");
      const [codeKey, dataKey] = await Promise.all([uploadBundle(model.bucket, "qwen-lora-v1"), uploadBlob(model.bucket, new Blob([prompt], { type: "text/plain;charset=utf-8" }), "prompt.txt", "text/plain;charset=utf-8")]);
      const created = await api("/api/jobs", { method: "POST", body: JSON.stringify({ type: "custom-gpu", task_mode: "inference", preset_id: "qwen-lora-v1", provider: env.provider, bucket: model.bucket, code_key: codeKey, data_key: dataKey, model_key: model.artifact_key, model_id: model.id, command: "python3 -m pip install -r requirements.txt && python3 infer.py", output_path: "outputs" }) });
      await launch(created.job, password, 30, "qwen-lora-inference");
    } catch (error) { stopActivity(); message("#homeInferenceMessage", friendly(error)); }
  }

  async function selectImageModel(model, action, triggerButton) {
    const demoResume = action === "resume-demo";
    const password = await requestPassword(demoResume ? "저장된 예제 체크포인트에서 100 step을 더 학습해요. L40S/A100을 최대 60분 사용하며 실제 크레딧이 차감됩니다." : "저장된 모델의 비공개 설정과 미리보기를 불러와요. GPU는 실행하지 않습니다.", demoResume);
    if (!password) return;
    const models = await api("/api/models"), privateModel = models.items.find((item) => item.id === model.id);
    if (!privateModel) return message("#visualMessage", friendly(new Error("model_not_found")));
    await restorePrivateJobs().catch(() => {});
    if (activePreset !== model.preset_id) return;
    selectedModelId = privateModel.id;
    if (demoResume) { await trainVisualDemo(privateModel, password, triggerButton); return; }
    if (action === "resume") {
      resumeModelId = privateModel.id; $("#visualResumeNotice").hidden = false; $("#visualResumeTitle").textContent = `${privateModel.name} v${privateModel.version}의 최근 체크포인트에서 이어서 학습해요.`;
      $("#customVisualTraining").open = true;
      if (privateModel.training?.trigger_word) $("#visualTrigger").value = privateModel.training.trigger_word;
      if (privateModel.training?.instance_prompt) $("#visualInstancePrompt").value = privateModel.training.instance_prompt;
      if (privateModel.training?.validation_prompt) $("#visualPrompt").value = privateModel.training.validation_prompt;
      $("#visualPlayground").scrollIntoView({ behavior: "smooth", block: "center" }); return;
    }
    syncOutputVisibility(); $("#visualInference").hidden = false; $("#visualInferenceTitle").textContent = `${privateModel.name} v${privateModel.version} 체크포인트 비교`;
    $("#visualInferencePrompt").value = privateModel.training?.validation_prompt || `a studio product photo of ${privateModel.training?.trigger_word || "cgrx"} object on a clean white background, soft lighting`;
    const checkpoints = privateModel.checkpoints || [];
    $("#visualCheckpoint").innerHTML = `${privateModel.training_state === "interrupted" ? "" : '<option value="0">최종 LoRA</option>'}${checkpoints.slice().reverse().map((step) => `<option value="${safe(step)}">${safe(step)} step</option>`).join("")}`;
    if (privateModel.training_job_id) {
      const preview = await api(`/api/jobs?action=preview-url&id=${encodeURIComponent(privateModel.training_job_id)}`).catch(() => null);
      if (preview?.url) { const shown = checkpoints.slice(-4).join(" → "); $("#visualAnswer").hidden = false; $("#visualAnswerImage").src = preview.url; $("#visualAnswerGuide").textContent = `왼쪽은 학습 전 기본 SDXL, 오른쪽은 ${shown || "최종"} step 순서의 학습 결과예요. 배경과 파란 안경은 같은 비교 문장이 정합니다.`; $("#visualAnswerMeta").textContent = "저장된 학습 체크포인트 비교"; }
    }
    $("#visualInferenceCopy").textContent = "저장된 결과는 별도 GPU 실행 없이 바로 엽니다. 비교 문장을 바꿔 새 이미지를 만들 때만 GPU를 다시 실행합니다.";
    $("#visualInference").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $$('[data-playground-preset]').forEach((button) => button.addEventListener("click", () => switchPreset(button.dataset.playgroundPreset)));
  $("#playgroundProvider").addEventListener("change", () => { environment = null; updateProviderUi(); });
  $$('[data-output-close]').forEach((button) => button.addEventListener("click", () => { const output = button.closest("[data-playground-output]"); if (output) output.hidden = true; }));
  document.addEventListener("click", (event) => { const button = event.target.closest("[data-help-topic]"); if (!button) return; event.preventDefault(); openPlaygroundHelp(button.dataset.helpTopic, button.dataset.modelId || ""); });
  $("#homeModelList").addEventListener("click", (event) => { const button = event.target.closest("[data-model-action]"); if (!button) return; const model = publicModels.find((item) => item.id === button.dataset.modelId); if (!model) return; if (model.kind === "image") selectImageModel(model, button.dataset.modelAction, button).catch((error) => message("#visualMessage", friendly(error))); else { selectedModelId = model.id; syncOutputVisibility(); $("#homeAnswer").hidden = true; $("#homeAnswerText").textContent = ""; $("#homeAnswerMeta").textContent = ""; $("#homeInference").hidden = false; $("#homeInferenceTitle").textContent = `${model.name} v${model.version}과 대화하기`; $("#homeInference").scrollIntoView({ behavior: "smooth", block: "center" }); } });
  $("#visualImages").addEventListener("change", () => { const files = [...$("#visualImages").files], size = files.reduce((sum, file) => sum + file.size, 0) / 1048576; $("#visualImageSummary").textContent = files.length ? `${files.length}장 · ${size.toFixed(1)}MB 선택됨` : "JPG·PNG·WebP 5~12장 · 총 80MB 이하"; });
  $("#visualTrigger").addEventListener("input", () => { const value = $("#visualTrigger").value.trim() || "cgrx"; if (/^a photo of \S+ object$/.test($("#visualInstancePrompt").value)) $("#visualInstancePrompt").value = `a photo of ${value} object`; });
  $("#visualResumeClear").addEventListener("click", () => { resumeModelId = ""; $("#visualResumeNotice").hidden = true; });
  $("#visualDemoTrain").addEventListener("click", () => trainVisualDemo()); $("#visualTrain").addEventListener("click", trainVisual); $("#playgroundTrain").addEventListener("click", trainText); $("#visualInfer").addEventListener("click", inferVisual); $("#playgroundInfer").addEventListener("click", inferText);
  updateProviderUi();
  syncOutputVisibility(true);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { const presets = Object.keys(currentJobs); if (presets.length) presets.forEach((presetId) => pollJob(presetId).catch(() => {})); else loadPublicModels().catch(() => {}); } else { clearTimeout(publicPollTimer); publicPollTimer = null; } });
  loadPublicModels().then(() => restorePrivateJobs().catch(() => {})).catch(() => { $("#homeModelList").setAttribute("aria-busy", "false"); $("#homeModelList").innerHTML = '<p class="playground-empty">모델 목록을 불러오지 못했어요. 새로고침 후 다시 확인해주세요.</p>'; });
})();
