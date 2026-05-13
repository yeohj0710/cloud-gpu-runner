import { DashboardConsole } from "@/components/dashboard-console";
import { getEnvStatus } from "@/lib/ncp/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <DashboardConsole initialConfig={getEnvStatus()} />
      <script
        dangerouslySetInnerHTML={{
          __html: `
(() => {
  const resultRoot = () => document.getElementById("run-result-content");
  const tokenInput = () => document.getElementById("run-token");
  const monthInput = () => document.getElementById("billing-month");

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const badge = (value, tone) => '<span class="badge badge-' + tone + '">' + escapeHtml(value) + '</span>';
  const stepClass = (status) => "step step-" + (status || "planned");

  const renderLoading = (title) => {
    const root = resultRoot();
    if (!root) return;
    root.innerHTML =
      '<div class="empty-state"><div><span class="spinner" aria-hidden="true"></span><p>' +
      escapeHtml(title) +
      ' 실행 중...</p></div></div>';
  };

  const renderResult = (payload) => {
    const root = resultRoot();
    if (!root) return;
    const steps = Array.isArray(payload.steps) ? payload.steps : [];
    const details = [
      payload.httpStatus ? ["HTTP", payload.httpStatus] : null,
      payload.returnCode ? ["Return code", payload.returnCode] : null,
      Array.isArray(payload.regions) ? ["Regions", payload.regions.join(", ")] : null,
      payload.month ? ["Month", payload.month] : null,
      payload.rowCount !== undefined ? ["Billing rows", payload.rowCount] : null,
      payload.totals ? ["Demand", Object.entries(payload.totals).map(([k, v]) => String(v).toLocaleString() + " " + k).join(", ") || "No rows"] : null,
      payload.credentialsKind ? ["Credentials", payload.credentialsKind] : null,
      payload.bucketName ? ["Bucket", payload.bucketName] : null,
      payload.objectName ? ["Object", payload.objectName] : null
    ].filter(Boolean);

    root.innerHTML =
      '<div class="result">' +
        '<div class="result-header">' +
          '<div class="result-title">' +
            '<h3>' + escapeHtml(payload.title || "Result") + '</h3>' +
            '<p class="subtle">' + escapeHtml(payload.message || payload.costCap || "Completed") + '</p>' +
          '</div>' +
          badge(payload.ok ? "OK" : "Blocked", payload.ok ? "ok" : "blocked") +
        '</div>' +
        (steps.length ? '<div class="step-list">' + steps.map((step) =>
          '<div class="' + stepClass(step.status) + '">' +
            '<span class="step-dot" aria-hidden="true"></span>' +
            '<div><strong>' + escapeHtml(step.label) + '</strong>' +
              (step.detail ? '<p class="subtle">' + escapeHtml(step.detail) + '</p>' : '') +
            '</div>' +
          '</div>'
        ).join('') + '</div>' : '') +
        (details.length ? '<div class="details">' + details.map(([label, value]) =>
          '<div class="detail-row"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>'
        ).join('') + '</div>' : '') +
      '</div>';
  };

  async function run(button) {
    const endpoint = button.dataset.endpoint;
    const mode = button.dataset.mode || "dry-run";
    const experiment = button.dataset.experiment;
    if (!endpoint) return;

    renderLoading(button.dataset.title || "Experiment");

    try {
      const headers = { "content-type": "application/json" };
      const token = tokenInput()?.value;
      if (token) headers["x-dashboard-run-token"] = token;

      const body = { mode };
      if (experiment === "cost") {
        body.month = monthInput()?.value || "202605";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      renderResult(await response.json());
    } catch (error) {
      renderResult({ ok: false, title: "Request failed", message: error?.message || "Unknown error" });
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    const savedToken = window.localStorage.getItem("cloud-credit-run-token");
    if (savedToken && tokenInput()) tokenInput().value = savedToken;
  });

  document.addEventListener("click", (event) => {
    const runButton = event.target.closest("[data-run-experiment]");
    if (runButton) {
      event.preventDefault();
      run(runButton);
      return;
    }

    const saveButton = event.target.closest("[data-save-run-token]");
    if (saveButton) {
      event.preventDefault();
      window.localStorage.setItem("cloud-credit-run-token", tokenInput()?.value || "");
    }
  });
})();
          `,
        }}
      />
    </>
  );
}
