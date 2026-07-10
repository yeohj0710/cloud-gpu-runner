import {
  ArrowRight,
  BadgeCheck,
  Box,
  CircleDollarSign,
  Clock3,
  CloudCog,
  FileSearch,
  LockKeyhole,
  Search,
  ServerCog,
  TriangleAlert,
} from "lucide-react";

import { formatKrw, type PortfolioView } from "@/lib/credit-portfolio";

const providerLabels: Record<string, string> = {
  "naver-cloud-platform": "네이버클라우드",
  "kakao-cloud": "카카오클라우드",
};

const readinessLabels = {
  next: "바로 시작",
  blocked: "설정 필요",
  later: "다음 순서",
} as const;

const opportunityIcons = [FileSearch, CloudCog, ServerCog, Search, Box, CircleDollarSign];

function deadlineLabel(daysRemaining: number, expired: boolean) {
  if (expired) return "만료됨";
  if (daysRemaining === 0) return "오늘 만료";
  return `D-${daysRemaining}`;
}

export function CreditStrategy({ portfolio }: { portfolio: PortfolioView }) {
  const naver = portfolio.providers.find((provider) => provider.id === "naver-cloud-platform");
  const kakao = portfolio.providers.find((provider) => provider.id === "kakao-cloud");
  const urgentGrant = naver?.grants.find((grant) => grant.id === "ncp-new-customer-plus");

  return (
    <>
      <header className="strategy-hero">
        <div className="strategy-hero-copy">
          <p className="section-label">Cloud Credit Lab · {portfolio.asOf.replaceAll("-", ".")} 기준</p>
          <h1>남은 크레딧, 먼저 쓸 곳이 정해졌어요</h1>
          <p className="hero-description">
            가장 빨리 끝나는 네이버 30만원은 제품 라벨과 연구 문서 처리에 먼저 씁니다.
            카카오 크레딧은 로컬에서 오래 걸리는 R&amp;D 계산에만 배정해요.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#opportunities">
              프로젝트별 활용 보기
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a className="button button-ghost" href="#experiments">
              연결 실험 열기
            </a>
          </div>
        </div>

        <div className="urgent-card">
          <div className="urgent-card-top">
            <span className="badge badge-danger">
              <Clock3 size={14} aria-hidden="true" />
              {urgentGrant ? deadlineLabel(urgentGrant.daysRemaining, urgentGrant.expired) : "확인 필요"}
            </span>
            <span className="mono">2026.07.31</span>
          </div>
          <p>네이버 신규 크레딧</p>
          <strong>{formatKrw(urgentGrant?.amountKrw ?? 300000)}</strong>
          <span>OCR 12만원 · HyperCLOVA X 10만원 · 나머지는 Speech와 예비비</span>
        </div>
      </header>

      <section className="strategy-section" aria-labelledby="credit-title">
        <div className="section-heading">
          <p className="section-label">확인된 크레딧</p>
          <h2 id="credit-title">실제 발급 기준으로 {formatKrw(portfolio.confirmedIssuedKrw)}</h2>
          <p>선정 금액과 발급 금액을 따로 봐야 예산을 두 번 세지 않아요.</p>
        </div>

        <div className="credit-grid">
          <article className="credit-card credit-card-urgent">
            <div className="credit-card-title">
              <span>네이버 · 먼저 사용</span>
              <TriangleAlert size={20} aria-hidden="true" />
            </div>
            <strong>{formatKrw(300000)}</strong>
            <p>2026.07.31 만료</p>
            <div className="credit-progress" aria-label="7월 긴급 예산 배분 완료">
              <span style={{ width: "40%" }} />
              <span style={{ width: "33.333%" }} />
              <span style={{ width: "26.667%" }} />
            </div>
            <small>OCR 40% · Studio 33% · 기타 27%</small>
          </article>

          <article className="credit-card">
            <div className="credit-card-title">
              <span>네이버 · Greenhouse</span>
              <BadgeCheck size={20} aria-hidden="true" />
            </div>
            <strong>{formatKrw(naver?.confirmedIssuedKrw ? naver.confirmedIssuedKrw - 300000 : 5000000)}</strong>
            <p>2027.04.30 만료 · 추가 500만원 신청 가능</p>
            <small>공용 문서·근거 처리와 배치 작업에 배정</small>
          </article>

          <article className="credit-card">
            <div className="credit-card-title">
              <span>카카오 · Boost</span>
              <LockKeyhole size={20} aria-hidden="true" />
            </div>
            <strong>{formatKrw(kakao?.confirmedIssuedKrw ?? 10000000)}</strong>
            <p>2027.05.31 만료 · IAM 키 발급 필요</p>
            <small>2,000만원 선정, 현재 메일로 확인된 발급액은 1,000만원</small>
          </article>
        </div>
      </section>

      <section className="strategy-section soft-section" id="opportunities" aria-labelledby="opportunity-title">
        <div className="section-heading">
          <p className="section-label">C:\dev 활용 우선순위</p>
          <h2 id="opportunity-title">크레딧을 쓰고 나면, 코드와 평가 결과가 남아야 해요</h2>
          <p>기존 데이터와 테스트가 있는 프로젝트부터 시작하고, 정확도나 속도가 기준을 못 넘으면 바로 멈춥니다.</p>
        </div>

        <div className="opportunity-list">
          {portfolio.opportunities.map((opportunity, index) => {
            const Icon = opportunityIcons[index] ?? Box;
            return (
              <article className="opportunity-row" key={`${opportunity.priority}-${opportunity.title}`}>
                <div className="opportunity-rank">{String(opportunity.priority).padStart(2, "0")}</div>
                <div className="opportunity-icon" aria-hidden="true">
                  <Icon size={21} />
                </div>
                <div className="opportunity-main">
                  <div className="opportunity-kicker">
                    <span>{providerLabels[opportunity.providerId]}</span>
                    <span>·</span>
                    <span>{opportunity.services.join(" + ")}</span>
                  </div>
                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.why}</p>
                  <div className="project-tags">
                    {opportunity.projects.map((project) => (
                      <code key={project}>{project}</code>
                    ))}
                  </div>
                </div>
                <div className="opportunity-meta">
                  <span className={`badge readiness-${opportunity.readiness}`}>
                    {readinessLabels[opportunity.readiness]}
                  </span>
                  <strong>{formatKrw(opportunity.budgetCapKrw)} 상한</strong>
                  <p>{opportunity.pilot}</p>
                  <small>중단 기준 · {opportunity.stopRule}</small>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="strategy-section decision-section" aria-labelledby="decision-title">
        <div className="section-heading compact-heading">
          <p className="section-label">지금 상태</p>
          <h2 id="decision-title">네이버는 실행 가능, 카카오는 키 발급이 먼저예요</h2>
        </div>

        <div className="decision-grid">
          <div className="decision-column">
            <h3>
              <BadgeCheck size={19} aria-hidden="true" />
              끝낸 확인
            </h3>
            <ul>
              {portfolio.completedChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </div>
          <div className="decision-column decision-column-warn">
            <h3>
              <TriangleAlert size={19} aria-hidden="true" />
              돈 쓰기 전에 막을 것
            </h3>
            <ul>
              {portfolio.doNotSpendOn.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
