import { getEnvStatus } from "@/lib/ncp/env";
import { ok } from "@/lib/ncp/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok({
    title: "Dashboard config status",
    status: getEnvStatus(),
  });
}
