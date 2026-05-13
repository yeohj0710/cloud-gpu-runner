import { callNcpApi, compactCloudError, type ExperimentMode } from "@/lib/ncp/api";
import { assertRunAllowed, loadLabEnv, requireEnv } from "@/lib/ncp/env";
import { blocked, ok, routeError } from "@/lib/ncp/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function currentMonth() {
  return new Date().toISOString().slice(0, 7).replace("-", "");
}

async function readInput(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    mode?: ExperimentMode;
    month?: string;
  };

  return {
    mode: body.mode === "execute" ? "execute" : "dry-run",
    month: body.month && /^\d{6}$/.test(body.month) ? body.month : currentMonth(),
  };
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export async function POST(request: Request) {
  const env = loadLabEnv();
  const { mode, month } = await readInput(request);
  const method = "GET";
  const pathWithQuery =
    `/billing/v1/cost/getContractDemandCostList` +
    `?startMonth=${month}&endMonth=${month}&responseFormatType=json&pageSize=100`;

  try {
    requireEnv(env, [
      "NCP_ACCESS_KEY_ID",
      "NCP_SECRET_KEY",
      "NCP_BILLING_API_ENDPOINT",
    ]);

    if (mode === "dry-run") {
      return ok({
        title: "NCP cost snapshot",
        mode,
        month,
        costCap: "0 KRW expected",
        request: `${method} ${env.NCP_BILLING_API_ENDPOINT}${pathWithQuery}`,
        steps: [
          { label: "Build signed billing request", status: "planned" },
          { label: "Read monthly billing rows", status: "planned" },
          { label: "Summarize demand amount", status: "planned" },
        ],
      });
    }

    assertRunAllowed(request, env);

    const { response, body, text } = await callNcpApi({
      env,
      endpointKey: "NCP_BILLING_API_ENDPOINT",
      method,
      pathWithQuery,
    });

    if (!response.ok) {
      return blocked({
        title: "NCP cost snapshot blocked",
        mode,
        httpStatus: response.status,
        message: compactCloudError(body, text),
      });
    }

    const payload = body as {
      getContractDemandCostListResponse?: {
        returnCode?: string;
        contractDemandCostList?: Array<Record<string, unknown>> | Record<string, unknown>;
      };
    };
    const responsePayload = payload.getContractDemandCostListResponse;
    const rows = responsePayload?.contractDemandCostList ?? [];
    const rowArray = Array.isArray(rows) ? rows : [rows].filter(Boolean);
    const totals = new Map<string, number>();

    for (const row of rowArray) {
      const currencyRecord = row.payCurrency as Record<string, unknown> | undefined;
      const currency = typeof currencyRecord?.code === "string" ? currencyRecord.code : "UNKNOWN";
      totals.set(currency, (totals.get(currency) ?? 0) + toNumber(row.demandAmount));
    }

    return ok({
      title: "NCP cost snapshot",
      mode,
      month,
      httpStatus: response.status,
      returnCode: responsePayload?.returnCode ?? "unknown",
      rowCount: rowArray.length,
      totals: Object.fromEntries(totals),
      steps: [
        { label: "Build signed billing request", status: "ok" },
        { label: "Read monthly billing rows", status: "ok", detail: `HTTP ${response.status}` },
        {
          label: "Summarize demand amount",
          status: "ok",
          detail: rowArray.length === 0 ? "No rows returned" : `${rowArray.length} rows`,
        },
      ],
    });
  } catch (error) {
    return routeError(error, mode === "execute" ? 403 : 400);
  }
}
