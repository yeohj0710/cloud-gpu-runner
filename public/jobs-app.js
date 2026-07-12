const $ = (s) => document.querySelector(s),
  safe = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const mediaPattern = /\.(mp3|wav|m4a|aac|ogg|flac|mp4|mov|webm|mkv|avi)$/i;
let bucket = "",
  objects = [],
  selected = null,
  jobs = [],
  readiness = null,
  runJob = null,
  resultData = null;
let recorder = null,
  recordStream = null,
  recordChunks = [],
  recordedFile = null,
  recordStartedAt = 0,
  recordTimerId = null,
  recordPreviewUrl = "";
async function api(url, options = {}) {
  const r = await fetch(url, {
      headers: { "content-type": "application/json" },
      ...options,
    }),
    type = r.headers.get("content-type") || "";
  if (!type.includes("json")) {
    if (!r.ok) throw new Error(`요청 실패 (${r.status})`);
    return r;
  }
  const d = await r.json();
  if (!r.ok) throw new Error(translateError(d.error) || "요청 실패");
  return d;
}
function translateError(code) {
  return (
    {
      input_required: "파일을 선택해 주세요.",
      input_not_found:
        "선택한 파일을 찾지 못했습니다. 목록을 새로고침해 주세요.",
      missing_configuration: "GPU 실행 환경이 아직 준비되지 않았습니다.",
      job_not_found: "작업을 찾지 못했습니다.",
      cancel_running_job_first: "실행 중인 작업은 먼저 취소해 주세요.",
      nvidia_image_required: "NVIDIA 드라이버가 포함된 이미지를 선택해 주세요.",
    }[code] || code
  );
}
function showMessage(text, error = false) {
  $("#message").textContent = text;
  $("#message").classList.toggle("error", error);
}
function baseName(key) {
  return String(key).split("/").pop();
}
function mediaIcon(key) {
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(key) ? "▶" : "♪";
}
function sizeText(size) {
  if (size < 1048576) return `${Math.max(1, Math.round(size / 1024))}KB`;
  return `${(size / 1048576).toFixed(size > 10485760 ? 0 : 1)}MB`;
}
function dateText(value) {
  return value
    ? new Date(value).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}
