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
async function api(url, o = {}) {
  const r = await fetch(url, {
      headers: { "content-type": "application/json" },
      ...o,
    }),
    d = await r.json();
  if (!r.ok) throw new Error(d.error || `요청 실패 (${r.status})`);
  return d;
}
function render(run) {
  $("#result").classList.remove("hidden");
  $("#result").innerHTML =
    `<div class="result-head"><div><span>검색 결과</span><h2>${run.count}건 수집 · 전체 일치 ${run.total.toLocaleString()}건</h2><p>${safe(run.query)}</p></div><a href="/api/research?id=${run.id}&format=csv">CSV 받기</a></div><div class="papers">${run.items.map((x) => `<article><span>${safe(x.year || "연도 미상")} · PMID ${safe(x.pmid)}</span><h3><a href="${x.url}" target="_blank">${safe(x.title || "제목 없음")}</a></h3><p>${safe(x.abstract || "초록 없음")}</p><small>${safe(x.authors)} · ${safe(x.journal)}${x.doi ? ` · DOI ${safe(x.doi)}` : ""}</small></article>`).join("")}</div>`;
  $("#result").scrollIntoView({ behavior: "smooth" });
}
async function loadRuns() {
  const d = await api("/api/research");
  $("#runs").innerHTML = d.runs.length
    ? d.runs
        .map(
          (x) =>
            `<button data-id="${x.id}"><b>${safe(x.query)}</b><span>${new Date(x.created_at).toLocaleString("ko-KR")} · ${x.count}건</span></button>`,
        )
        .join("")
    : '<div class="empty">아직 실행한 검색이 없습니다.</div>';
}
document.querySelector(".templates").onclick = (e) => {
  const b = e.target.closest("[data-query]");
  if (b) $("#query").value = b.dataset.query;
};
$("#run").onclick = async () => {
  const query = $("#query").value.trim();
  if (query.length < 3)
    return ($("#status").textContent = "검색식을 입력해 주세요.");
  $("#run").disabled = true;
  $("#status").textContent = "PubMed에서 최신 문헌을 찾고 초록을 수집하는 중…";
  try {
    const d = await api("/api/research", {
      method: "POST",
      body: JSON.stringify({ query, limit: Number($("#limit").value) }),
    });
    $("#status").textContent = `완료 · ${d.run.count}건 저장`;
    render(d.run);
    await loadRuns();
  } catch (x) {
    $("#status").textContent = `오류: ${x.message}`;
  } finally {
    $("#run").disabled = false;
  }
};
$("#runs").onclick = async (e) => {
  const b = e.target.closest("[data-id]");
  if (!b) return;
  $("#status").textContent = "저장된 검색을 불러오는 중…";
  try {
    const d = await api(`/api/research?id=${b.dataset.id}`);
    render(d.run);
    $("#status").textContent = "저장된 검색을 불러왔습니다.";
  } catch (x) {
    $("#status").textContent = `오류: ${x.message}`;
  }
};
loadRuns().catch(
  (x) => ($("#status").textContent = `기록 조회 오류: ${x.message}`),
);
