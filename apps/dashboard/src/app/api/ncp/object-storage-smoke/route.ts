import type { ExperimentMode } from "@/lib/ncp/api";
import { assertRunAllowed, loadLabEnv, requireEnv } from "@/lib/ncp/env";
import { getObjectStoragePlan, runObjectStorageSmoke } from "@/lib/ncp/object-storage";
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

  try {
    requireEnv(env, ["NCP_OBJECT_STORAGE_ENDPOINT"]);
    const plan = getObjectStoragePlan(env);

    if (mode === "dry-run") {
      return ok({
        title: "NCP Object Storage smoke test",
        mode,
        costCap: "Tier 1, <= 1,000 KRW",
        endpoint: plan.endpoint,
        region: plan.region,
        credentialsKind: plan.credentialsKind,
        credentialReady: plan.credentialReady,
        steps: [
          { label: "Create temporary bucket", status: "planned" },
          { label: "Upload one tiny text object", status: "planned" },
          { label: "Download and compare object", status: "planned" },
          { label: "Delete object and bucket", status: "planned" },
        ],
      });
    }

    assertRunAllowed(request, env);

    const result = await runObjectStorageSmoke(env);

    if (result.blocked) {
      return blocked({
        title: "NCP Object Storage smoke test blocked",
        mode,
        bucketName: result.bucketName,
        objectName: result.objectName,
        message: result.blocked,
        steps: result.steps,
      });
    }

    return ok({
      title: "NCP Object Storage smoke test",
      mode,
      bucketName: result.bucketName,
      objectName: result.objectName,
      steps: result.steps,
    });
  } catch (error) {
    return routeError(error, mode === "execute" ? 403 : 400);
  }
}
