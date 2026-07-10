import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Clapperboard,
  CloudCog,
  Globe2,
  HardDriveDownload,
  LockKeyhole,
  MessageSquareText,
  PauseCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { formatKrw, type PortfolioView } from "@/lib/credit-portfolio";

const providerLabels: Record<string, string> = {
  "naver-cloud-platform": "네이버클라우드",
  "kakao-cloud": "카카오클라우드",
};

const readinessLabels = {
  next: "다음 실행",
  active: "검증 중",
  "setup-needed": "설정 필요",
  "approval-needed": "승인 필요",
  parked: "보류",
} as const;

const opportunityIcons = [
  Globe2,
  HardDriveDownload,
  Clapperboard,
  MessageSquareText,
  CloudCog,
  PauseCircle,
  LockKeyhole,
];

function deadlineLabel(daysRemaining: number, expired: boolean) {
  if (expired) return "만료됨";
  if (daysRemaining === 0) return "오늘 만료";
  return `D-${daysRemaining}`;
}

export function CreditStrategy({ portfolio }: { portfolio: PortfolioView }) {
  const naver = portfolio.providers.find((provider) => provider.id === "naver-cloud-platform");
  const kakao = portfolio.providers.find((provider) => provider.id === "kakao-cloud");
  const urgentGrant = naver?.grants.find((grant) => grant.id === "ncp-new-customer-plus");
  const urgentAllocation = portfolio.allocations.find(
    (allocation) => allocation.id === "ncp-urgent-cloud-only",
  );

  return (
    <>
      <header className="strategy-hero">
        <div className="strategy-hero-copy">
          <p className="section-label">Cloud-native only · {portfolio.asOf.replaceAll("-", ".")} 기준</p>
          <h1>GPT가 못 하는 일에만 크레딧을 써요</h1>
          <p className="hero-description">
            요약·OCR·일반 AI 실험은 모두 뺐습니다. 개인 PC가 꺼져도 여러 나라에서 계속
            실행되는 것, PC 고장과 분리된 복구, 통신사·CDN 전달망처럼 클라우드가 실제 능력을
            더하는 일만 남겼어요.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#opportunities">
              통과한 활용안 보기
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="button button-ghost" href="#rejected">
              제외한 아이디어 보기
            </a>
          </div>
        </div>

        <div className="urgent-card">
          <div className="urgent-card-top">
            <span className="badge badge-danger">
              {urgentGrant ? deadlineLabel(urgentGrant.daysRemaining, urgentGrant.expired) : "확인 필요"}
            </span>
            <span className="mono">2026.07.31</span>
          </div>
          <p>지금 승인한 최대 지출</p>
          <strong>{formatKrw(urgentAllocation?.committedCapKrw ?? 230000)}</strong>
          <span>
            세 리전 외부 실행 · 실제 복구 · 미디어 변환 · 승인된 문자 전달만 테스트합니다.
          </span>
        </div>
      </header>

      <section className="strategy-section" aria-labelledby="credit-title">
        <div className="section-heading">
          <p className="section-label">돈보다 먼저 보는 기준</p>
          <h2 id="credit-title">확정 {formatKrw(portfolio.confirmedIssuedKrw)}, 지금 묶은 돈은 23만원</h2>
          <p>쓸 수 있다는 이유만으로 쓰지 않습니다. 효과가 증명되지 않은 {formatKrw(portfolio.budgetSummary.parkedKrw)}은 그대로 보류했어요.</p>
        </div>

        <div className="credit-grid">
          <article className="credit-card credit-card-urgent">
            <div className="credit-card-title">
              <span>네이버 · 7월 파일럿</span>
              <BadgeCheck size={20} aria-hidden="true" />
            </div>
            <strong>{formatKrw(urgentAllocation?.committedCapKrw ?? 230000)}</strong>
            <p>30만원 중 최대 지출 상한</p>
            <div className="credit-progress" aria-label="긴급 크레딧 23만원 승인, 7만원 보류">
              <span style={{ width: "76.667%" }} />
            </div>
            <small>23만원 승인 · 7만원 보류</small>
          </article>

          <article className="credit-card">
            <div className="credit-card-title">
              <span>네이버 · Greenhouse</span>
              <PauseCircle size={20} aria-hidden="true" />
            </div>
            <strong>{formatKrw(5000000)}</strong>
            <p>2027.04.30 만료</p>
            <small>7월 파일럿이 실제 가치를 증명할 때까지 전액 보류</small>
          </article>

          <article className="credit-card">
            <div className="credit-card-title">
              <span>카카오 · Boost</span>
              <LockKeyhole size={20} aria-hidden="true" />
            </div>
            <strong>{formatKrw(kakao?.confirmedIssuedKrw ?? 10000000)}</strong>
            <p>2027.05.31 만료</p>
            <small>검색 규모·GPU 병목·이중화 필요가 측정될 때까지 전액 보류</small>
          </article>
        </div>
      </section>

      <section className="strategy-section soft-section" aria-labelledby="rule-title">
        <div className="section-heading">
          <p className="section-label">새로운 통과 규칙</p>
          <h2 id="rule-title">“GPT가 답을 만들 수 있나?”가 아니라 “클라우드가 능력을 더하나?”</h2>
          <p>{portfolio.selectionRule.question}</p>
        </div>
        <div className="principle-grid">
          <article className="principle-card principle-card-pass">
            <h3><ShieldCheck size={21} aria-hidden="true" /> 이런 경우만 통과</h3>
            <ul>
              {portfolio.selectionRule.approveOnlyIf.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
          <article className="principle-card principle-card-blocked">
            <h3><Ban size={21} aria-hidden="true" /> 이런 경우 바로 탈락</h3>
            <ul>
              {portfolio.selectionRule.rejectIf.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section className="strategy-section" id="opportunities" aria-labelledby="opportunity-title">
        <div className="section-heading">
          <p className="section-label">C:\dev 재조사 결과</p>
          <h2 id="opportunity-title">7월 파일럿 후보 4개, 조건이 생길 때까지 잠근 3개</h2>
          <p>각 항목은 클라우드만의 능력, 해제 조건, 비용 상한, 중단 기준을 모두 가져야 합니다.</p>
        </div>

        <div className="opportunity-list">
          {portfolio.opportunities.map((opportunity, index) => {
            const Icon = opportunityIcons[index] ?? CloudCog;
            return (
              <article className="opportunity-row" key={`${opportunity.priority}-${opportunity.title}`}>
                <div className="opportunity-rank">{String(opportunity.priority).padStart(2, "0")}</div>
                <div className="opportunity-icon" aria-hidden="true"><Icon size={21} /></div>
                <div className="opportunity-main">
                  <div className="opportunity-kicker">
                    <span>{providerLabels[opportunity.providerId]}</span><span>·</span>
                    <span>{opportunity.services.join(" + ")}</span>
                  </div>
                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.why}</p>
                  <div className="cloud-proof">
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span><strong>GPT 대체 불가</strong> · {opportunity.cloudExclusiveCapability}</span>
                  </div>
                  <div className="project-tags">
                    {opportunity.projects.map((project) => <code key={project}>{project}</code>)}
                  </div>
                </div>
                <div className="opportunity-meta">
                  <span className={`badge readiness-${opportunity.readiness}`}>
                    {readinessLabels[opportunity.readiness]}
                  </span>
                  <strong>{opportunity.budgetCapKrw > 0 ? `${formatKrw(opportunity.budgetCapKrw)} 상한` : "현재 지출 0원"}</strong>
                  <p>{opportunity.pilot}</p>
                  <ul className="unlock-list">
                    {opportunity.unlockConditions.map((condition) => <li key={condition}>{condition}</li>)}
                  </ul>
                  <small>중단 기준 · {opportunity.stopRule}</small>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="strategy-section soft-section" id="rejected" aria-labelledby="rejected-title">
        <div className="section-heading">
          <p className="section-label">이번에 뺀 것</p>
          <h2 id="rejected-title">그럴듯해도 클라우드 크레딧을 쓸 이유가 없으면 탈락</h2>
          <p>기존 안의 OCR·요약·전사·무조건 GPU·검색 클러스터를 다시 검토한 결과입니다.</p>
        </div>
        <div className="rejected-list">
          {portfolio.rejectedIdeas.map((item) => (
            <article className="rejected-row" key={item.idea}>
              <div className="rejected-icon" aria-hidden="true"><Ban size={18} /></div>
              <div><h3>{item.idea}</h3><p>{item.reason}</p></div>
              <small>대신 · {item.replacement}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="strategy-section decision-section" aria-labelledby="decision-title">
        <div className="section-heading compact-heading">
          <p className="section-label">현재 증거</p>
          <h2 id="decision-title">저장은 실제로 확인했고, 외부 실행은 배포 단위까지 만들었어요</h2>
        </div>
        <div className="decision-grid">
          <div className="decision-column">
            <h3><BadgeCheck size={19} aria-hidden="true" /> 확인된 것</h3>
            <ul>{portfolio.completedChecks.map((check) => <li key={check}>{check}</li>)}</ul>
          </div>
          <div className="decision-column decision-column-warn">
            <h3><TriangleAlert size={19} aria-hidden="true" /> 다음 외부 설정</h3>
            <ul>
              {naver?.blockers.map((item) => <li key={item}>{item}</li>)}
              {kakao?.blockers.slice(0, 2).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
