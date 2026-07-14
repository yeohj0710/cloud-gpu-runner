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
const jobName = (job) => job.kind || "GPU 작업";
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
  if (job.cleanup_verified) return { text: "반납 완료", tone: "success" };
  return { text: ["completed", "failed", "cancelled"].includes(job.status) ? "확인 중" : "사용 중", tone: "running" };
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
    return `<tr class="job-row"><td><b>${safe(jobName(job))}</b><small>민감 정보는 관리자 화면에서만 확인</small></td><td>${providerName(job.provider)}</td><td><span class="badge ${tone}">${label}</span></td><td>${duration(job.usage_seconds)}</td><td><b>${job.usage_amount == null ? "—" : won(job.usage_amount)}</b></td><td><span class="resource ${resource.tone}"><i></i>${resource.text}</span></td><td>${date(job.created_at)}</td></tr>`;
  }).join("");
  $("#jobCards").innerHTML = items.map((job) => {
    const [label, tone] = statusInfo(job.status), resource = cleanup(job);
    return `<article><div class="job-card-head"><b>${safe(jobName(job))}</b><span class="badge ${tone}">${label}</span></div><dl><div><dt>공급자</dt><dd>${providerName(job.provider)}</dd></div><div><dt>비용</dt><dd>${job.usage_amount == null ? "—" : won(job.usage_amount)}</dd></div><div><dt>실행시간</dt><dd>${duration(job.usage_seconds)}</dd></div><div><dt>자원</dt><dd class="${resource.tone}">${resource.text}</dd></div></dl><small>${date(job.created_at)}</small></article>`;
  }).join("");
}

function renderUsage(usage) {
  const totalRemaining = Math.round(usage.remaining.naver) + Math.round(usage.remaining.kakao);
  $("#totalRemaining").textContent = won(totalRemaining);
  $("#updatedAt").textContent = `${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준`;
  $("#providerCards").innerHTML = ["naver", "kakao"].map((provider) => {
    const credit = usage.credits[provider], used = usage.totals[provider], remaining = usage.remaining[provider];
    const percent = credit ? Math.min(100, Math.max(0, remaining / credit * 100)) : 0;
    const expiry = new Date(`${usage.expiry[provider]}T23:59:59+09:00`), days = Math.max(0, Math.ceil((expiry - Date.now()) / 86400000));
    return `<article class="provider-card ${provider}"><div class="provider-name"><i></i><span>${providerName(provider)}</span><em>${percent.toFixed(1)}% 남음</em></div><strong>${won(remaining)}</strong><div class="expiry"><span>사용 기한</span><b>${usage.expiry[provider].replaceAll("-", ".")} · D-${days}</b></div><div class="progress"><i style="width:${percent}%"></i></div><div class="provider-meta"><span>지급 ${won(credit)}</span><span>사용 ${won(used)}</span></div></article>`;
  }).join("");
  const categories = Object.entries(usage.categories || {}).sort((a, b) => b[1] - a[1]);
  const categoryNames = { gpu: "GPU 실행", storage: "스토리지", storage_request: "스토리지 요청" };
  const max = Math.max(1, ...categories.map(([, amount]) => Number(amount)));
  $("#usageSummary").textContent = `표시 합계 ${won(Math.round(usage.totals.naver) + Math.round(usage.totals.kakao))}`;
  $("#categoryBars").innerHTML = categories.length ? categories.map(([name, amount]) => `<div class="category-row"><span>${categoryNames[name] || safe(name)}</span><div><i style="width:${Math.max(2, Number(amount) / max * 100)}%"></i></div><b>${won(amount)}</b></div>`).join("") : '<div class="empty">아직 기록된 사용량이 없어요.</div>';
  $("#eventSummary").textContent = "공개 가능한 실제 비용만 표시해요.";
  $("#eventList").innerHTML = (usage.events || []).map((event) => `<article><div class="event-icon ${event.provider}">${event.provider === "kakao" ? "K" : "N"}</div><div><b>${safe(event.category)}</b><p>${providerName(event.provider)} · ${date(event.created_at)}</p></div><strong>${won(event.amount)}</strong></article>`).join("") || '<div class="empty">아직 의미 있는 비용 기록이 없어요.</div>';
}

async function load() {
  $("#refresh").disabled = true;
  try {
    const usage = await json("/api/public-dashboard");
    jobs = usage.jobs || [];
    renderUsage(usage); renderJobs(); document.body.classList.remove("loading");
  } catch (error) {
    $("#errorToast").textContent = error.message; $("#errorToast").hidden = false;
  } finally { $("#refresh").disabled = false; }
}

document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((x) => x.classList.remove("active"));
  button.classList.add("active"); currentFilter = button.dataset.filter; renderJobs();
}));
$("#refresh").addEventListener("click", load);
load();
