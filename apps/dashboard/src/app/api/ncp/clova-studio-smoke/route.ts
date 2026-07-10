import type { ExperimentMode } from "@/lib/ncp/api";
import { getClovaStudioPlan, runClovaStudioSmoke } from "@/lib/ncp/clova-studio";
import { assertRunAllowed, loadLabEnv, requireEnv } from "@/lib/ncp/env";
import { ok, routeError } from "@/lib/ncp/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readMode(request: Request): Promise<ExperimentMode> {
  const body = (await request.json().catch(() => ({}))) as { mode?: ExperimentMode };
  return body.mode === "execute" ? "execute" : "dry-run";
}

export async function POST(request: Request) {
  const env = loadLabEnv();
  const mode = await readMode(request);

  try {
    const plan = getClovaStudioPlan(env);

    if (mode === "dry-run") {
      return ok({
        title: "NCP CLOVA Studio smoke test",
        mode,
        costCap: "one synthetic request, <= 1,000 KRW",
        endpoint: plan.endpoint,
        model: plan.model,
        credentialReady: plan.credentialReady,
        steps: [
          { label: "Use one synthetic supplement label", status: "planned" },
          { label: "Cap output at 120 tokens", status: "planned" },
          {
            label: "Call the OpenAI-compatible chat completions API",
            status: plan.credentialReady ? "planned" : "blocked",
            detail: plan.credentialReady
              ? "CLOVA Studio API key is configured."
              : "Issue NCP_CLOVASTUDIO_API_KEY before execute mode.",
          },
        ],
      });
    }

    assertRunAllowed(request, env);
    requireEnv(env, ["NCP_CLOVASTUDIO_API_KEY"]);
    const result = await runClovaStudioSmoke(env);

    return ok({
      title: "NCP CLOVA Studio smoke test",
      mode,
      ...result,
      steps: [
        { label: "Synthetic label sent", status: "ok" },
        { label: "Structured extraction returned", status: "ok" },
      ],
    });
  } catch (error) {
    return routeError(error, mode === "execute" ? 403 : 400);
  }
}
