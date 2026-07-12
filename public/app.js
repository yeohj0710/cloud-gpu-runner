const $ = (selector) => document.querySelector(selector);
const safe = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function json(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청 실패");
  return data;
}
const won = (value) =>
  `${Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: Number(value) < 1 ? 4 : 2 })}원`;
async function loadUsage() {
  try {
    const u = await json("/api/usage"),
      total = u.remaining.naver + u.remaining.kakao,
      used = u.totals.naver + u.totals.kakao;
    document.querySelector(".balance strong").textContent = won(total);
    document.querySelector(".balance span").textContent =
      "현재 추정 잔여 크레딧";
    let panel = $("#autoUsage");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "autoUsage";
      panel.className = "usage-panel";
      document.querySelector(".summary").after(panel);
    }
    panel.innerHTML = `<div><span>자동 계측 사용액</span><b>${won(used)}</b></div><div><span>네이버 잔여</span><b>${won(u.remaining.naver)}</b></div><div><span>카카오 잔여</span><b>${won(u.remaining.kakao)}</b></div><a href="#ledger">상세 기록 보기 ↓</a>`;
  } catch (e) {
    console.warn("usage", e.message);
  }
}
document.head.insertAdjacentHTML(
  "beforeend",
  '<link rel="stylesheet" href="/usage.css">',
);
loadUsage();
async function loadAutoUsageEvents() {
  try {
    const u = await json("/api/usage");
    let box = $("#autoUsageEvents");
    if (!box) {
      box = document.createElement("div");
      box.id = "autoUsageEvents";
      box.className = "auto-events";
      $("#ledger").insertBefore(box, $("#form"));
    }
    box.innerHTML = `<h3>자동 비용 기록</h3>${
      u.events.length
        ? u.events
            .slice(0, 12)
            .map(
              (e) =>
                `<article><div><b>${safe(e.label || e.action)}</b><p>${e.provider === "kakao" ? "카카오" : "네이버"} · ${e.category} · ${new Date(e.created_at).toLocaleString("ko-KR")}</p></div><strong>${won(e.amount)}</strong></article>`,
            )
            .join("")
        : '<div class="empty">아직 자동 기록이 없습니다.</div>'
    }`;
  } catch (e) {
    console.warn("usage events", e.message);
  }
}
loadAutoUsageEvents();
$("#logout").onclick = async () => {
  await fetch("/api/login", { method: "DELETE" });
  location.replace("/login.html");
};
document.querySelector('[data-overview="ncp"]').onclick = async (event) => {
  event.target.disabled = true;
  try {
    const data = await json("/api/ncp?action=billing");
    const total = data.items.reduce(
      (sum, item) =>
        sum + Number(item.totalDemandAmount || item.demandAmount || 0),
      0,
    );
    $("#ncpCost").textContent = `${total.toLocaleString("ko-KR")}원`;
    $("#overviewOutput").textContent = data.items.length
      ? data.items
          .map(
            (x) =>
              `${x.productName || x.contractType?.codeName || "서비스"}: ${Number(x.totalDemandAmount || x.demandAmount || 0).toLocaleString()}원`,
          )
          .join("\n")
      : "이번 달 청구 항목이 없습니다.";
  } catch (error) {
    $("#overviewOutput").textContent = `오류: ${error.message}`;
  } finally {
    event.target.disabled = false;
  }
};
document.querySelector('[data-overview="kakao"]').onclick = async (event) => {
  event.target.disabled = true;
  try {
    const data = await json("/api/cloud?action=instances");
    $("#kakaoInstances").textContent = `${data.total}대`;
    $("#overviewOutput").textContent = data.total
      ? data.items
          .map((x) => `${x.name || x.id} · ${x.status || "상태 미상"}`)
          .join("\n")
      : "실행 중인 카카오 인스턴스가 없습니다.";
  } catch (error) {
    $("#overviewOutput").textContent = `오류: ${error.message}`;
  } finally {
    event.target.disabled = false;
  }
};
$("#listGpu").onclick = () =>
  document.querySelector('[data-overview="kakao"]').click();
