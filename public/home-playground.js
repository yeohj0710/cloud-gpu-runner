(() => {
  const $ = (selector) => document.querySelector(selector);
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const won = (value) => `${Math.round(Number(value || 0)).toLocaleString("ko-KR")}원`;
  const minutes = (seconds) => seconds ? `${Math.max(1, Math.round(Number(seconds) / 60))}분` : "기록 중";
  let publicModels = [], selectedModelId = "", environment = null, currentJob = null, pollTimer = null, publicPollTimer = null;

  async function api(url, options = {}) {
    const response = await fetch(url, { headers: { "content-type": "application/json" }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`);
    return data;
  }

  function message(target, text) { $(target).textContent = text; }
  function friendly(error) {
    return ({ invalid_password: "비밀번호가 올바르지 않아요.", execution_password_invalid: "실행 비밀번호가 올바르지 않아요.", another_gpu_job_active: "이미 실행 중인 GPU 작업이 있어요.", credit_insufficient: "남은 크레딧이 부족해요.", naver_gpu_quota_unavailable: "네이버 GPU 한도가 없어 다른 공급자를 확인할게요.", kakao_gpu_unavailable: "카카오 A100 GPU도 현재 생성할 수 없어요. 공급자 GPU 한도나 가용 용량을 확인해주세요.", kakao_gpu_activation_timeout: "카카오 GPU 준비가 지연돼 자동으로 취소했어요. 잠시 후 다시 시도해주세요.", model_not_found: "저장된 모델을 찾지 못했어요." }[error.message] || error.message);
  }

  function renderModels(models) {
    publicModels = models || [];
    $("#homeModelList").innerHTML = publicModels.length ? publicModels.map((model) => `<article class="home-model-card"><div><span>MODEL v${safe(model.version)}</span><h4>${safe(model.name)}</h4><p>${safe(model.base_model)} · ${safe(model.method)}<br>${safe(model.gpu || "GPU 기록 중")} · ${minutes(model.runtime_seconds)} · ${model.cost_krw == null ? "비용 정산 중" : won(model.cost_krw)}</p></div><button type="button" data-home-model="${safe(model.id)}">대화하기</button></article>`).join("") : '<p class="playground-empty">아직 완료된 모델이 없어요. 첫 7B 모델을 학습해보세요.</p>';
  }

  async function loadPublicModels() {
    const data = await api(`/api/public-dashboard?models=${Date.now()}`);
    renderModels(data.models);
    restorePublicJob(data.playground_job);
  }

  function restorePublicJob(job) {
    if (!job || currentJob) return;
    const active = ["queued", "provisioning", "running"].includes(job.status), progress = $("#homeProgress");
    progress.hidden = false; progress.classList.toggle("failed", job.status === "failed");
    const stages = { bootstrap: "GPU 서버가 학습 환경을 준비하고 있어요", code_download: "학습 코드를 내려받고 있어요", code_extract: "학습 코드를 준비하고 있어요", runtime_setup: "Python 학습 도구를 준비하고 있어요", command: "Qwen 7B 모델을 학습하고 있어요" };
    const titles = { queued: "GPU 실행을 기다리고 있어요", provisioning: "GPU 서버를 준비하고 있어요", running: stages[job.stage] || "Qwen 7B 모델을 학습하고 있어요", completed: "학습과 자원 반납이 완료됐어요", failed: "최근 학습을 완료하지 못했어요", cancelled: "최근 학습이 취소됐어요" };
    const errors = { runtime_setup_failed: "서버에 Python 패키지 실행기가 없어 중단됐어요. 수정된 환경으로 다시 실행할 수 있어요.", gpu_quota_unavailable: "공급자 GPU 한도가 없어 실행하지 못했어요.", gpu_capacity_unavailable: "공급자 GPU 가용 용량이 없어 실행하지 못했어요.", worker_failed: "GPU 작업 로그에서 실행 오류가 확인됐어요." };
    $("#homeProgressTitle").textContent = titles[job.status] || "최근 GPU 작업";
    $("#homeProgressCopy").textContent = errors[job.error_code] || `${job.provider === "kakao" ? "카카오" : "네이버"} ${job.flavor_name || "GPU"}${job.usage_amount == null ? "" : ` · 현재 기록 ${won(job.usage_amount)}`}`;
    clearTimeout(publicPollTimer); publicPollTimer = null;
    if (active && document.visibilityState === "visible") publicPollTimer = setTimeout(() => loadPublicModels().catch(() => {}), 30000);
  }

  function requestPassword(summary) {
    const dialog = $("#playgroundPasswordDialog");
    $("#playgroundPasswordSummary").textContent = summary;
    $("#playgroundPassword").value = "";
    $("#playgroundPasswordError").textContent = "";
    dialog.showModal();
    $("#playgroundPassword").focus();
    return new Promise((resolve) => {
      const finish = (value) => { $("#playgroundPasswordForm").removeEventListener("submit", submit); $("#playgroundPasswordClose").removeEventListener("click", cancel); dialog.removeEventListener("cancel", cancel); if (dialog.open) dialog.close(); resolve(value); };
      const submit = async (event) => { event.preventDefault(); const password = $("#playgroundPassword").value.trim(); if (!password) return $("#playgroundPasswordError").textContent = "비밀번호를 입력해주세요."; dialog.setAttribute("busy", ""); try { await api("/api/login", { method: "POST", body: JSON.stringify({ password }) }); finish(password); } catch (error) { $("#playgroundPasswordError").textContent = friendly(error); } finally { dialog.removeAttribute("busy"); } };
      const cancel = (event) => { event.preventDefault(); finish(""); };
      $("#playgroundPasswordForm").addEventListener("submit", submit); $("#playgroundPasswordClose").addEventListener("click", cancel); dialog.addEventListener("cancel", cancel);
    });
  }

  async function loadEnvironment() {
    if (environment) return environment;
    const [storage, naver, kakao, kakaoAll] = await Promise.all([api("/api/ncp-storage?action=buckets"), api("/api/ncp-gpu").catch(() => null), api("/api/cloud?action=readiness").catch(() => null), api("/api/cloud?action=gpu-flavors").catch(() => null)]);
    const bucket = storage.items.find((item) => /artifact|cloud-gpu|work-memory/i.test(item.name))?.name || storage.items[0]?.name;
    if (!bucket) throw new Error("모델을 저장할 버킷이 없어요.");
    let kakaoFallback = null, kakaoT4Fallback = null;
    const image = kakao?.images?.find((item) => /nvidia/i.test(item.name || "")), common = image && kakao?.keypairs?.[0] && kakao?.subnets?.[0] && kakao?.security_groups?.[0] ? { provider: "kakao", bucket, image, keypair: kakao.keypairs[0], subnet: kakao.subnets[0], securityGroup: kakao.security_groups[0], volume: 80 } : null;
    if (common) { const t4 = [...(kakaoAll?.items || [])].filter((item) => /^gn1i\./i.test(item.name) && kakao.pricing?.gpu_hourly?.[item.name]).sort((a, b) => kakao.pricing.gpu_hourly[a.name] - kakao.pricing.gpu_hourly[b.name])[0]; if (t4) kakaoT4Fallback = { ...common, flavor: t4, profile: "qlora-4bit" }; }
    if (kakao?.flavors?.length && common) { const flavor = [...kakao.flavors].filter((item) => item.vram_per_gpu_gb >= 48 && kakao.pricing?.gpu_hourly?.[item.name]).sort((a, b) => kakao.pricing.gpu_hourly[a.name] - kakao.pricing.gpu_hourly[b.name])[0]; if (flavor) kakaoFallback = { ...common, flavor, kakaoT4Fallback, profile: "bf16-lora" }; }
    if (naver?.ok) { const spec = [...naver.specs].filter((item) => item.vram_per_gpu_gb >= 48).sort((a, b) => a.hourly_rate - b.hourly_rate)[0]; if (spec) environment = { provider: "naver", bucket, spec, launch: naver.launch_configs[0], key: naver.keys[0], volume: 50, kakaoFallback }; }
    if (!environment) environment = kakaoFallback || kakaoT4Fallback;
    if (!environment) throw new Error("사용 가능한 48GB 이상 GPU가 없어요.");
    return environment;
  }

  async function uploadBlob(targetBucket, blob, filename, contentType) {
    const key = `gpu-workbench/${Date.now()}-${crypto.randomUUID()}-${filename}`;
    const signed = await api("/api/ncp-storage?action=upload-url", { method: "POST", body: JSON.stringify({ bucket: targetBucket, key }) });
    const uploaded = await fetch(signed.url, { method: "PUT", body: blob, headers: { "content-type": contentType } });
    if (!uploaded.ok) throw new Error("실행 파일 업로드에 실패했어요.");
    await api("/api/ncp-storage?action=upload-complete", { method: "POST", body: JSON.stringify({ bucket: targetBucket, key, size: blob.size }) });
    return key;
  }
  async function uploadBundle(targetBucket) { const response = await fetch("/playground/qwen-lora-playground.zip?v=2"); if (!response.ok) throw new Error("학습 코드를 불러오지 못했어요."); return uploadBlob(targetBucket, await response.blob(), "qwen-lora-playground.zip", "application/zip"); }

  async function launch(job, password, maxMinutes, purpose) {
    currentJob = job; $("#homeProgress").hidden = false; $("#homeProgressTitle").textContent = "48GB GPU를 준비하고 있어요";
    if (environment.provider === "naver") {
      try { await api("/api/ncp-gpu", { method: "POST", body: JSON.stringify({ job_id: job.id, spec_code: environment.spec.serverSpecCode, vpc_no: environment.launch.vpc_no, subnet_no: environment.launch.subnet_no, login_key_name: environment.key.loginKeyName || environment.key.keyName, acg_no: environment.launch.acg_no, max_minutes: maxMinutes, volume_gb: 50, execution_password: password }) }); }
      catch (error) { if (error.message !== "naver_gpu_quota_unavailable" || !environment.kakaoFallback) throw error; environment = environment.kakaoFallback; $("#homeProgressTitle").textContent = "카카오 48GB GPU로 자동 전환하고 있어요"; await launchKakao(job, password, maxMinutes, purpose); }
    } else await launchKakao(job, password, maxMinutes, purpose);
    pollTimer = setInterval(() => { if (document.visibilityState === "visible") pollJob().catch(() => {}); }, 30000); await pollJob();
  }

  async function launchKakao(job, password, maxMinutes, purpose) {
    try { await api("/api/cloud?action=create", { method: "POST", body: JSON.stringify({ job_id: job.id, purpose, flavor_id: environment.flavor.id, image_id: environment.image.id, subnet_id: environment.subnet.id, key_name: environment.keypair.name, security_group: environment.securityGroup.name, max_minutes: maxMinutes, volume_gb: 80, execution_password: password }) }); }
    catch (error) {
      if (!["kakao_gpu_unavailable", "kakao_gpu_activation_timeout"].includes(error.message) || !environment.kakaoT4Fallback) throw error;
      await api("/api/jobs?action=retry", { method: "POST", body: JSON.stringify({ id: job.id }) });
      environment = environment.kakaoT4Fallback;
      $("#homeProgressTitle").textContent = "카카오 T4에서 4-bit QLoRA로 전환하고 있어요";
      await launchKakao(job, password, maxMinutes, purpose);
    }
  }

  function parseResult(text) { for (const line of text.split(/\r?\n/)) if (line.includes("CGR_INFERENCE ")) try { return JSON.parse(line.slice(line.indexOf("CGR_INFERENCE ") + 14)); } catch {} return null; }
  async function pollJob() {
    if (!currentJob) return; const data = await api("/api/jobs"), job = data.items.find((item) => item.id === currentJob.id); if (!job) return;
    currentJob = job; const labels = { queued: "GPU 실행을 기다리고 있어요", provisioning: "48GB GPU를 준비하고 있어요", running: job.task_mode === "inference" ? "저장된 모델이 답변을 만들고 있어요" : "76억 파라미터 모델을 학습하고 있어요", completed: "GPU 작업과 자원 반납이 완료됐어요", failed: "GPU 작업을 완료하지 못했어요", cancelled: "GPU 작업이 취소됐어요" }; $("#homeProgressTitle").textContent = labels[job.status] || job.status;
    if (!["completed", "failed", "cancelled"].includes(job.status)) return; clearInterval(pollTimer); pollTimer = null; $("#playgroundTrain").disabled = false; $("#playgroundInfer").disabled = false;
    if (job.status === "completed" && job.task_mode === "training") await loadPublicModels();
    if (job.status === "completed" && job.task_mode === "inference") { const log = await api(`/api/jobs?action=log-text&id=${encodeURIComponent(job.id)}`), result = parseResult(log.text); if (result) { $("#homeAnswer").hidden = false; $("#homeAnswerText").textContent = result.answer; $("#homeAnswerMeta").textContent = `${result.gpu} · ${result.seconds}초 · ${job.usage_amount == null ? "비용 정산 중" : won(job.usage_amount)}`; } }
  }

  async function train() {
    const password = await requestPassword("Qwen2.5-7B를 가용 GPU에서 최대 60분 학습해요. 48GB급이 막히면 T4용 4-bit QLoRA로 전환하며 실제 크레딧이 차감됩니다."); if (!password) return;
    $("#playgroundTrain").disabled = true; message("#playgroundMessage", "GPU와 예상 비용을 확인하고 있어요.");
    try { const env = await loadEnvironment(), flavor = env.provider === "naver" ? env.spec.serverSpecCode : env.flavor.name, estimate = await api("/api/estimate?type=gpu", { method: "POST", body: JSON.stringify({ provider: env.provider, flavor, minutes: 60, volume_gb: env.volume }) }); message("#playgroundMessage", `최대 예상 ${won(estimate.total)} · 학습 파일을 준비하고 있어요.`); const codeKey = await uploadBundle(env.bucket), created = await api("/api/jobs", { method: "POST", body: JSON.stringify({ type: "custom-gpu", task_mode: "training", preset_id: "qwen-lora-v1", provider: env.provider, bucket: env.bucket, code_key: codeKey, command: "python3 -m pip install -r requirements.txt && python3 train.py", output_path: "outputs" }) }); await launch(created.job, password, 60, "qwen-lora-training"); message("#playgroundMessage", ""); } catch (error) { message("#playgroundMessage", friendly(error)); $("#playgroundTrain").disabled = false; }
  }

  async function infer() {
    const prompt = $("#homePrompt").value.trim(); if (!prompt) return message("#homeInferenceMessage", "질문을 입력해주세요.");
    const password = await requestPassword("저장된 모델을 48GB 이상 GPU에 불러와 최대 30분 추론해요. 실제 크레딧이 차감됩니다."); if (!password) return;
    $("#playgroundInfer").disabled = true; message("#homeInferenceMessage", "모델과 GPU를 확인하고 있어요.");
    try { const env = await loadEnvironment(), privateModels = await api("/api/models"), model = privateModels.items.find((item) => item.id === selectedModelId); if (!model) throw new Error("model_not_found"); const flavor = env.provider === "naver" ? env.spec.serverSpecCode : env.flavor.name, estimate = await api("/api/estimate?type=gpu", { method: "POST", body: JSON.stringify({ provider: env.provider, flavor, minutes: 30, volume_gb: env.volume }) }); message("#homeInferenceMessage", `최대 예상 ${won(estimate.total)} · 질문을 준비하고 있어요.`); const [codeKey, dataKey] = await Promise.all([uploadBundle(model.bucket), uploadBlob(model.bucket, new Blob([prompt], { type: "text/plain;charset=utf-8" }), "prompt.txt", "text/plain;charset=utf-8")]); const created = await api("/api/jobs", { method: "POST", body: JSON.stringify({ type: "custom-gpu", task_mode: "inference", preset_id: "qwen-lora-v1", provider: env.provider, bucket: model.bucket, code_key: codeKey, data_key: dataKey, model_key: model.artifact_key, model_id: model.id, command: "python3 -m pip install -r requirements.txt && python3 infer.py", output_path: "outputs" }) }); await launch(created.job, password, 30, "qwen-lora-inference"); message("#homeInferenceMessage", ""); } catch (error) { message("#homeInferenceMessage", friendly(error)); $("#playgroundInfer").disabled = false; }
  }

  $("#homeModelList").addEventListener("click", (event) => { const id = event.target.dataset.homeModel; if (!id) return; selectedModelId = id; const model = publicModels.find((item) => item.id === id); $("#homeInference").hidden = false; $("#homeInferenceTitle").textContent = `${model?.name || "저장된 모델"} v${model?.version || ""}과 대화하기`; $("#homeInference").scrollIntoView({ behavior: "smooth", block: "center" }); });
  $("#playgroundTrain").addEventListener("click", train); $("#playgroundInfer").addEventListener("click", infer);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !currentJob) loadPublicModels().catch(() => {}); else if (document.visibilityState !== "visible") { clearTimeout(publicPollTimer); publicPollTimer = null; } });
  loadPublicModels().catch(() => { $("#homeModelList").innerHTML = '<p class="playground-empty">모델 목록을 불러오지 못했어요. 새로고침 후 다시 확인해주세요.</p>'; });
})();
