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
    return `<tr><td><b>${safe(job.key?.split("/").pop() || job.id.slice(0, 8))}</b><small>${safe(job.id.slice(0, 8))}</small></td><td>${providerName(job.provider)}</td><td><span class="badge ${tone}">${label}</span></td><td>${duration(job.usage_seconds)}</td><td><b>${job.usage_amount == null ? "—" : won(job.usage_amount)}</b></td><td><span class="resource ${resource.tone}"><i></i>${resource.text}</span></td><td>${date(job.started_at || job.created_at)}</td></tr>`;
  }).join("");
  $("#jobCards").innerHTML = items.map((job) => {
    const [label, tone] = statusInfo(job.status), resource = cleanup(job);
    return `<article><div class="job-card-head"><b>${safe(job.key?.split("/").pop() || job.id.slice(0, 8))}</b><span class="badge ${tone}">${label}</span></div><dl><div><dt>공급자</dt><dd>${providerName(job.provider)}</dd></div><div><dt>비용</dt><dd>${job.usage_amount == null ? "—" : won(job.usage_amount)}</dd></div><div><dt>실행시간</dt><dd>${duration(job.usage_seconds)}</dd></div><div><dt>자원</dt><dd class="${resource.tone}">${resource.text}</dd></div></dl><small>${date(job.started_at || job.created_at)}</small></article>`;
  }).join("");
}

function renderUsage(usage) {
  const totalRemaining = usage.remaining.naver + usage.remaining.kakao;
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
  $("#usageSummary").textContent = `누적 ${won(usage.totals.naver + usage.totals.kakao)}`;
  $("#categoryBars").innerHTML = categories.length ? categories.map(([name, amount]) => `<div class="category-row"><span>${categoryNames[name] || safe(name)}</span><div><i style="width:${Math.max(2, Number(amount) / max * 100)}%"></i></div><b>${won(amount)}</b></div>`).join("") : '<div class="empty">아직 기록된 사용량이 없어요.</div>';
  $("#eventList").innerHTML = (usage.events || []).slice(0, 15).map((event) => `<article><div class="event-icon ${event.provider}">${event.provider === "kakao" ? "K" : "N"}</div><div><b>${safe(event.label || event.action)}</b><p>${providerName(event.provider)} · ${safe(categoryNames[event.category] || event.category)} · ${date(event.created_at)}</p></div><strong>${won(event.amount)}</strong></article>`).join("") || '<div class="empty">아직 소모량 로그가 없어요.</div>';
}

async function load() {
  $("#refresh").disabled = true;
  try {
    const [usage, jobData] = await Promise.all([json("/api/usage"), json("/api/jobs")]);
    jobs = (jobData.items || []).filter((x) => x.type === "custom-gpu" || x.instance_id || x.usage_amount);
    renderUsage(usage); renderJobs();
  } catch (error) {
    $("#errorToast").textContent = error.message; $("#errorToast").hidden = false;
  } finally { $("#refresh").disabled = false; }
}

document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-filter]").forEach((x) => x.classList.remove("active"));
  button.classList.add("active"); currentFilter = button.dataset.filter; renderJobs();
}));
$("#refresh").addEventListener("click", load);
$("#logout").addEventListener("click", async () => { await fetch("/api/login", { method: "DELETE" }); location.replace("/login.html"); });
load();
