const $ = (selector) => document.querySelector(selector);
let overview = null;

function toast(message, bad = false) {
  const el = $("#toast"); el.textContent = message; el.className = `toast show${bad ? " bad" : ""}`;
  setTimeout(() => el.className = "toast", 3200);
}
async function api(path, options) {
  const response = await fetch(path, {headers: {"content-type": "application/json"}, ...options});
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "요청에 실패했습니다."); return data;
}
function time(value) { return value ? new Date(value).toLocaleTimeString("ko-KR", {hour:"2-digit", minute:"2-digit"}) : "-"; }
function escapeHtml(value = "") { const el = document.createElement("span"); el.textContent = value; return el.innerHTML; }

async function loadOverview() {
  overview = await api("/api/overview");
  const running = !overview.capture.paused;
  $("#recordingBadge").textContent = running ? "● 기록 중" : "Ⅱ 일시정지";
  $("#recordingBadge").className = `status ${running ? "running" : "paused"}`;
  $("#todayFrames").textContent = `${overview.counts.today_frames.toLocaleString()}장`;
  $("#todaySessions").textContent = `${overview.counts.today_sessions.toLocaleString()}개`;
  $("#workWindow").textContent = overview.work_window.first ? `${time(overview.work_window.first)}–${time(overview.work_window.last)}` : "기록 없음";
  $("#excludedApps").textContent = `${overview.excluded_apps.join(", ")} 등을 자동 제외합니다.`;
  $("#retention").textContent = `원본 기본 보존기간은 ${overview.retention_days}일입니다.`;
  $("#consentButton").textContent = overview.consent ? "동의 철회" : "수집에 동의";
}
async function loadSessions() {
  const {items} = await api("/api/sessions");
  $("#sessions").innerHTML = items.length ? items.map(item => `<article><div class="time">${time(item.started_at)}<span>${Math.max(1, Math.round(item.duration_seconds/60))}분</span></div><div><strong>${escapeHtml(item.app || "알 수 없는 앱")}</strong><p>${escapeHtml(item.title || item.summary)}</p><small>${item.frame_count}개 장면</small></div></article>`).join("") : '<div class="empty">오늘 생성된 업무 세션이 없습니다.</div>';
}
async function search(query = "") {
  const {items} = await api(`/api/search?q=${encodeURIComponent(query)}`);
  $("#searchResults").innerHTML = items.length ? items.map(item => `<article><div><strong>${escapeHtml(item.title || "제목 없음")}</strong><p>${escapeHtml(item.app || "알 수 없는 앱")} · ${new Date(item.captured_at).toLocaleString("ko-KR")}</p></div><button class="delete" data-id="${encodeURIComponent(item.id)}">기록 삭제</button></article>`).join("") : '<div class="empty">일치하는 기록이 없습니다.</div>';
}
$("#searchForm").addEventListener("submit", async event => { event.preventDefault(); try { await search($("#searchInput").value); } catch(e) { toast(e.message, true); } });
$("#searchResults").addEventListener("click", async event => { const button = event.target.closest(".delete"); if (!button || !confirm("이 검색 기록 메타데이터를 삭제할까요?")) return; try { await api(`/api/frame/${button.dataset.id}`, {method:"DELETE"}); await search($("#searchInput").value); toast("기록을 삭제했습니다."); } catch(e) { toast(e.message, true); } });
$("#syncButton").addEventListener("click", async () => { try { const data = await api("/api/ingest", {method:"POST", body:"{}"}); toast(`${data.result.imported}개 장면을 가져왔습니다.`); await Promise.all([loadOverview(), loadSessions(), search("")]); } catch(e) { toast(e.message, true); } });
$("#consentButton").addEventListener("click", async () => { const agreed = !overview.consent; if (agreed && !confirm("업무 화면 기록을 검색·요약하기 위해 로컬 매니페스트를 수집하는 데 동의할까요? 언제든 철회할 수 있습니다.")) return; try { await api("/api/consent", {method:"POST", body:JSON.stringify({agreed})}); await loadOverview(); toast(agreed ? "동의를 기록했습니다." : "동의를 철회했습니다."); } catch(e) { toast(e.message, true); } });
$("#gpuButton").addEventListener("click", async () => { try { const data = await api("/api/gpu/jobs", {method:"POST", body:JSON.stringify({limit:5000})}); $("#gpuDetail").textContent = `${data.job.input_count}장 · ${data.job.max_runtime_minutes}분 상한 · dry-run`; toast("GPU 작업 명세를 만들었습니다. 실제 VM은 생성하지 않았습니다."); } catch(e) { toast(e.message, true); } });

Promise.all([loadOverview(), loadSessions(), search("")]).catch(error => toast(error.message, true));

