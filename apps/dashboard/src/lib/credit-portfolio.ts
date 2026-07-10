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
  status: "ready" | "credentials-blocked";
  grants: Grant[];
  nextUnlock: string;
  blockers: string[];
};

export type Allocation = {
  id: string;
  providerId: string;
  grantId: string;
  title: string;
  totalCapKrw: number;
  items: Array<{ label: string; capKrw: number }>;
};

export type Opportunity = {
  priority: number;
  projects: string[];
  providerId: string;
  services: string[];
  title: string;
  why: string;
  pilot: string;
  budgetCapKrw: number;
  readiness: "next" | "blocked" | "later";
  stopRule: string;
};

export type CreditPortfolio = {
  schemaVersion: number;
  asOf: string;
  confirmedIssuedKrw: number;
  providers: PortfolioProvider[];
  allocations: Allocation[];
  opportunities: Opportunity[];
  completedChecks: string[];
  doNotSpendOn: string[];
  officialReferences: string[];
};

export type PortfolioView = Omit<CreditPortfolio, "providers"> & {
  providers: Array<
    Omit<PortfolioProvider, "grants"> & {
      grants: Array<Grant & { daysRemaining: number; expired: boolean }>;
    }
  >;
};

function utcDay(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

function validatePortfolio(portfolio: CreditPortfolio) {
  const issuedTotal = portfolio.providers.reduce(
    (total, provider) => total + provider.confirmedIssuedKrw,
    0,
  );

  if (issuedTotal !== portfolio.confirmedIssuedKrw) {
    throw new Error(`Credit total mismatch: ${issuedTotal} != ${portfolio.confirmedIssuedKrw}`);
  }

  for (const allocation of portfolio.allocations) {
    const itemTotal = allocation.items.reduce((total, item) => total + item.capKrw, 0);

    if (itemTotal !== allocation.totalCapKrw) {
      throw new Error(`Allocation total mismatch for ${allocation.id}`);
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

  return {
    ...portfolio,
    providers: portfolio.providers.map((provider) => ({
      ...provider,
      grants: provider.grants.map((grant) => {
        const daysRemaining = Math.ceil((utcDay(grant.expiresOn) - today) / 86_400_000);
        return { ...grant, daysRemaining, expired: daysRemaining < 0 };
      }),
    })),
  };
}
