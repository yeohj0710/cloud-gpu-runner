"use client";

import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Cloud,
  CreditCard,
  Database,
  Eye,
  KeyRound,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Step = {
  label: string;
  status: "planned" | "ok" | "blocked" | "failed";
  detail?: string;
};

type RunResult = {
  ok: boolean;
  title?: string;
  mode?: "dry-run" | "execute";
  message?: string;
  costCap?: string;
  httpStatus?: number;
  returnCode?: string;
  regions?: string[];
  month?: string;
  rowCount?: number;
  totals?: Record<string, number>;
  endpoint?: string;
  region?: string;
  credentialsKind?: string;
  credentialReady?: boolean;
  bucketName?: string;
  objectName?: string;
  request?: string;
  steps?: Step[];
};

type ConfigStatus = {
  deployed: boolean;
  runTokenConfigured: boolean;
  runTokenRequired: boolean;
  canExecuteWithoutToken: boolean;
  present: Record<string, boolean>;
};

type Experiment = {
  id: "region" | "cost" | "object-storage";
  title: string;
  service: string;
  cost: string;
  endpoint: string;
  icon: typeof Cloud;
  accent: "green" | "amber" | "blue";
  disabled?: boolean;
};

const experiments: Experiment[] = [
  {
    id: "region",
    title: "NCP 인증",
    service: "Region metadata",
    cost: "0 KRW 예상",
    endpoint: "/api/ncp/region-smoke",
    icon: Cloud,
    accent: "green",
  },
  {
    id: "cost",
    title: "비용 스냅샷",
    service: "Billing / Cost",
    cost: "0 KRW 예상",
    endpoint: "/api/ncp/cost-snapshot",
    icon: CreditCard,
    accent: "blue",
  },
  {
    id: "object-storage",
    title: "Object Storage",
    service: "Bucket + tiny object",
    cost: "Tier 1, 1,000 KRW 이하",
    endpoint: "/api/ncp/object-storage-smoke",
    icon: Database,
    accent: "amber",
  },
];

const envLabels = [
  "NCP_ACCESS_KEY_ID",
  "NCP_SECRET_KEY",
  "NCP_API_ENDPOINT",
  "NCP_BILLING_API_ENDPOINT",
  "NCP_OBJECT_STORAGE_ENDPOINT",
  "NCP_OBJECT_STORAGE_ACCESS_KEY_ID",
  "DASHBOARD_RUN_TOKEN",
];

function currentMonth() {
  return new Date().toISOString().slice(0, 7).replace("-", "");
}

function statusClass(status?: string) {
  if (status === "ok") return "step step-ok";
  if (status === "planned") return "step step-planned";
  if (status === "blocked") return "step step-blocked";
  if (status === "failed") return "step step-failed";
  return "step";
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "blocked";
}) {
  return <span className={`badge ${tone === "neutral" ? "" : `badge-${tone}`}`}>{children}</span>;
}

function formatTotals(totals?: Record<string, number>) {
  if (!totals || Object.keys(totals).length === 0) {
    return "No rows";
  }

  return Object.entries(totals)
    .map(([currency, amount]) => `${amount.toLocaleString()} ${currency}`)
    .join(", ");
}