function money(value) {
  return `${Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: Number(value) < 1 ? 4 : 2 })}원`;
}
function recordingMimeType() {
  return (
    [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ].find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || ""
  );
}
function formatRecordTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function resetRecording() {
  if (recordPreviewUrl) URL.revokeObjectURL(recordPreviewUrl);
  recordPreviewUrl = "";
  recordedFile = null;
  $("#recordPlayer").removeAttribute("src");
  $("#recordPreview").classList.add("hidden");
  $("#recordActive").classList.add("hidden");
  $("#recordIdle").classList.remove("hidden");
  $("#recordHelp").textContent =
    "예: “오늘 오후 세 시에 배포 오류를 확인하고 고객에게 결과를 공유했습니다.”";
}
async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    return showMessage(
      "이 브라우저는 마이크 녹음을 지원하지 않습니다. Chrome 최신 버전이나 파일 선택을 이용해 주세요.",
      true,
    );
  }
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    const mimeType = recordingMimeType();
    recorder = new MediaRecorder(
      recordStream,
      mimeType ? { mimeType } : undefined,
    );
    recordChunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) recordChunks.push(event.data);
    };
    recorder.onstop = finishRecording;
    recorder.start(500);
    recordStartedAt = Date.now();
    $("#recordIdle").classList.add("hidden");
    $("#recordPreview").classList.add("hidden");
    $("#recordActive").classList.remove("hidden");
    $("#recordHelp").textContent =
      "마이크 입력은 아직 이 브라우저 안에만 있습니다.";
    recordTimerId = setInterval(() => {
      const elapsed = Date.now() - recordStartedAt;
      $("#recordTimer").textContent = formatRecordTime(elapsed);
      if (elapsed >= 300000) stopRecording();
    }, 250);
  } catch (error) {
    const denied = error.name === "NotAllowedError";
    showMessage(
      denied
        ? "마이크 권한이 차단됐습니다. 주소창 왼쪽 설정에서 마이크를 허용해 주세요."
        : `녹음을 시작하지 못했습니다: ${error.message}`,
      true,
    );
  }
}
function stopRecording() {
  if (recorder?.state === "recording") recorder.stop();
}
function finishRecording() {
  clearInterval(recordTimerId);
  recordStream?.getTracks().forEach((track) => track.stop());
  const mime = recorder?.mimeType || "audio/webm";
  const blob = new Blob(recordChunks, { type: mime });
  const extension = mime.includes("mp4")
    ? "m4a"
    : mime.includes("ogg")
      ? "ogg"
      : "webm";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  recordedFile = new File([blob], `live-recording-${stamp}.${extension}`, {
    type: mime,
  });
  recordPreviewUrl = URL.createObjectURL(blob);
  $("#recordPlayer").src = recordPreviewUrl;
  $("#recordInfo").textContent =
    `${formatRecordTime(Date.now() - recordStartedAt)} · ${sizeText(blob.size)} · 올리기 전에는 비용 0원`;
  $("#recordActive").classList.add("hidden");
  $("#recordPreview").classList.remove("hidden");
  $("#recordHelp").textContent =
    "미리 들어본 뒤 ‘이 녹음 올리기’를 눌러야 저장소와 분석 흐름으로 넘어갑니다.";
}
async function loadFiles() {
  const buckets = await api("/api/ncp-storage?action=buckets");
  if (!buckets.items.length)
    throw new Error("네이버 저장소에 버킷이 없습니다.");
  bucket =
    buckets.items.find((x) => /artifact|cloud-credit|work-memory/i.test(x.name))
      ?.name || buckets.items[0].name;
  const data = await api(
    `/api/ncp-storage?action=objects&bucket=${encodeURIComponent(bucket)}`,
  );
  objects = data.items.filter((x) => mediaPattern.test(x.key));
  renderFiles();
}
function renderFiles() {
  const q = $("#fileSearch").value.trim().toLowerCase(),
    items = objects.filter((x) => !q || x.key.toLowerCase().includes(q));
  $("#fileCount").textContent = `미디어 ${objects.length}개`;
  $("#mediaLibrary").innerHTML = items.length
    ? items
        .map(
          (x) =>
            `<div class="media-card ${selected?.key === x.key ? "selected" : ""}" data-key="${safe(x.key)}" role="button" tabindex="0"><span class="media-type">${mediaIcon(x.key)}</span><div><b title="${safe(x.key)}">${safe(baseName(x.key))}</b><small>${sizeText(x.size)} · ${dateText(x.last_modified)}</small></div><button class="file-delete" data-remove-file="${safe(x.key)}" aria-label="${safe(baseName(x.key))} 삭제">삭제</button><span class="check"></span></div>`,
        )
        .join("")
    : `<div class="empty-state">${objects.length ? "검색 결과가 없습니다." : "아직 올린 녹화·음성 파일이 없습니다."}<button data-upload>컴퓨터에서 파일 선택</button></div>`;
}
function chooseObject(key) {
  selected = objects.find((x) => x.key === key) || null;
  renderFiles();
  if (!selected) {
    $("#selectedFile").className = "selected-file empty-selection";
    $("#selectedFile").textContent = "먼저 위에서 파일을 선택하세요.";
    $("#createJob").disabled = true;
    return;
  }
  $("#selectedFile").className = "selected-file";
  $("#selectedFile").innerHTML =
    `<span class="media-type">${mediaIcon(selected.key)}</span><div><b>${safe(baseName(selected.key))}</b><small>${sizeText(selected.size)} · ${safe(bucket)}</small></div>`;
  $("#createJob").disabled = false;
  $("#settingsSection").scrollIntoView({ behavior: "smooth", block: "start" });
}
function validFile(file) {
  return (
    file &&
    (file.type.startsWith("audio/") ||
      file.type.startsWith("video/") ||
      mediaPattern.test(file.name))
  );
}
async function upload(file) {
  if (!validFile(file))
    return (
      showMessage("지원하는 녹화·음성 파일을 선택해 주세요.", true),
      false
    );
  const storage30Days = (file.size / 1073741824) * 28;
  const uploadCost = 0.0045;
  if (
    !confirm(
      `${file.name}\n\n예상 비용(VAT 별도)\n· 업로드 API: ${money(uploadCost)}\n· 30일 보관: ${money(storage30Days)}\n· 합계: ${money(uploadCost + storage30Days)}\n\n업로드할까요?`,
    )
  )
    return false;
  if (!bucket) await loadFiles();
  const clean = file.name.replace(/[^a-zA-Z0-9가-힣._ -]/g, "_").slice(-140),
    key = `uploads/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${clean}`;
  $("#uploadProgress").classList.remove("hidden");
  $("#uploadName").textContent = file.name;
  $("#uploadPercent").textContent = "0%";
  $("#uploadBar").style.width = "0%";
  $("#uploadStatus").textContent = "안전한 업로드 주소를 준비하는 중…";
  try {
    const signed = await api("/api/ncp-storage?action=upload-url", {
      method: "POST",
      body: JSON.stringify({ bucket, key }),
    });
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signed.url);
      xhr.setRequestHeader(
        "content-type",
        file.type || "application/octet-stream",
      );
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        $("#uploadPercent").textContent = `${pct}%`;
        $("#uploadBar").style.width = `${pct}%`;
        $("#uploadStatus").textContent =
          `${sizeText(e.loaded)} / ${sizeText(e.total)} 업로드 중`;
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`업로드 실패 (${xhr.status})`));
      xhr.onerror = () => reject(new Error("네트워크 연결이 끊겼습니다."));
      xhr.send(file);
    });
    await api("/api/ncp-storage?action=upload-complete", {
      method: "POST",
      body: JSON.stringify({ bucket, key, size: file.size }),
    });
    $("#uploadStatus").textContent = "업로드 완료 · 비용 기록 완료";
    await loadFiles();
    chooseObject(key);
    showMessage("파일을 올렸고 예상 보관 비용을 기록했습니다.");
    setTimeout(() => $("#uploadProgress").classList.add("hidden"), 1800);
    return true;
  } catch (e) {
    $("#uploadStatus").textContent = e.message;
    showMessage(e.message, true);
    return false;
  }
}
async function createJob() {
  if (!selected) return;
  $("#createJob").disabled = true;
  showMessage("분석 작업을 만드는 중…");
  try {
    const data = await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        bucket,
        key: selected.key,
        language: $("#language").value,
      }),
    });
    showMessage("작업을 만들었습니다. 아래에서 GPU 분석을 시작하세요.");
    await loadJobs();
    document
      .querySelector(`[data-job="${data.job.id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (e) {
    showMessage(e.message, true);
  } finally {
    $("#createJob").disabled = false;
  }
}
const statusLabels = {
  queued: "분석 시작 대기",
  provisioning: "GPU 준비 중",
  running: "음성 분석 중",
  completed: "분석 완료",
  failed: "분석 실패",
  cancelled: "취소됨",
};
const statusIcon = {
  queued: "…",
  provisioning: "↻",
  running: "↻",
  completed: "✓",
  failed: "!",
  cancelled: "×",
};
async function loadJobs() {
  const data = await api("/api/jobs");
  jobs = data.items;
  renderJobs();
}
function renderJobs() {
  $("#jobs").innerHTML = jobs.length
    ? jobs
        .map((j) => {
          const active = ["provisioning", "running"].includes(j.status),
            finished = j.status === "completed",
            retry = ["failed", "cancelled"].includes(j.status),
            cost =
              j.usage_amount != null
                ? ` · 사용 ${money(j.usage_amount)}`
                : j.hourly_rate
                  ? ` · ${money(j.hourly_rate)}/시간 계측 중`
                  : "";
          return `<article class="job-card" data-job="${j.id}"><span class="status-icon ${j.status}">${statusIcon[j.status] || "·"}</span><div><h3>${safe(baseName(j.key))}</h3><p>${safe(statusLabels[j.status] || j.status)} · ${dateText(j.created_at)}${cost}${j.error ? ` · ${safe(j.error)}` : ""}</p></div><div class="job-actions">${j.status === "queued" ? `<button class="run" data-run="${j.id}">GPU 분석 시작</button>` : ""}${active ? `<button class="cancel" data-cancel="${j.id}">작업 취소</button>` : ""}${finished ? `<button class="view" data-view="${j.id}">결과 보기</button>` : ""}${retry ? `<button data-retry="${j.id}">다시 시도</button>` : ""}${!active ? `<button data-delete="${j.id}">기록 삭제</button>` : ""}</div></article>`;
        })
        .join("")
    : '<div class="empty-state">등록된 분석 작업이 없습니다. 위에서 파일을 선택해 첫 작업을 만들어 보세요.</div>';
}
async function loadReadiness() {
  try {
    readiness = await api("/api/cloud?action=readiness");
    const active = readiness.subnets.filter(
        (x) => (x.provisioning_status || x.status) === "ACTIVE",
      ),
      missing = [];
    if (!active.length) missing.push("카카오 서브넷 생성 중");
    if (!readiness.keypairs.length) missing.push("SSH 키 없음");
    if (!readiness.flavors.length) missing.push("GPU 사양 없음");
    $("#cloudReadiness").classList.toggle("waiting", missing.length > 0);
    $("#cloudReadiness").textContent = missing.length
      ? `${missing.join(" · ")} — 작업은 미리 등록할 수 있고 준비되면 바로 실행할 수 있어요.`
      : `GPU 실행 준비 완료 · ${readiness.flavors.length}개 사양 사용 가능`;
    return missing.length === 0;
  } catch (e) {
    $("#cloudReadiness").classList.add("waiting");
    $("#cloudReadiness").textContent = `GPU 상태 확인 실패: ${e.message}`;
    return false;
  }
}
function openRun(id) {
  runJob = jobs.find((x) => x.id === id);
  if (!runJob) return;
  $("#runFileName").textContent = baseName(runJob.key);
  const active =
      readiness?.subnets.filter(
        (x) => (x.provisioning_status || x.status) === "ACTIVE",
      ) || [],
    gpuImages = (readiness?.images || []).filter(
      (x) => /ubuntu/i.test(x.name || "") && /nvidia/i.test(x.name || ""),
    ),
    ready =
      active.length &&
      readiness.keypairs.length &&
      readiness.flavors.length &&
      gpuImages.length;
  $("#runUnavailable").classList.toggle("hidden", ready);
  $("#runUnavailable").textContent = gpuImages.length
    ? "카카오 네트워크가 아직 생성 중입니다. 작업은 안전하게 대기 상태로 보관됩니다."
    : "NVIDIA 드라이버가 포함된 Ubuntu 이미지가 없어 GPU 분석을 시작할 수 없습니다.";
  $("#runSettings").classList.toggle("hidden", !ready);
  $("#startGpu").disabled = !ready;
  if (ready) {
    const sorted = [...readiness.flavors].sort(
      (a, b) => (a.vcpus || 999) - (b.vcpus || 999),
    );
    $("#gpuFlavor").innerHTML = sorted
      .map(
        (x) =>
          `<option value="${safe(x.id)}">${safe(x.name)} · ${x.vcpus || 0} vCPU · ${Math.round((x.memory_mb || 0) / 1024)}GB</option>`,
      )
      .join("");
    $("#gpuImage").innerHTML = gpuImages
      .sort((a, b) => /22\.04/.test(b.name) - /22\.04/.test(a.name))
      .map((x) => `<option value="${safe(x.id)}">${safe(x.name)}</option>`)
      .join("");
  }
  $("#runDialog").showModal();
  updateRunEstimate();
}

function updateRunEstimate() {
  if (!readiness || !$("#runDialog").open) return;
  const flavor = readiness.flavors.find(
    (item) => item.id === $("#gpuFlavor").value,
  );
  const hours = Number($("#maxMinutes").value) / 60;
  const volume = Number($("#volumeGb").value);
  const gpuHourly = Number(readiness.pricing?.gpu_hourly?.[flavor?.name] || 0);
  const diskHourly =
    volume * Number(readiness.pricing?.block_storage_gib_hour || 0.16);
  const total = (gpuHourly + diskHourly) * hours;
  let box = $("#costEstimate");
  if (!box) {
    box = document.createElement("div");
    box.id = "costEstimate";
    box.className = "cost-estimate";
    document.querySelector(".cost-warning").before(box);
  }
  box.innerHTML = `<span>최대 예상 비용 · VAT 별도</span><b>${money(total)}</b><small>GPU ${money(gpuHourly * hours)} + ${volume}GB 디스크 ${money(diskHourly * hours)} · 실제 사용시간이 짧으면 감소</small>`;
}
async function startGpu() {
  const subnet = readiness.subnets.find(
      (x) => (x.provisioning_status || x.status) === "ACTIVE",
    ),
    key =
      readiness.keypairs.find((x) => x.name === "work-memory") ||
      readiness.keypairs[0];
  $("#startGpu").disabled = true;
  $("#startGpu").textContent = "GPU 생성 중…";
  try {
    await api("/api/cloud?action=create", {
      method: "POST",
      body: JSON.stringify({
        purpose: "whisper-transcription",
        job_id: runJob.id,
        flavor_id: $("#gpuFlavor").value,
        image_id: $("#gpuImage").value,
        subnet_id: subnet.id,
        security_group: "default",
        key_name: key.name,
        max_minutes: Number($("#maxMinutes").value),
        volume_gb: Number($("#volumeGb").value),
      }),
    });
    $("#runDialog").close();
    await loadJobs();
  } catch (e) {
    alert(`GPU 시작 실패: ${e.message}`);
  } finally {
    $("#startGpu").disabled = false;
    $("#startGpu").textContent = "GPU로 분석 시작";
  }
}
async function cancelJob(id) {
  if (!confirm("실행 중인 GPU를 삭제하고 작업을 취소할까요?")) return;
  await api("/api/jobs?action=cancel", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
  await loadJobs();
}
async function retryJob(id) {
  try {
    await api("/api/jobs?action=retry", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    await loadJobs();
  } catch (e) {
    alert(`다시 시도 준비 실패: ${e.message}`);
  }
}
async function deleteJob(id) {
  if (!confirm("작업 기록을 삭제할까요? 원본 파일은 유지됩니다.")) return;
  await api(`/api/jobs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadJobs();
}
async function viewResult(id) {
  const job = jobs.find((x) => x.id === id);
  $("#resultEmpty").classList.add("hidden");
  $("#resultPanel").classList.remove("hidden");
  $("#resultTitle").textContent = baseName(job.key);
  $("#downloadResult").href =
    `/api/jobs?action=result&id=${encodeURIComponent(id)}`;
  $("#resultText").textContent = "결과를 불러오는 중…";
  $("#segmentList").innerHTML = "";
  try {
    const [result, media] = await Promise.all([
      api(`/api/jobs?action=result&id=${encodeURIComponent(id)}`),
      api(`/api/jobs?action=media-url&id=${encodeURIComponent(id)}`),
    ]);
    resultData = result;
    $("#mediaPlayer").src = media.url;
    $("#resultLanguage").textContent = result.language || job.language;
    $("#resultDuration").textContent = formatTime(result.duration || 0);
    $("#resultSegments").textContent = `${result.segments?.length || 0}개`;
    renderResult("");
    $("#resultPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    $("#resultText").textContent = `결과 조회 실패: ${e.message}`;
  }
}
function formatTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0)),
    m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
