const $ = selector => document.querySelector(selector);
document.querySelectorAll("[data-action]").forEach(button => button.onclick = async () => {
  const action = button.dataset.action;
  button.disabled = true;
  $("#output").textContent = "네이버클라우드 API 조회 중…";
  try {
    const response = await fetch(`/api/ncp?action=${action}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "조회 실패");
    if (action === "status") { $("#status").textContent = `연결됨 · 리전 ${data.items.length}개`; $("#output").textContent = data.items.map(x => `${x.regionName || x.regionCode} · ${x.regionNo || ""}`).join("\n"); }
    if (action === "servers") { $("#servers").textContent = `${data.items.length}대`; $("#output").textContent = data.items.length ? data.items.map(x => `${x.serverName || x.serverInstanceNo} · ${x.serverInstanceStatusName || x.serverInstanceStatus?.codeName || "상태 미상"}`).join("\n") : "실행 중인 서버가 없습니다."; }
    if (action === "billing") { const total = data.items.reduce((sum, x) => sum + Number(x.totalDemandAmount || x.demandAmount || 0), 0); $("#billing").textContent = `${total.toLocaleString("ko-KR")}원`; $("#output").textContent = data.items.length ? data.items.map(x => `${x.productName || x.contractType?.codeName || "서비스"} · ${Number(x.totalDemandAmount || x.demandAmount || 0).toLocaleString("ko-KR")}원`).join("\n") : "이번 달 청구 항목이 없습니다."; }
  } catch (error) { $("#output").textContent = `오류: ${error.message}`; }
  finally { button.disabled = false; }
});
