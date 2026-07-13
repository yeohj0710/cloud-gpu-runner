const $ = (s) => document.querySelector(s);
let bucket = "",
  kakao = null,
  naver = null,
  estimate = null;
const safe = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const won = (v) =>
  `${Number(v || 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`;
async function api(url, options = {}) {
  const r = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `요청 실패 (${r.status})`);
  return d;
}
function errorText(e) {
  const t = String(e.message || e);
  return (
    {
      code_and_command_required: "코드 파일과 실행 명령을 확인해주세요.",
      code_archive_required: "코드는 ZIP 또는 tar.gz 파일이어야 해요.",
      missing_configuration: "GPU 실행 환경 설정이 부족해요.",
      ncp_gpu_spec_unavailable:
        "현재 계정에서 선택한 네이버 GPU를 만들 수 없어요.",
      ncp_gpu_network_configuration_missing:
        "네이버 VPC·Subnet·ACG·로그인 키가 필요해요.",
      input_not_found: "올린 파일을 찾지 못했어요.",
    }[t] || t
  );
}
function selectedMode() {
  return (
    document.querySelector('input[name="provider"]:checked')?.value || "auto"
  );
}
function activeProvider() {
  const mode = selectedMode();
  return mode === "auto" ? (naver?.ok ? "naver" : "kakao") : mode;
}
function providerReady(provider) {
  return provider === "naver" ? Boolean(naver?.ok) : Boolean(kakao?.ready);
}
function updateProviderCards() {
  const naverText = naver?.ok
    ? `사용 가능 · ${naver.specs.length}개 사양 · 7/31 만료분 우선`
    : `준비 필요${naver?.missing?.length ? ` · ${naver.missing.join(", ")}` : ""}`;
  $("#naverState").textContent = naverText;
  $("#setupNaver").classList.toggle("hidden", Boolean(naver?.ok));
  $("#kakaoState").textContent = kakao?.ready
    ? `사용 가능 · ${kakao.flavors.length}개 사양 · 2027/5/31 만료`
    : "준비 필요";
  $("#autoState").textContent = naver?.ok
    ? "네이버 우선 선택 · 실패 시 카카오를 직접 선택"
    : "네이버 미준비 · 카카오 선택";
  const provider = activeProvider();
  $("#providerDecision").textContent =
    `이번 작업: ${provider === "naver" ? "네이버클라우드" : "카카오클라우드"} GPU`;
  $("#readyBadge").textContent = providerReady(provider)
    ? `${provider === "naver" ? "네이버" : "카카오"} GPU 준비됨`
    : "GPU 설정 확인 필요";
  loadFlavors();
}
function loadFlavors() {
  const provider = activeProvider();
  if (provider === "naver") $("#volume").value = "50";
  else if ($("#volume").value === "50") $("#volume").value = "80";
  const rows =
    provider === "naver"
      ? (naver?.specs || []).map((x) => ({
          id: x.serverSpecCode,
          name: x.serverSpecCode,
          label: x.label,
          rate: x.hourly_rate,
        }))
      : (kakao?.flavors || [])
          .map((x) => ({
            id: x.id,
            name: x.name,
            label: `NVIDIA ${String(x.hw_name || "GPU").toUpperCase()} ${x.hw_count || 1}개`,
            rate: kakao.pricing.gpu_hourly[x.name],
          }))
          .filter((x) => x.rate)
          .sort((a, b) => a.rate - b.rate);
  $("#flavor").innerHTML = rows
    .map(
      (x) =>
        `<option value="${safe(x.id)}" data-name="${safe(x.name)}">${safe(x.name)} · ${safe(x.label)} · 시간당 ${won(x.rate)}</option>`,
    )
    .join("");
  $("#run").disabled = !providerReady(provider) || !rows.length;
  calculate().catch((e) => ($("#message").textContent = errorText(e)));
}
async function upload(file, prefix) {
  if (!file) return "";
  const key = `gpu-workbench/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/[^\p{L}\p{N}._-]/gu, "-")}`;
  $("#uploadState").textContent = `${file.name} 올리는 중…`;
  const signed = await api("/api/ncp-storage?action=upload-url", {
    method: "POST",
    body: JSON.stringify({ bucket, key }),
  });
  const put = await fetch(signed.url, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
  });
  if (!put.ok) throw new Error(`${prefix} 업로드 실패`);
  await api("/api/ncp-storage?action=upload-complete", {
    method: "POST",
    body: JSON.stringify({ bucket, key, size: file.size }),
  });
  return key;
}
async function loadEnvironment() {
  const [b, k, n] = await Promise.all([
    api("/api/ncp-storage?action=buckets"),
    api("/api/cloud?action=readiness").catch((error) => ({ error })),
    api("/api/ncp-gpu").catch((error) => ({ error })),
  ]);
  bucket =
    b.items.find((x) => /artifact|cloud-gpu|work-memory/i.test(x.name))
      ?.name || b.items[0]?.name;
  if (!bucket) throw new Error("네이버 저장소 버킷이 없어요.");
  const flavors = (k.flavors || []).filter(
    (x) =>
      k.pricing?.gpu_hourly?.[x.name] &&
      String(x.manufacturer).toLowerCase() === "nvidia",
  );
  kakao = {
    ...k,
    flavors,
    ready: Boolean(
      flavors.length &&
        k.images?.some((x) => /nvidia/i.test(x.name || "")) &&
        k.keypairs?.length &&
        k.subnets?.length,
    ),
  };
  naver = n;
  updateProviderCards();
}
function savePrivateKey(value) {
  if (!value) return;
  const blob = new Blob([value], { type: "application/x-pem-file" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "cgr-gpu.pem"; link.click(); URL.revokeObjectURL(link.href);
}
async function setupNaver() {
  const button = $("#setupNaver"); button.disabled = true;
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await api("/api/ncp-gpu?action=bootstrap", { method: "POST", body: "{}" });
      savePrivateKey(result.private_key);
      $("#setupNaverState").textContent = result.message || (result.ok ? "네이버 GPU 환경 준비가 끝났어요." : "준비 상태를 확인하는 중…");
      if (result.ok) { naver = result; updateProviderCards(); return; }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error("네이버 환경 생성이 오래 걸리고 있어요. 잠시 후 다시 눌러주세요.");
  } catch (error) { $("#setupNaverState").textContent = errorText(error); }
  finally { button.disabled = false; }
}
async function calculate() {
  const option = $("#flavor").selectedOptions[0];
  if (!option) return;
  estimate = await api("/api/estimate?type=gpu", {
    method: "POST",
    body: JSON.stringify({
      type: "gpu",
      provider: activeProvider(),
      flavor: option.dataset.name,
      minutes: Number($("#minutes").value),
      volume_gb: provider === "naver" ? 50 : Number($("#volume").value),
    }),
  });
  $("#costTotal").textContent = won(estimate.total);
  $("#costBreakdown").textContent =
    `GPU ${won(estimate.gpu)} + 디스크 ${won(estimate.disk)} + 임시 IP ${won(estimate.public_ip)} + 저장소 요청 약 ${won(estimate.object_requests)}`;
}
async function run() {
  const code = $("#codeFile").files[0],
    data = $("#dataFile").files[0],
    command = $("#command").value.trim();
  if (!code || !command) {
    $("#message").textContent = "코드 파일과 실행 명령을 먼저 넣어주세요.";
    return;
  }
  const provider = activeProvider();
  if (!providerReady(provider)) {
    $("#message").textContent = "선택한 클라우드의 GPU 준비가 끝나지 않았어요.";
    return;
  }
  const button = $("#run");
  button.disabled = true;
  try {
    const codeKey = await upload(code, "코드"),
      dataKey = await upload(data, "데이터");
    $("#uploadState").textContent = "파일 업로드 완료. GPU 작업 등록 중…";
    const created = await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        type: "custom-gpu",
        provider: selectedMode(),
        bucket,
        code_key: codeKey,
        data_key: dataKey,
        command,
        output_path: $("#outputPath").value.trim() || "outputs",
      }),
    });
    const option = $("#flavor").selectedOptions[0];
    if (provider === "naver") {
      const launch = naver.launch_configs[0];
      await api("/api/ncp-gpu", {
        method: "POST",
        body: JSON.stringify({
          job_id: created.job.id,
          spec_code: option.value,
          vpc_no: launch.vpc_no,
          subnet_no: launch.subnet_no,
          login_key_name: naver.keys[0].loginKeyName,
          acg_no: launch.acg_no,
          max_minutes: Number($("#minutes").value),
          volume_gb: Number($("#volume").value),
        }),
      });
    } else {
      const image = kakao.images.find((x) => /nvidia/i.test(x.name || ""));
      await api("/api/cloud?action=create", {
        method: "POST",
        body: JSON.stringify({
          job_id: created.job.id,
          purpose: "custom-training",
          flavor_id: option.value,
          image_id: image.id,
          subnet_id: kakao.subnets[0].id,
          key_name: kakao.keypairs[0].name,
          security_group: kakao.security_groups[0].name,
          max_minutes: Number($("#minutes").value),
          volume_gb: Number($("#volume").value),
        }),
      });
    }
    $("#message").textContent =
      `${provider === "naver" ? "네이버" : "카카오"} GPU가 작업을 시작해요. 끝나면 서버를 자동 반납해요.`;
    $("#uploadState").textContent = "실행 요청 완료";
    await loadJobs();
    $("#jobs").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    $("#message").textContent = errorText(e);
  } finally {
    button.disabled = false;
  }
}
async function loadJobs() {
  const d = await api("/api/jobs"),
    items = d.items.filter((x) => x.type === "custom-gpu");
  $("#jobs").innerHTML = items.length
    ? items
        .map(
          (job) =>
            `<article class="job"><div class="job-head"><div><h3>${safe(job.code_key?.split("/").pop() || "GPU 작업")}</h3><p>${safe(job.command)}</p></div><span class="status ${safe(job.status)}">${{ queued: "대기", provisioning: "GPU 생성 중", running: `실행 중 · ${{ bootstrap: "준비", code_download: "코드 받기", code_extract: "압축 풀기", data_download: "데이터 받기", command: "학습 실행" }[job.stage] || "시작"}`, completed: "완료", failed: "실패", cancelled: "취소" }[job.status] || safe(job.status)}</span></div><small>${job.provider === "naver" ? "네이버" : job.provider === "kakao" ? "카카오" : "공급자 선택 중"} · ${new Date(job.created_at).toLocaleString("ko-KR")} · ${safe(job.flavor_name || "GPU 배정 대기")}${job.usage_amount != null ? ` · 실제 비용 ${won(job.usage_amount)}` : ""}</small>${job.error ? `<p>오류: ${safe(job.error)}</p>` : ""}<div class="job-actions">${job.artifacts_ready ? `<a href="/api/jobs?action=result&id=${encodeURIComponent(job.id)}">결과 받기</a><a href="/api/jobs?action=log&id=${encodeURIComponent(job.id)}">로그 받기</a>` : ""}${["queued", "provisioning", "running"].includes(job.status) ? `<button data-cancel="${safe(job.id)}">실행 취소</button>` : ""}</div></article>`,
        )
        .join("")
    : `<p class="empty">아직 실행한 작업이 없어요.</p>`;
}
$("#codeFile").addEventListener(
  "change",
  (e) =>
    ($("#codeName").textContent =
      e.target.files[0]?.name || "ZIP 또는 tar.gz 선택"),
);
$("#dataFile").addEventListener(
  "change",
  (e) =>
    ($("#dataName").textContent =
      e.target.files[0]?.name || "선택 사항 · 대용량 가능"),
);
document
  .querySelectorAll('input[name="provider"]')
  .forEach((x) => x.addEventListener("change", updateProviderCards));
["#flavor", "#minutes", "#volume"].forEach((s) =>
  $(s).addEventListener("change", calculate),
);
$("#run").addEventListener("click", run);
$("#setupNaver").addEventListener("click", setupNaver);
$("#refresh").addEventListener("click", loadJobs);
$("#jobs").addEventListener("click", async (e) => {
  const id = e.target.dataset.cancel;
  if (!id) return;
  e.target.disabled = true;
  try {
    await api("/api/jobs?action=cancel", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    await loadJobs();
  } catch (err) {
    alert(errorText(err));
  }
});
Promise.all([loadEnvironment(), loadJobs()]).catch((e) => {
  $("#readyBadge").textContent = "연결 오류";
  $("#message").textContent = errorText(e);
});
setInterval(() => loadJobs().catch(() => {}), 15000);
