import { DashboardConsole } from "@/components/dashboard-console";
import { CreditStrategy } from "@/components/credit-strategy";
import { loadCreditPortfolio } from "@/lib/credit-portfolio";
import { getEnvStatus } from "@/lib/ncp/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="app-shell">
      <CreditStrategy portfolio={loadCreditPortfolio()} />
      <DashboardConsole initialConfig={getEnvStatus()} />
    </main>
  );
}