const option = (value, label) =>
  `<option value="${safe(value)}">${safe(label)}</option>`;
let gpuReadiness = null;
function updateMainGpuEstimate() {
  if (!gpuReadiness || !$("#flavor").value) return;
  const flavor = gpuReadiness.flavors.find((x) => x.id === $("#flavor").value);
  const hourly = Number(gpuReadiness.pricing?.gpu_hourly?.[flavor?.name] || 0);
  const minutes = Math.max(15, Number($("#maxMinutes").value) || 60);
  const volume = Math.max(50, Number($("#volumeGb").value) || 80);
  const gpu = (hourly * minutes) / 60;
  const disk =
    (volume *
      Number(gpuReadiness.pricing?.block_storage_gib_hour || 0.16) *
      minutes) /
    60;
  const requests = 0.0049;
  $("#mainGpuEstimate").innerHTML =
    `<b>최대 예상비용 ${won(gpu + disk + requests)} · VAT 별도</b><small>GPU ${won(gpu)} + 부팅 디스크 ${won(disk)} + 입력 다운로드·결과 저장 요청 약 ${won(requests)}</small><small>실제 비용은 작업이 빨리 끝나 자동 삭제되면 이보다 적을 수 있어요.</small>`;
}
$("#prepareGpu").onclick = async (event) => {
  event.target.disabled = true;
  $("#gpuOutput").textContent = "GPU 실행에 필요한 리소스를 확인 중…";
  try {
    const [data, jobs] = await Promise.all([
      json("/api/cloud?action=readiness"),
      json("/api/jobs"),
    ]);
    gpuReadiness = data;
    const activeSubnets = data.subnets.filter(
      (x) => (x.provisioning_status || x.status || "ACTIVE") === "ACTIVE",
    );
    const compatibleFlavors = data.flavors
      .filter(
        (x) =>
          /nvidia/i.test(x.manufacturer || "") &&
          data.pricing?.gpu_hourly?.[x.name],
      )
      .sort(
        (a, b) =>
          data.pricing.gpu_hourly[a.name] - data.pricing.gpu_hourly[b.name],
      );
    $("#flavor").innerHTML = compatibleFlavors
      .map((x) =>
        option(
          x.id,
          `${x.name} · NVIDIA ${String(x.hw_name || "GPU").toUpperCase()} · ${won(data.pricing.gpu_hourly[x.name])}/시간`,
        ),
      )
      .join("");
    $("#image").innerHTML = data.images
      .filter(
        (x) => /ubuntu/i.test(x.name || "") && /nvidia/i.test(x.name || ""),
      )
      .sort(
        (a, b) => Number(/22\.04/.test(b.name)) - Number(/22\.04/.test(a.name)),
      )
      .map((x) => option(x.id, x.name))
      .join("");
    $("#subnet").innerHTML = activeSubnets
      .map((x) => option(x.id, x.name || x.id))
      .join("");
    $("#securityGroup").innerHTML = data.security_groups
      .map((x) => option(x.name, x.name))
      .join("");
    $("#keypair").innerHTML = data.keypairs
      .map((x) => option(x.name, x.name))
      .join("");
    const queuedJobs = jobs.items.filter((x) => x.status === "queued");
    $("#job").innerHTML =
      '<option value="">실행 대기 작업을 선택하세요</option>' +
      queuedJobs.map((x) => option(x.id, `${x.key} · ${x.status}`)).join("");
    const missing = [];
    if (!activeSubnets.length) missing.push("활성 서브넷");
    if (!data.security_groups.length) missing.push("보안 그룹");
    if (!data.keypairs.length) missing.push("SSH 키페어");
    if (!compatibleFlavors.length) missing.push("지원되는 NVIDIA GPU");
    if (!$("#image").options.length) missing.push("NVIDIA Ubuntu 이미지");
    $("#noGpuJob").classList.toggle(
      "hidden",
      queuedJobs.length > 0 || missing.length > 0,
    );
    $("#gpuOutput").textContent = missing.length
      ? `아직 준비 중이거나 없는 항목: ${missing.join(", ")}`
      : queuedJobs.length
        ? `실행할 작업 ${queuedJobs.length}개를 찾았습니다. 작업과 최대 실행시간을 확인하세요.`
        : "클라우드 연결은 정상입니다. 하지만 실행 대기 작업이 없어 GPU를 만들지 않았습니다.";
    $("#gpuLauncher").classList.toggle(
      "hidden",
      missing.length > 0 || queuedJobs.length === 0,
    );
    updateMainGpuEstimate();
  } catch (error) {
    $("#gpuOutput").textContent = `준비 확인 실패: ${error.message}`;
  } finally {
    event.target.disabled = false;
  }
};
$("#gpuLauncher").onsubmit = async (event) => {
  event.preventDefault();
  if (!$("#job").value)
    return alert(
      "분석할 작업을 선택해 주세요. 파일 없는 GPU는 생성할 수 없습니다.",
    );
  const body = {
    purpose: "whisper-transcription",
    job_id: $("#job").value,
    flavor_id: $("#flavor").value,
    image_id: $("#image").value,
    subnet_id: $("#subnet").value,
    security_group: $("#securityGroup").value,
    key_name: $("#keypair").value,
    max_minutes: Number($("#maxMinutes").value),
    volume_gb: Number($("#volumeGb").value),
  };
  $("#gpuOutput").textContent = "GPU 인스턴스 생성 요청 중…";
  try {
    const data = await json("/api/cloud?action=create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    $("#gpuOutput").textContent =
      `생성 요청 완료\n${JSON.stringify(data.instance, null, 2)}`;
  } catch (error) {
    $("#gpuOutput").textContent = `생성 실패: ${error.message}`;
  }
};
[$("#job"), $("#flavor"), $("#maxMinutes"), $("#volumeGb")].forEach((element) =>
  element.addEventListener("change", updateMainGpuEstimate),
);
let entries = [];
function renderLedger() {
  $("#entries").innerHTML = entries.length
    ? entries
        .slice()
        .reverse()
        .map(
          (x) =>
            `<article><div><b>${safe(x.service)}</b><p>${x.provider === "naver" ? "네이버" : "카카오"} · ${new Date(x.created_at).toLocaleDateString("ko-KR")} · ${x.kind === "actual" ? "확정" : x.kind === "estimated" ? "예상" : "조정"}</p></div><strong>${Number(x.amount).toLocaleString("ko-KR")}원</strong><button class="text-button" data-delete-entry="${safe(x.id)}">삭제</button></article>`,
        )
        .join("")
    : '<div class="empty">아직 기록이 없습니다.</div>';
}
async function loadLedger() {
  try {
    const data = await json("/api/ledger");
    entries = data.entries || [];
    renderLedger();
  } catch (error) {
    $("#entries").innerHTML =
      `<div class="empty">원장 조회 오류: ${safe(error.message)}</div>`;
  }
}
$("#save").onclick = async () => {
  const service = $("#service").value.trim(),
    amount = Number($("#amount").value);
  if (!service || !Number.isFinite(amount) || amount < 0)
    return alert("서비스와 올바른 금액을 입력하세요.");
  try {
    await json("/api/ledger", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: $("#provider").value,
        service,
        amount,
        kind: $("#kind").value,
      }),
    });
    $("#service").value = "";
    $("#amount").value = "";
    await loadLedger();
  } catch (error) {
    alert(`기록 실패: ${error.message}`);
  }
};
$("#entries").onclick = async (event) => {
  const button = event.target.closest("[data-delete-entry]");
  if (!button || !confirm("이 기록을 삭제할까요?")) return;
  await json(
    `/api/ledger?id=${encodeURIComponent(button.dataset.deleteEntry)}`,
    { method: "DELETE" },
  );
  await loadLedger();
};
loadLedger();
