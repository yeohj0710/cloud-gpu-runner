const $ = (selector) => document.querySelector(selector);
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const won = (value) => `${Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원`;
let environment = null;
let bucket = "";
let currentJob = null;
let pollTimer = null;

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "content-type": "application/json" }, ...options });
  if (response.status === 401) { location.replace("/login.html"); throw new Error("로그인이 필요해요."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`);
  return data;
}

function errorText(error) {
  const text = String(error?.message || error);
  return ({ execution_password_invalid: "실행 비밀번호가 올바르지 않아요.", another_gpu_job_active: "이미 실행 중인 GPU 작업이 있어요.", credit_insufficient: "남은 크레딧이 예상 비용보다 부족해요.", credit_expired: "사용 가능한 크레딧이 만료됐어요.", missing_configuration: "GPU 실행 환경 준비가 부족해요." }[text] || text);
}

async function loadEnvironment() {
  const [storage, naver, kakao] = await Promise.all([
    api("/api/ncp-storage?action=buckets"),
    api("/api/ncp-gpu").catch(() => null),
    api("/api/cloud?action=readiness").catch(() => null),
  ]);
  bucket = storage.items.find((item) => /artifact|cloud-gpu|work-memory/i.test(item.name))?.name || storage.items[0]?.name || "";
  if (!bucket) throw new Error("실험 결과를 저장할 버킷이 없어요.");

  if (naver?.ok) {
    const spec = [...naver.specs].filter((item) => item.vram_per_gpu_gb >= 48).sort((a, b) => a.hourly_rate - b.hourly_rate)[0];
    if (spec) environment = { provider: "naver", spec, launch: naver.launch_configs[0], key: naver.keys[0], minutes: 30, volume: 50 };
  }
  if (!environment && kakao?.flavors?.length) {
    const flavor = [...kakao.flavors].filter((item) => item.vram_per_gpu_gb >= 48 && kakao.pricing?.gpu_hourly?.[item.name]).sort((a, b) => kakao.pricing.gpu_hourly[a.name] - kakao.pricing.gpu_hourly[b.name])[0];
    const image = kakao.images?.find((item) => /nvidia/i.test(item.name || ""));
    if (flavor && image && kakao.keypairs?.[0] && kakao.subnets?.[0]) environment = { provider: "kakao", flavor, image, keypair: kakao.keypairs[0], subnet: kakao.subnets[0], securityGroup: kakao.security_groups[0], minutes: 30, volume: 80 };
  }
  if (!environment) throw new Error("지금 사용할 수 있는 48GB 이상 GPU가 없어요.");

  const flavor = environment.provider === "naver" ? environment.spec.serverSpecCode : environment.flavor.name;
  const estimate = await api("/api/estimate?type=gpu", { method: "POST", body: JSON.stringify({ provider: environment.provider, flavor, minutes: environment.minutes, volume_gb: environment.volume }) });
  environment.estimate = estimate;
  const providerName = environment.provider === "naver" ? "네이버클라우드" : "카카오클라우드";
  const gpuName = environment.provider === "naver" ? environment.spec.serverSpecCode : environment.flavor.name;
  $("#costTotal").textContent = won(estimate.total);
  $("#providerLine").textContent = `${providerName} · ${gpuName} · 최대 30분 후 자동 종료`;
  $("#readyBadge").textContent = "GPU 준비됨";
  $("#experimentState").textContent = "바로 실행 가능";
  $("#experimentState").classList.add("ready");
  $("#run").disabled = false;
}

async function uploadPreset() {
  $("#message").textContent = "준비된 학습 코드를 올리고 있어요…";
  const response = await fetch("/playground/mnist-playground.zip");
  if (!response.ok) throw new Error("준비된 실험 파일을 불러오지 못했어요.");
  const blob = await response.blob();
  const key = `gpu-workbench/${Date.now()}-${crypto.randomUUID()}-mnist-playground.zip`;
  const signed = await api("/api/ncp-storage?action=upload-url", { method: "POST", body: JSON.stringify({ bucket, key }) });
  const uploaded = await fetch(signed.url, { method: "PUT", body: blob, headers: { "content-type": "application/zip" } });
  if (!uploaded.ok) throw new Error("학습 코드 준비에 실패했어요.");
  await api("/api/ncp-storage?action=upload-complete", { method: "POST", body: JSON.stringify({ bucket, key, size: blob.size }) });
  return key;
}

function requestExecutionPassword() {
  const dialog = $("#executionDialog");
  const provider = environment.provider === "naver" ? "네이버클라우드" : "카카오클라우드";
  $("#executionSummary").textContent = `${provider} GPU에서 최대 30분 동안 AI를 학습해요. 예상 최대 비용은 ${won(environment.estimate.total)}이며 실제 크레딧이 차감됩니다.`;
  $("#executionPassword").value = "";
  $("#executionError").textContent = "";
  dialog.showModal();
  $("#executionPassword").focus();
  return new Promise((resolve) => {
    const finish = (value) => { $("#executionForm").removeEventListener("submit", submit); $("#executionCancel").removeEventListener("click", cancel); dialog.removeEventListener("cancel", cancel); if (dialog.open) dialog.close(); resolve(value); };
    const submit = (event) => { event.preventDefault(); const value = $("#executionPassword").value.trim(); if (!value) { $("#executionError").textContent = "실행 비밀번호를 입력해주세요."; return; } finish(value); };
    const cancel = (event) => { event.preventDefault(); finish(""); };
    $("#executionForm").addEventListener("submit", submit);
    $("#executionCancel").addEventListener("click", cancel);
    dialog.addEventListener("cancel", cancel);
  });
}

async function runExperiment() {
  if (!environment) return;
  const password = await requestExecutionPassword();
  if (!password) return;
  $("#run").disabled = true;
  try {
    const codeKey = await uploadPreset();
    const created = await api("/api/jobs", { method: "POST", body: JSON.stringify({ type: "custom-gpu", task_mode: "training", provider: environment.provider, bucket, code_key: codeKey, command: "pip install -r requirements.txt && python train_and_infer.py", output_path: "outputs" }) });
    currentJob = created.job;
    if (environment.provider === "naver") {
      const loginKeyName = environment.key.loginKeyName || environment.key.keyName;
      await api("/api/ncp-gpu", { method: "POST", body: JSON.stringify({ job_id: currentJob.id, spec_code: environment.spec.serverSpecCode, vpc_no: environment.launch.vpc_no, subnet_no: environment.launch.subnet_no, login_key_name: loginKeyName, acg_no: environment.launch.acg_no, max_minutes: 30, volume_gb: 50, execution_password: password }) });
    } else {
      await api("/api/cloud?action=create", { method: "POST", body: JSON.stringify({ job_id: currentJob.id, purpose: "mnist-playground", flavor_id: environment.flavor.id, image_id: environment.image.id, subnet_id: environment.subnet.id, key_name: environment.keypair.name, security_group: environment.securityGroup.name, max_minutes: 30, volume_gb: 80, execution_password: password }) });
    }
    $("#message").textContent = "";
    showProgress({ ...currentJob, status: "provisioning" });
    await loadJobs();
    startPolling();
  } catch (error) {
    $("#message").textContent = errorText(error);
    $("#run").disabled = false;
  }
}

function showProgress(job) {
  $("#progressSection").hidden = false;
  $("#progressSection").scrollIntoView({ behavior: "smooth", block: "center" });
  const order = { queued: 0, provisioning: 0, running: 1, completed: 2 };
  const position = order[job.status] ?? 0;
  document.querySelectorAll(".timeline>div").forEach((item, index) => { item.classList.toggle("done", index < position); item.classList.toggle("active", index === position); });
  $("#progressTitle").textContent = job.status === "running" ? "AI가 손글씨를 배우고 있어요" : job.status === "completed" ? "학습과 추론이 끝났어요" : job.status === "failed" ? "학습을 완료하지 못했어요" : "클라우드 GPU를 준비하고 있어요";
  $("#cancel").hidden = !["queued", "provisioning", "running"].includes(job.status);
}

function parseLog(text) {
  const result = { metrics: [], predictions: [], summary: null };
  for (const line of text.split(/\r?\n/)) {
    for (const [prefix, key] of [["CGR_METRIC ", "metrics"], ["CGR_PREDICTION ", "predictions"]]) if (line.includes(prefix)) { try { result[key].push(JSON.parse(line.slice(line.indexOf(prefix) + prefix.length))); } catch {} }
    if (line.includes("CGR_SUMMARY ")) { try { const prefix = "CGR_SUMMARY "; result.summary = JSON.parse(line.slice(line.indexOf(prefix) + prefix.length)); } catch {} }
  }
  return result;
}

async function showResult(job) {
  const log = await api(`/api/jobs?action=log-text&id=${encodeURIComponent(job.id)}`);
  const result = parseLog(log.text);
  if (!result.summary) throw new Error("결과를 정리하고 있어요. 잠시 후 다시 확인해주세요.");
  $("#resultSection").hidden = false;
  $("#accuracy").textContent = `${result.summary.final_accuracy}%`;
  $("#trainingTime").textContent = `${result.summary.seconds}초`;
  $("#actualCost").textContent = job.usage_amount == null ? "정산 중" : won(job.usage_amount);
  $("#predictions").innerHTML = result.predictions.map((item) => `<article class="prediction"><span class="digit">${item.answer}</span><small>AI의 답 ${item.prediction}</small><b>${item.confidence}% 확신</b></article>`).join("");
  $("#epochs").innerHTML = result.metrics.map((item) => `<div class="epoch"><b>${item.epoch}회차</b><div class="bar"><i style="width:${Math.min(100, item.accuracy)}%"></i></div><strong>${item.accuracy}%</strong></div>`).join("");
  $("#resultDownload").href = `/api/jobs?action=result&id=${encodeURIComponent(job.id)}`;
  $("#logDownload").href = `/api/jobs?action=log&id=${encodeURIComponent(job.id)}`;
  $("#resultSection").scrollIntoView({ behavior: "smooth" });
}

async function loadJobs() {
  const data = await api("/api/jobs");
  const items = data.items.filter((job) => job.type === "custom-gpu" && /mnist-playground\.zip$/i.test(job.code_key || ""));
  $("#jobs").innerHTML = items.length ? items.slice(0, 8).map((job) => `<article class="job"><div><h3>손글씨 숫자 분류 AI</h3><p>${new Date(job.created_at).toLocaleString("ko-KR")} · ${{ queued: "대기", provisioning: "GPU 준비 중", running: "학습 중", completed: "완료", failed: "실패", cancelled: "취소" }[job.status] || safe(job.status)}${job.usage_amount != null ? ` · ${won(job.usage_amount)}` : ""}</p></div>${job.status === "completed" ? `<button data-result="${safe(job.id)}">결과 보기</button>` : ""}</article>`).join("") : '<p class="empty">아직 실행한 실험이 없어요.</p>';
  const active = items.find((job) => ["queued", "provisioning", "running"].includes(job.status));
  if (active) { currentJob = active; showProgress(active); }
  if (currentJob) {
    const fresh = items.find((job) => job.id === currentJob.id);
    if (fresh) { currentJob = fresh; showProgress(fresh); if (fresh.status === "completed" && $("#resultSection").hidden) await showResult(fresh).catch(() => {}); if (["completed", "failed", "cancelled"].includes(fresh.status)) { clearInterval(pollTimer); pollTimer = null; $("#run").disabled = false; } }
  }
}

function startPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = setInterval(() => loadJobs().catch(() => {}), 10000); }

$("#run").addEventListener("click", runExperiment);
$("#refresh").addEventListener("click", () => loadJobs().catch((error) => $("#message").textContent = errorText(error)));
$("#cancel").addEventListener("click", async () => { if (!currentJob || !confirm("실행 중인 GPU를 취소하고 반납할까요?")) return; await api("/api/jobs?action=cancel", { method: "POST", body: JSON.stringify({ id: currentJob.id }) }); await loadJobs(); });
$("#jobs").addEventListener("click", async (event) => { const id = event.target.dataset.result; if (!id) return; const data = await api("/api/jobs"); const job = data.items.find((item) => item.id === id); if (job) await showResult(job).catch((error) => alert(errorText(error))); });

Promise.all([loadEnvironment(), loadJobs()]).catch((error) => { $("#readyBadge").textContent = "확인 필요"; $("#experimentState").textContent = "준비 오류"; $("#message").textContent = errorText(error); });