function highlight(text, q) {
  if (!q) return safe(text);
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe(text).replace(
    new RegExp(escaped, "gi"),
    (m) => `<mark>${m}</mark>`,
  );
}
function renderResult(query) {
  if (!resultData) return;
  const q = query.trim(),
    segments = resultData.segments || [],
    filtered = q
      ? segments.filter((x) =>
          String(x.text).toLowerCase().includes(q.toLowerCase()),
        )
      : segments;
  $("#resultText").innerHTML = q
    ? `‘<b>${safe(q)}</b>’ 검색 결과 ${filtered.length}개`
    : safe(resultData.text || "");
  $("#segmentList").innerHTML = filtered.length
    ? filtered
        .map(
          (x) =>
            `<article class="segment"><button data-seek="${Number(x.start) || 0}">${formatTime(x.start)}</button><p>${highlight(x.text, q)}</p></article>`,
        )
        .join("")
    : `<div class="empty-state">일치하는 구간이 없습니다.</div>`;
}
async function removeFile(key) {
  if (
    jobs.some(
      (j) =>
        j.key === key &&
        ["queued", "provisioning", "running"].includes(j.status),
    )
  )
    return alert(
      "대기 또는 실행 중인 작업에서 사용하는 파일입니다. 작업을 먼저 취소하거나 삭제해 주세요.",
    );
  if (!confirm(`${baseName(key)} 파일을 저장소에서 삭제할까요?`)) return;
  try {
    await api(
      `/api/ncp-storage?action=object&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`,
      { method: "DELETE" },
    );
    if (selected?.key === key) chooseObject("");
    await loadFiles();
  } catch (e) {
    alert(`파일 삭제 실패: ${e.message}`);
  }
}
$("#dropzone").onclick = () => $("#uploadFile").click();
$("#startRecord").onclick = startRecording;
$("#stopRecord").onclick = stopRecording;
$("#discardRecord").onclick = resetRecording;
$("#uploadRecord").onclick = async () => {
  if (!recordedFile) return;
  $("#uploadRecord").disabled = true;
  try {
    if (await upload(recordedFile)) resetRecording();
  } finally {
    $("#uploadRecord").disabled = false;
  }
};
$("#dropzone").onkeydown = (e) => {
  if (e.key === "Enter" || e.key === " ") $("#uploadFile").click();
};
$("#uploadFile").onchange = (e) => upload(e.target.files[0]);
["dragenter", "dragover"].forEach((type) =>
  $("#dropzone").addEventListener(type, (e) => {
    e.preventDefault();
    $("#dropzone").classList.add("drag");
  }),
);
["dragleave", "drop"].forEach((type) =>
  $("#dropzone").addEventListener(type, (e) => {
    e.preventDefault();
    $("#dropzone").classList.remove("drag");
  }),
);
$("#dropzone").addEventListener("drop", (e) => upload(e.dataTransfer.files[0]));
$("#mediaLibrary").onclick = (e) => {
  const uploadButton = e.target.closest("[data-upload]");
  if (uploadButton) return $("#uploadFile").click();
  const remove = e.target.closest("[data-remove-file]");
  if (remove) return removeFile(remove.dataset.removeFile);
  const card = e.target.closest("[data-key]");
  if (card) chooseObject(card.dataset.key);
};
$("#mediaLibrary").onkeydown = (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-key]"))
    chooseObject(e.target.dataset.key);
};
$("#fileSearch").oninput = renderFiles;
$("#refreshFiles").onclick = () =>
  loadFiles().catch((e) => showMessage(e.message, true));