export function DashboardConsole({ initialConfig }: { initialConfig: ConfigStatus }) {
  const [config, setConfig] = useState<ConfigStatus | null>(initialConfig);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [runToken, setRunToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("cloud-credit-run-token") ?? "";
  });
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    const response = await fetch("/api/config/status", { cache: "no-store" });
    const payload = (await response.json()) as { status: ConfigStatus };
    setConfig(payload.status);
  }

  function saveToken() {
    window.localStorage.setItem("cloud-credit-run-token", runToken);
  }

  async function runExperiment(experiment: Experiment, mode: "dry-run" | "execute") {
    setRunning(`${experiment.id}:${mode}`);
    setResult(null);

    try {
      const response = await fetch(experiment.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(runToken ? { "x-dashboard-run-token": runToken } : {}),
        },
        body: JSON.stringify({
          mode,
          ...(experiment.id === "cost" ? { month } : {}),
        }),
      });
      const payload = (await response.json()) as RunResult;
      setResult(payload);
    } catch (error) {
      setResult({
        ok: false,
        title: "Request failed",
        message: error instanceof Error ? error.message : "Unknown client error",
      });
    } finally {
      setRunning(null);
    }
  }

  const envReadyCount = useMemo(() => {
    if (!config) return 0;
    return envLabels.filter((key) => config.present[key]).length;
  }, [config]);

  const tokenTone = config?.runTokenRequired
    ? config.runTokenConfigured
      ? "ok"
      : "blocked"
    : "warn";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="eyebrow">Cloud Credit Lab</p>
            <h1>크레딧 실험 콘솔</h1>
          </div>
        </div>
        <div className="top-actions">
          <button className="button button-ghost" onClick={refreshStatus} type="button">
            <RefreshCcw size={16} aria-hidden="true" />
            상태 새로고침
          </button>
          <a className="button button-ghost" href="/api/config/status" target="_blank">
            <Terminal size={16} aria-hidden="true" />
            API 상태
          </a>
        </div>
      </header>

      <section className="status-grid" aria-label="Dashboard status">
        <div className="metric">
          <div className="metric-label">
            <span>NCP 연결</span>
            <Badge tone={config?.present.NCP_ACCESS_KEY_ID ? "ok" : "blocked"}>
              {config?.present.NCP_ACCESS_KEY_ID ? "Ready" : "Missing"}
            </Badge>
          </div>
          <p className="metric-value">API Gateway</p>
        </div>
        <div className="metric">
          <div className="metric-label">
            <span>비용 확인</span>
            <Badge tone={config?.present.NCP_BILLING_API_ENDPOINT ? "ok" : "blocked"}>
              Billing
            </Badge>
          </div>
          <p className="metric-value">Snapshot</p>
        </div>
        <div className="metric">
          <div className="metric-label">
            <span>실행 보호</span>
            <Badge tone={tokenTone}>{config?.runTokenRequired ? "Token" : "Local"}</Badge>
          </div>
          <p className="metric-value">{config?.runTokenRequired ? "Locked" : "Open"}</p>
        </div>
        <div className="metric">
          <div className="metric-label">
            <span>환경변수</span>
            <Badge tone={envReadyCount >= 5 ? "ok" : "warn"}>{envReadyCount}/{envLabels.length}</Badge>
          </div>
          <p className="metric-value">Server only</p>
        </div>
      </section>

      <div className="layout-grid">
        <section className="panel" aria-labelledby="experiments-title">
          <div className="panel-header">
            <div>
              <h2 id="experiments-title">Playground</h2>
              <p className="subtle">Dry run이 기본값이고 실행은 서버 API에서만 처리됩니다.</p>
            </div>
            <Badge tone="ok">
              <ShieldCheck size={14} aria-hidden="true" />
              secret hidden
            </Badge>
          </div>
          <div className="panel-body">
            <div className="experiments">
              {experiments.map((experiment) => {
                const Icon = experiment.icon;
                const dryRunKey = `${experiment.id}:dry-run`;
                const executeKey = `${experiment.id}:execute`;

                return (
                  <article className="experiment-card" key={experiment.id}>
                    <div className="experiment-top">
                      <div>
                        <h3>{experiment.title}</h3>
                        <p className="subtle">{experiment.service}</p>
                      </div>
                      <div className="experiment-icon" aria-hidden="true">
                        <Icon size={18} />
                      </div>
                    </div>
                    <div className="experiment-meta">
                      <span>
                        <strong className="mono">{experiment.cost}</strong>
                      </span>
                      {experiment.id === "cost" ? (
                        <label className="field">
                          <span>조회 월</span>
                          <input
                            className="input mono"
                            id="billing-month"
                            inputMode="numeric"
                            maxLength={6}
                            minLength={6}
                            onChange={(event) => setMonth(event.target.value)}
                            pattern="\d{6}"
                            value={month}
                          />
                        </label>
                      ) : (
                        <span>생성 리소스는 없거나 실행 직후 정리됩니다.</span>
                      )}
                    </div>
                    <div className="experiment-actions">
                      <button
                        className="button"
                        data-endpoint={experiment.endpoint}
                        data-experiment={experiment.id}
                        data-mode="dry-run"
                        data-run-experiment="true"
                        data-title={experiment.title}
                        disabled={running !== null}
                        onClick={() => runExperiment(experiment, "dry-run")}
                        title={`${experiment.title} dry run`}
                        type="button"
                      >
                        {running === dryRunKey ? (
                          <span className="spinner" aria-hidden="true" />
                        ) : (
                          <Eye size={16} aria-hidden="true" />
                        )}
                        Dry run
                      </button>
                      <button
                        className="button button-primary"
                        data-endpoint={experiment.endpoint}
                        data-experiment={experiment.id}
                        data-mode="execute"
                        data-run-experiment="true"
                        data-title={experiment.title}
                        disabled={running !== null}
                        onClick={() => runExperiment(experiment, "execute")}
                        title={`${experiment.title} execute`}
                        type="button"
                      >
                        {running === executeKey ? (
                          <span className="spinner" aria-hidden="true" />
                        ) : (
                          <Play size={16} aria-hidden="true" />
                        )}
                        실행
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="panel" aria-labelledby="result-title">
          <div className="panel-header">
            <div>
              <h2 id="result-title">Run Result</h2>
              <p className="subtle">최근 실행 결과</p>
            </div>
            {result ? (
              <Badge tone={result.ok ? "ok" : "blocked"}>
                {result.ok ? <BadgeCheck size={14} /> : <AlertTriangle size={14} />}
                {result.ok ? "OK" : "Blocked"}
              </Badge>
            ) : null}
          </div>
          <div className="panel-body" id="run-result-content">
            {result ? (
              <div className="result">
                <div className="result-header">
                  <div className="result-title">
                    <h3>{result.title ?? "Result"}</h3>
                    <p className="subtle">{result.message ?? result.costCap ?? "Completed"}</p>
                  </div>
                  <Badge tone={result.mode === "execute" ? "warn" : "neutral"}>
                    {result.mode ?? "client"}
                  </Badge>
                </div>

                {result.steps && result.steps.length > 0 ? (
                  <div className="step-list">
                    {result.steps.map((step, index) => (
                      <div className={statusClass(step.status)} key={`${step.label}-${index}`}>
                        <span className="step-dot" aria-hidden="true" />
                        <div>
                          <strong>{step.label}</strong>
                          {step.detail ? <p className="subtle">{step.detail}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="details">
                  {result.httpStatus ? (
                    <div className="detail-row">
                      <span>HTTP</span>
                      <strong>{result.httpStatus}</strong>
                    </div>
                  ) : null}
                  {result.returnCode ? (
                    <div className="detail-row">
                      <span>Return code</span>
                      <strong>{result.returnCode}</strong>
                    </div>
                  ) : null}
                  {result.regions ? (
                    <div className="detail-row">
                      <span>Regions</span>
                      <strong>{result.regions.join(", ")}</strong>
                    </div>
                  ) : null}
                  {result.month ? (
                    <div className="detail-row">
                      <span>Month</span>
                      <strong>{result.month}</strong>
                    </div>
                  ) : null}
                  {result.rowCount !== undefined ? (
                    <div className="detail-row">
                      <span>Billing rows</span>
                      <strong>{result.rowCount}</strong>
                    </div>
                  ) : null}
                  {result.totals ? (
                    <div className="detail-row">
                      <span>Demand</span>
                      <strong>{formatTotals(result.totals)}</strong>
                    </div>
                  ) : null}
                  {result.credentialsKind ? (
                    <div className="detail-row">
                      <span>Credentials</span>
                      <strong>{result.credentialsKind}</strong>
                    </div>
                  ) : null}
                  {result.bucketName ? (
                    <div className="detail-row">
                      <span>Bucket</span>
                      <strong>{result.bucketName}</strong>
                    </div>
                  ) : null}
                  {result.objectName ? (
                    <div className="detail-row">
                      <span>Object</span>
                      <strong>{result.objectName}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div>
                  <Activity size={28} aria-hidden="true" />
                  <p>실행 결과가 여기에 표시됩니다.</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="panel" aria-labelledby="settings-title" style={{ marginTop: 18 }}>
        <div className="panel-header">
          <div>
            <h2 id="settings-title">Server Settings</h2>
            <p className="subtle">값은 노출하지 않고 존재 여부만 확인합니다.</p>
          </div>
          <Badge tone={config?.deployed ? "warn" : "ok"}>
            {config?.deployed ? "Vercel" : "Local"}
          </Badge>
        </div>
        <div className="panel-body settings">
          <div className="field">
            <label htmlFor="run-token">
              <KeyRound size={14} aria-hidden="true" /> Run token
            </label>
            <div className="input-row">
              <input
                className="input mono"
                id="run-token"
                onChange={(event) => setRunToken(event.target.value)}
                placeholder="DASHBOARD_RUN_TOKEN"
                type="password"
                value={runToken}
              />
              <button
                className="button"
                data-save-run-token="true"
                onClick={saveToken}
                type="button"
              >
                <ShieldCheck size={16} aria-hidden="true" />
                저장
              </button>
            </div>
          </div>
          <div className="env-list">
            {envLabels.map((key) => {
              const present = Boolean(config?.present[key]);

              return (
                <div className="env-row" key={key}>
                  <span className="mono">{key}</span>
                  <Badge tone={present ? "ok" : "warn"}>{present ? "set" : "empty"}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
