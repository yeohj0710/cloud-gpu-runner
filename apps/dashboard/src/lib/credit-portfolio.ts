import portfolioData from "@/data/credit-portfolio.json";

export type Grant = {
  id: string;
  name: string;
  amountKrw: number;
  startsOn: string;
  expiresOn: string;
  status: "issued";
  evidence: string;
};

export type PortfolioProvider = {
  id: string;
  displayName: string;
  confirmedIssuedKrw: number;
  potentialAdditionalKrw?: number;
  programAwardedKrw?: number;
  potentialUnissuedKrw?: number;
  status: "infrastructure-ready" | "parked-credentials-blocked";
  grants: Grant[];
  nextUnlock: string;
  blockers: string[];
};

export type Allocation = {
  id: string;
  providerId: string;
  grantId: string;
  title: string;
  availableKrw: number;
  committedCapKrw: number;
  parkedKrw: number;
  items: Array<{ label: string; capKrw: number }>;
};

export type Opportunity = {
  priority: number;
  projects: string[];
  providerId: string;
  grantId: string;
  services: string[];
  title: string;
  cloudExclusiveCapability: string;
  gptSubstitute: false;
  why: string;
  pilot: string;
  budgetCapKrw: number;
  readiness: "next" | "active" | "setup-needed" | "approval-needed" | "parked";
  unlockConditions: string[];
  stopRule: string;
};

export type CreditPortfolio = {
  schemaVersion: 2;
  asOf: string;
  confirmedIssuedKrw: number;
  selectionRule: {
    name: string;
    question: string;
    approveOnlyIf: string[];
    rejectIf: string[];
  };
  providers: PortfolioProvider[];
  allocations: Allocation[];
  opportunities: Opportunity[];
  rejectedIdeas: Array<{ idea: string; reason: string; replacement: string }>;
  completedChecks: string[];
  officialReferences: string[];
};

export type PortfolioView = Omit<CreditPortfolio, "providers"> & {
  providers: Array<
    Omit<PortfolioProvider, "grants"> & {
      grants: Array<Grant & { daysRemaining: number; expired: boolean }>;
    }
  >;
  budgetSummary: {
    committedCapKrw: number;
    parkedKrw: number;
  };
};

function utcDay(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function validatePortfolio(portfolio: CreditPortfolio) {
  const issuedTotal = portfolio.providers.reduce(
    (total, provider) => total + provider.confirmedIssuedKrw,
    0,
  );

  if (portfolio.schemaVersion !== 2 || issuedTotal !== portfolio.confirmedIssuedKrw) {
    throw new Error("Cloud-native portfolio credit total mismatch.");
  }

  for (const allocation of portfolio.allocations) {
    const itemTotal = allocation.items.reduce((total, item) => total + item.capKrw, 0);
    if (
      itemTotal !== allocation.committedCapKrw ||
      allocation.committedCapKrw + allocation.parkedKrw !== allocation.availableKrw
    ) {
      throw new Error(`Allocation balance mismatch for ${allocation.id}.`);
    }
  }

  for (const opportunity of portfolio.opportunities) {
    if (
      opportunity.gptSubstitute !== false ||
      !opportunity.cloudExclusiveCapability ||
      !opportunity.stopRule
    ) {
      throw new Error(`Non-cloud-native opportunity detected: ${opportunity.title}.`);
    }
  }
}

export function formatKrw(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function loadCreditPortfolio(now = new Date()): PortfolioView {
  const portfolio = portfolioData as CreditPortfolio;
  validatePortfolio(portfolio);
  const seoulNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = Date.UTC(
    seoulNow.getUTCFullYear(),
    seoulNow.getUTCMonth(),
    seoulNow.getUTCDate(),
  );
  const budgetSummary = portfolio.allocations.reduce(
    (summary, allocation) => ({
      committedCapKrw: summary.committedCapKrw + allocation.committedCapKrw,
      parkedKrw: summary.parkedKrw + allocation.parkedKrw,
    }),
    { committedCapKrw: 0, parkedKrw: 0 },
  );

  return {
    ...portfolio,
    budgetSummary,
    providers: portfolio.providers.map((provider) => ({
      ...provider,
      grants: provider.grants.map((grant) => {
        const daysRemaining = Math.ceil((utcDay(grant.expiresOn) - today) / 86_400_000);
        return { ...grant, daysRemaining, expired: daysRemaining < 0 };
      }),
    })),
  };
}
