const $ = (selector) => document.querySelector(selector);
const won = (value) => `${Math.round(Number(value || 0)).toLocaleString("ko-KR")}원`;
const date = (value) => value ? new Date(value).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const duration = (seconds) => {
  const value = Math.max(0, Number(seconds || 0));
  if (!value) return "—";
  if (value < 60) return `${Math.round(value)}초`;
  const minutes = Math.floor(value / 60), rest = Math.round(value % 60);
  return rest ? `${minutes}분 ${rest}초` : `${minutes}분`;
};
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const providerName = (provider) => provider === "kakao" ? "KakaoCloud" : "NAVER Cloud";
const jobName = (job) => {
  const command = String(job.command || "");
  if (/smoke\.py/i.test(command)) return "GPU 연결 점검";
  if (/train/i.test(command)) return "모델 학습";
  if (/infer|predict/i.test(command)) return "대량 추론";
  return command ? command.replace(/^python3?\s+/, "").slice(0, 54) : "GPU 작업";
};
const statusInfo = (status) => ({ completed: ["완료", "success"], failed: ["실패", "failed"], cancelled: ["취소", "muted"], running: ["실행 중", "running"], provisioning: ["준비 중", "running"], queued: ["대기", "muted"] }[status] || [status || "알 수 없음", "muted"]);

async function json(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) return location.replace("/login.html");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "정보를 불러오지 못했어요.");
  return data;
}

let jobs = [], currentFilter = "all";
function cleanup(job) {
  if (!job.instance_id) return { text: "할당 없음", tone: "muted" };
  if (job.instance_deleted_at && (!job.public_ip_id || job.public_ip_removed_at)) return { text: "반납 완료", tone: "success" };
  return { text: job.cleanup_error ? "확인 필요" : "사용 중", tone: job.cleanup_error ? "failed" : "running" };
}
function filterJobs(items) {
  if (currentFilter === "all") return items;
  if (currentFilter === "running") return items.filter((x) => !["completed", "failed", "cancelled"].includes(x.status));
  return items.filter((x) => x.status === currentFilter);
}
function renderJobs() {
  const items = filterJobs(jobs).slice(0, 20);
  $("#emptyJobs").hidden = items.length > 0;
  $("#jobRows").innerHTML = items.map((job) => {
    const [label, tone] = statusInfo(job.status), resource = cleanup(job);
    const breakdown = `GPU ${won(job.usage_gpu_amount)} · 디스크 ${won(job.usage_disk_amount)} · 공인 IP ${won(job.usage_public_ip_amount)}`;
    return `<tr class="job-row"><td><button class="job-title" data-toggle-job="${safe(job.id)}"><b>${safe(jobName(job))}</b><small>${safe(job.command || job.id.slice(0, 8))}</small></button></td><td>${providerName(job.provider)}</td><td><span class="badge ${tone}">${label}</span></td><td>${duration(job.usage_seconds)}</td><td><b>${job.usage_amount == null ? "—" : won(job.usage_amount)}</b></td><td><span class="resource ${resource.tone}"><i></i>${resource.text}</span></td><td>${date(job.started_at || job.created_at)}</td></tr><tr class="job-detail" data-detail="${safe(job.id)}" hidden><td colspan="7"><div><span><b>작업 ID</b>${safe(job.id)}</span><span><b>비용 구성</b>${breakdown}</span><span><b>결과 경로</b>${safe(job.output_path || "outputs")}</span><span><b>실패 원인</b>${safe(job.error || "없음")}</span></div></td></tr>`;
  }).join("");
  $("#jobCards").innerHTML = items.map((job) => {
    const [label, tone] = statusInfo(job.status), resource = cleanup(job);
    return `<article><div class="job-card-head"><b>${safe(jobName(job))}</b><span class="badge ${tone}">${label}</span></div><p class="command">${safe(job.command || job.id)}</p><dl><div><dt>공급자</dt><dd>${providerName(job.provider)}</dd></div><div><dt>비용</dt><dd>${job.usage_amount == null ? "—" : won(job.usage_amount)}</dd></div><div><dt>실행시간</dt><dd>${duration(job.usage_seconds)}</dd></div><div><dt>자원</dt><dd class="${resource.tone}">${resource.text}</dd></div></dl>${job.error ? `<p class="mobile-error">${safe(job.error)}</p>` : ""}<small>${date(job.started_at || job.created_at)}</small></article>`;
  }).join("");
}

