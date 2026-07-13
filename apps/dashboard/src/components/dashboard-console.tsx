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
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

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
  environment: "vercel" | "production" | "local";
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
  dryRunSummary: string;
  executeSummary: string;
  icon: typeof Cloud;
  accent: "green" | "amber" | "blue";
};

const REQUEST_TIMEOUT_MS = 30_000;
const RUN_TOKEN_STORAGE_KEY = "cloud-credit-run-token";
const RUN_TOKEN_EVENT = "cloud-credit-run-token-change";

function subscribeRunToken(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(RUN_TOKEN_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(RUN_TOKEN_EVENT, callback);
  };
}

function readRunToken() {
  return window.localStorage.getItem(RUN_TOKEN_STORAGE_KEY) ?? "";
}

function readServerRunToken() {
  return "";
}

const experiments: Experiment[] = [
  {
    id: "region",
    title: "NCP 리전 연결",
    service: "Region metadata",
    cost: "0원 예상",
    endpoint: "/api/ncp/region-smoke",
    dryRunSummary: "서명 요청 계획만 만듭니다.",
    executeSummary: "리전 목록을 읽어 실제 API 연결을 확인합니다.",
    icon: Cloud,
    accent: "green",
  },
  {
    id: "cost",
    title: "이번 달 비용 조회",
    service: "Billing / Cost",
    cost: "0원 예상",
    endpoint: "/api/ncp/cost-snapshot",
    dryRunSummary: "월별 비용 조회 요청을 확인합니다.",
    executeSummary: "선택한 달의 청구 금액을 읽습니다.",
    icon: CreditCard,
    accent: "blue",
  },
  {
    id: "object-storage",
    title: "Object Storage 왕복",
    service: "임시 버킷 + 작은 객체",
    cost: "1,000원 이하 상한",
    endpoint: "/api/ncp/object-storage-smoke",
    dryRunSummary: "생성·검증·삭제 순서를 확인합니다.",
    executeSummary: "임시 객체를 만들고 확인한 뒤 바로 지웁니다.",
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
    return "조회 결과 없음";
  }

  return Object.entries(totals)
    .map(([currency, amount]) => `${amount.toLocaleString()} ${currency}`)
    .join(", ");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function DashboardConsole({ initialConfig }: { initialConfig: ConfigStatus }) {
  const [config, setConfig] = useState<ConfigStatus | null>(initialConfig);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [tokenSaved, setTokenSaved] = useState(false);
  const storedRunToken = useSyncExternalStore(subscribeRunToken, readRunToken, readServerRunToken);
  const [draftRunToken, setDraftRunToken] = useState<string | null>(null);
  const runToken = draftRunToken ?? storedRunToken;
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    try {
      const response = await fetch("/api/config/status", { cache: "no-store" });
      const payload = (await response.json()) as { status: ConfigStatus };
      setConfig(payload.status);
    } catch (error) {
      setResult({
        ok: false,
        title: "상태 새로고침 실패",
        message: error instanceof Error ? error.message : "서버 상태를 읽지 못했습니다.",
      });
    }
  }

  function saveToken() {
    window.localStorage.setItem(RUN_TOKEN_STORAGE_KEY, runToken);
    window.dispatchEvent(new Event(RUN_TOKEN_EVENT));
    setDraftRunToken(null);
    setTokenSaved(true);
  }

  async function runExperiment(experiment: Experiment, mode: "dry-run" | "execute") {
    const runKey = `${experiment.id}:${mode}`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    setTokenSaved(false);
    setRunning(runKey);
    setResult({
      ok: true,
      title: `${experiment.title} 실행 중`,
      mode,
      message:
        mode === "dry-run"
          ? experiment.dryRunSummary
          : `${experiment.executeSummary} 서버 응답을 기다리고 있습니다.`,
      steps: [{ label: "서버 API 경로로 요청 전송", status: "planned" }],
    });

    try {
      const response = await fetch(experiment.endpoint, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...(runToken ? { "x-dashboard-run-token": runToken } : {}),
        },
        body: JSON.stringify({
          mode,
          ...(experiment.id === "cost" ? { month } : {}),
        }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as RunResult;
      setResult({
        ...payload,
        httpStatus: payload.httpStatus ?? response.status,
        ok: payload.ok && response.ok,
      });
    } catch (error) {
      setResult({
        ok: false,
        title: "요청 실패",
        message: isAbortError(error)
          ? `${REQUEST_TIMEOUT_MS / 1000}초 동안 응답이 없습니다. 서버 로그를 확인한 뒤 다시 시도하세요.`
          : error instanceof Error
            ? error.message
            : "알 수 없는 클라이언트 오류",
      });
    } finally {
      window.clearTimeout(timeoutId);
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
  const executeNeedsToken = Boolean(config?.runTokenRequired && !runToken);

  return (
    <section className="console-shell" id="experiments" aria-labelledby="console-title">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="eyebrow">Cloud GPU Runner</p>
            <h2 id="console-title">연결 실험 콘솔</h2>
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
              {config?.present.NCP_ACCESS_KEY_ID ? "준비됨" : "키 없음"}
            </Badge>
          </div>
          <p className="metric-value">API Gateway</p>
        </div>
        <div className="metric">
          <div className="metric-label">
            <span>비용 조회</span>
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
          <p className="metric-value">{config?.runTokenRequired ? "잠김" : "로컬 허용"}</p>
        </div>
        <div className="metric">
          <div className="metric-label">
            <span>환경 변수</span>
            <Badge tone={envReadyCount >= 5 ? "ok" : "warn"}>{envReadyCount}/{envLabels.length}</Badge>
          </div>
          <p className="metric-value">서버 전용</p>
        </div>
      </section>

      <div className="layout-grid">
        <section className="panel" aria-labelledby="experiments-title">
          <div className="panel-header">
            <div>
              <h2 id="experiments-title">안전한 연결 실험</h2>
              <p className="subtle">계획 보기는 비용이 들지 않고, 실행만 서버에서 API를 호출합니다.</p>
            </div>
            <Badge tone="ok">
              <ShieldCheck size={14} aria-hidden="true" />
              비밀값 숨김
            </Badge>
          </div>
          <div className="panel-body">
            <div className="experiments">
              {experiments.map((experiment) => {
                const Icon = experiment.icon;
                const dryRunKey = `${experiment.id}:dry-run`;
                const executeKey = `${experiment.id}:execute`;
                const executeDisabled = running !== null || executeNeedsToken;

                return (
                  <article className="experiment-card" key={experiment.id}>
                    <div className="experiment-top">
                      <div>
                        <h3>{experiment.title}</h3>
                        <p className="subtle">{experiment.service}</p>
                      </div>
                      <div className={`experiment-icon experiment-icon-${experiment.accent}`} aria-hidden="true">
                        <Icon size={18} />
                      </div>
                    </div>
                    <div className="experiment-meta">
                      <span>
                        <strong className="mono">{experiment.cost}</strong>
                      </span>
                      <span>{experiment.dryRunSummary}</span>
                      <span>{experiment.executeSummary}</span>
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
                      ) : null}
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
                        title={`${experiment.title} 계획 보기`}
                        type="button"
                      >
                        {running === dryRunKey ? (
                          <span className="spinner" aria-hidden="true" />
                        ) : (
                          <Eye size={16} aria-hidden="true" />
                        )}
                        계획 보기
                      </button>
                      <button
                        className="button button-primary"
                        data-endpoint={experiment.endpoint}
                        data-experiment={experiment.id}
                        data-mode="execute"
                        data-run-experiment="true"
                        data-title={experiment.title}
                        disabled={executeDisabled}
                        onClick={() => runExperiment(experiment, "execute")}
                        title={
                          executeNeedsToken
                            ? "실행 전에 run token을 입력하고 저장하세요"
                            : `${experiment.title} 실행`
                        }
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
              <h2 id="result-title">실행 결과</h2>
              <p className="subtle">가장 최근 요청</p>
            </div>
            {result ? (
              <Badge tone={result.ok ? "ok" : "blocked"}>
                {result.ok ? <BadgeCheck size={14} /> : <AlertTriangle size={14} />}
                {result.ok ? "완료" : "차단됨"}
              </Badge>
            ) : null}
          </div>
          <div className="panel-body" id="run-result-content" aria-live="polite">
            {result ? (
              <div className="result">
                <div className="result-header">
                  <div className="result-title">
                    <h3>{result.title ?? "결과"}</h3>
                    <p className="subtle">{result.message ?? result.costCap ?? "완료"}</p>
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
                      <span>리전</span>
                      <strong>{result.regions.join(", ")}</strong>
                    </div>
                  ) : null}
                  {result.month ? (
                    <div className="detail-row">
                      <span>조회 월</span>
                      <strong>{result.month}</strong>
                    </div>
                  ) : null}
                  {result.rowCount !== undefined ? (
                    <div className="detail-row">
                      <span>비용 행</span>
                      <strong>{result.rowCount}</strong>
                    </div>
                  ) : null}
                  {result.totals ? (
                    <div className="detail-row">
                      <span>청구 금액</span>
                      <strong>{formatTotals(result.totals)}</strong>
                    </div>
                  ) : null}
                  {result.credentialsKind ? (
                    <div className="detail-row">
                      <span>자격 증명</span>
                      <strong>{result.credentialsKind}</strong>
                    </div>
                  ) : null}
                  {result.bucketName ? (
                    <div className="detail-row">
                      <span>버킷</span>
                      <strong>{result.bucketName}</strong>
                    </div>
                  ) : null}
                  {result.objectName ? (
                    <div className="detail-row">
                      <span>객체</span>
                      <strong>{result.objectName}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div>
                  <Activity size={28} aria-hidden="true" />
                  <p>계획 보기나 실행을 누르면 요청 내용과 결과가 여기에 나옵니다.</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="panel settings-panel" aria-labelledby="settings-title">
        <div className="panel-header">
          <div>
            <h2 id="settings-title">서버 설정</h2>
            <p className="subtle">값은 보여주지 않고 설정 여부만 확인합니다.</p>
          </div>
          <Badge tone={config?.deployed ? "warn" : "ok"}>
            {config?.environment === "vercel"
              ? "Vercel"
              : config?.environment === "production"
                ? "Production"
                : "로컬"}
          </Badge>
        </div>
        <div className="panel-body settings">
          <div className="field">
            <label htmlFor="run-token">
              <KeyRound size={14} aria-hidden="true" /> 실행 토큰
            </label>
            <div className="input-row">
              <input
                className="input mono"
                id="run-token"
                onChange={(event) => setDraftRunToken(event.target.value)}
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
            {tokenSaved ? <p className="subtle">이 브라우저에 토큰을 저장했습니다.</p> : null}
          </div>
          <div className="env-list">
            {envLabels.map((key) => {
              const present = Boolean(config?.present[key]);

              return (
                <div className="env-row" key={key}>
                  <span className="mono">{key}</span>
                  <Badge tone={present ? "ok" : "warn"}>{present ? "설정됨" : "비어 있음"}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </section>
  );
}