$("#createJob").onclick = createJob;
$("#refreshJobs").onclick = loadJobs;
$("#jobs").onclick = (e) => {
  const run = e.target.closest("[data-run]"),
    cancel = e.target.closest("[data-cancel]"),
    retry = e.target.closest("[data-retry]"),
    del = e.target.closest("[data-delete]"),
    view = e.target.closest("[data-view]");
  if (run) openRun(run.dataset.run);
  if (cancel) cancelJob(cancel.dataset.cancel);
  if (retry) retryJob(retry.dataset.retry);
  if (del) deleteJob(del.dataset.delete);
  if (view) viewResult(view.dataset.view);
};
$("#startGpu").onclick = startGpu;
$("#gpuFlavor").onchange = updateRunEstimate;
$("#maxMinutes").onchange = updateRunEstimate;
$("#volumeGb").onchange = updateRunEstimate;
$("#resultSearch").oninput = (e) => renderResult(e.target.value);
$("#segmentList").onclick = (e) => {
  const b = e.target.closest("[data-seek]");
  if (b) {
    $("#mediaPlayer").currentTime = Number(b.dataset.seek);
    $("#mediaPlayer").play();
  }
};
$("#helpButton").onclick = () => $("#helpDialog").showModal();
Promise.all([loadFiles(), loadJobs(), loadReadiness()]).catch((e) =>
  showMessage(`초기화 오류: ${e.message}`, true),
);
setInterval(() => {
  if (jobs.some((x) => ["provisioning", "running"].includes(x.status)))
    loadJobs().catch(() => {});
}, 10000);
