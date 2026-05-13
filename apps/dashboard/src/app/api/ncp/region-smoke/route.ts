import { callNcpApi, compactCloudError, type ExperimentMode } from "@/lib/ncp/api";
import { assertRunAllowed, loadLabEnv, requireEnv } from "@/lib/ncp/env";
import { blocked, ok, routeError } from "@/lib/ncp/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readMode(request: Request): Promise<ExperimentMode> {
  const body = (await request.json().catch(() => ({}))) as { mode?: ExperimentMode };

  return body.mode === "execute" ? "execute" : "dry-run";
}

export async function POST(request: Request) {
  const env = loadLabEnv();
  const mode = await readMode(request);
  const method = "GET";
  const pathWithQuery = "/vserver/v2/getRegionList?responseFormatType=json";

  try {
    requireEnv(env, ["NCP_ACCESS_KEY_ID", "NCP_SECRET_KEY", "NCP_API_ENDPOINT"]);

    if (mode === "dry-run") {
      return ok({
        title: "NCP region smoke test",
        mode,
        costCap: "0 KRW expected",
        request: `${method} ${env.NCP_API_ENDPOINT}${pathWithQuery}`,
        steps: [
          { label: "Build signed request", status: "planned" },
          { label: "Call metadata/list API", status: "planned" },
          { label: "Parse region codes", status: "planned" },
        ],
      });
    }

    assertRunAllowed(request, env);

    const { response, body, text } = await callNcpApi({
      env,
      endpointKey: "NCP_API_ENDPOINT",
      method,
      pathWithQuery,
    });

    if (!response.ok) {
      return blocked({
        title: "NCP region smoke test blocked",
        mode,
        httpStatus: response.status,
        message: compactCloudError(body, text),
      });
    }

    const payload = body as {
      getRegionListResponse?: {
        returnCode?: string;
        regionList?: Array<{ regionCode?: string; regionName?: string }>;
      };
    };
    const responsePayload = payload.getRegionListResponse;
    const regions =
      responsePayload?.regionList
        ?.map((region) => region.regionCode ?? region.regionName)
        .filter(Boolean) ?? [];

    return ok({
      title: "NCP region smoke test",
      mode,
      httpStatus: response.status,
      returnCode: responsePayload?.returnCode ?? "unknown",
      regions,
      steps: [
        { label: "Build signed request", status: "ok" },
        { label: "Call metadata/list API", status: "ok", detail: `HTTP ${response.status}` },
        { label: "Parse region codes", status: "ok", detail: regions.join(", ") },
      ],
    });
  } catch (error) {
    return routeError(error, mode === "execute" ? 403 : 400);
  }
}