function renderUsage(usage) {
  const totalRemaining = Math.round(usage.remaining.naver) + Math.round(usage.remaining.kakao);
  $("#totalRemaining").textContent = won(totalRemaining);
  $("#updatedAt").textContent = `${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준`;
  $("#providerCards").innerHTML = ["naver", "kakao"].map((provider) => {
    const credit = usage.credits[provider], used = usage.totals[provider], remaining = usage.remaining[provider];
    const percent = credit ? Math.min(100, Math.max(0, remaining / credit * 100)) : 0;
    return `<article class="provider-card ${provider}"><div class="provider-name"><i></i><span>${providerName(provider)}</span><em>${percent.toFixed(1)}% 남음</em></div><strong>${won(remaining)}</strong><div class="progress"><i style="width:${percent}%"></i></div><div class="provider-meta"><span>지급 ${won(credit)}</span><span>사용 ${won(used)}</span></div></article>`;
  }).join("");
  const categories = Object.entries(usage.categories || {}).sort((a, b) => b[1] - a[1]);
  const categoryNames = { gpu: "GPU 실행", storage: "스토리지", storage_request: "스토리지 요청" };
  const max = Math.max(1, ...categories.map(([, amount]) => Number(amount)));
  $("#usageSummary").textContent = `표시 합계 ${won(Math.round(usage.totals.naver) + Math.round(usage.totals.kakao))}`;
  $("#categoryBars").innerHTML = categories.length ? categories.map(([name, amount]) => `<div class="category-row"><span>${categoryNames[name] || safe(name)}</span><div><i style="width:${Math.max(2, Number(amount) / max * 100)}%"></i></div><b>${won(amount)}</b></div>`).join("") : '<div class="empty">아직 기록된 사용량이 없어요.</div>';
  const meaningfulEvents = (usage.events || []).filter((event) => event.category === "gpu" || Number(event.amount) >= 0.5);
  const meaningful = meaningfulEvents.slice(0, 15);
  const hiddenCount = Math.max(0, (usage.events || []).length - meaningfulEvents.length);
  $("#eventSummary").textContent = hiddenCount ? `1원 미만 인프라 요청 ${hiddenCount}건은 숨겼어요.` : "GPU 실행비 중심으로 보여드려요.";
  $("#eventList").innerHTML = meaningful.map((event) => `<article><div class="event-icon ${event.provider}">${event.provider === "kakao" ? "K" : "N"}</div><div><b>${safe(event.category === "gpu" ? "GPU 실행" : event.label || event.action)}</b><p>${safe(event.label || "")} · ${providerName(event.provider)} · ${date(event.created_at)}</p></div><strong>${won(event.amount)}</strong></article>`).join("") || '<div class="empty">아직 의미 있는 비용 기록이 없어요.</div>';
}

async function load() {
  $("#refresh").disabled = true;
  try {
    const [usage, jobData] = await Promise.all([json("/api/usage"), json("/api/jobs")]);
    jobs = (jobData.items || []).filter((x) => x.type === "custom-gpu" || x.instance_id || x.usage_amount);
    renderUsage(usage); renderJobs(); document.body.classList.remove("loading");
  } catch (error) {
    $("#errorToast").textContent = error.message; $("#errorToast").hidden = false;
  } finally { $("#refresh").disabled = false; }
}

document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((x) => x.classList.remove("active"));
  button.classList.add("active"); currentFilter = button.dataset.filter; renderJobs();
}));
$("#jobRows").addEventListener("click", (event) => { const button = event.target.closest("[data-toggle-job]"); if (!button) return; const detail = document.querySelector(`[data-detail="${button.dataset.toggleJob}"]`); detail.hidden = !detail.hidden; });
$("#refresh").addEventListener("click", load);
$("#logout").addEventListener("click", async () => { await fetch("/api/login", { method: "DELETE" }); location.replace("/login.html"); });
load();
