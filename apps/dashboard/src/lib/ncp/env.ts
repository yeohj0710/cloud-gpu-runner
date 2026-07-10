import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type LabEnv = Record<string, string | undefined>;

const providerKeys = [
  "NCP_ACCESS_KEY_ID",
  "NCP_SECRET_KEY",
  "NCP_REGION",
  "NCP_API_ENDPOINT",
  "NCP_BILLING_API_ENDPOINT",
  "NCP_OBJECT_STORAGE_ENDPOINT",
  "NCP_OBJECT_STORAGE_REGION",
  "NCP_OBJECT_STORAGE_ACCESS_KEY_ID",
  "NCP_OBJECT_STORAGE_SECRET_KEY",
  "DASHBOARD_RUN_TOKEN",
] as const;

export type ProviderKey = (typeof providerKeys)[number];

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values: LabEnv = {};
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");

    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    const rawValue = line.slice(eqIndex + 1).trim();
    values[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }

  return values;
}

export function loadLabEnv(): LabEnv {
  const cwd = process.cwd();
  const repoRoot = resolve(cwd, "../..");

  return {
    ...parseEnvFile(resolve(repoRoot, ".env.local")),
    ...parseEnvFile(resolve(cwd, ".env.local")),
    ...process.env,
  };
}

export function getEnvStatus() {
  const env = loadLabEnv();
  const present = Object.fromEntries(
    providerKeys.map((key) => [key, Boolean(env[key])]),
  ) as Record<ProviderKey, boolean>;
  const environment: "vercel" | "production" | "local" = process.env.VERCEL
    ? "vercel"
    : process.env.NODE_ENV === "production"
      ? "production"
      : "local";
  const deployed = environment !== "local";
  const runTokenConfigured = Boolean(env.DASHBOARD_RUN_TOKEN);

  return {
    deployed,
    environment,
    runTokenConfigured,
    runTokenRequired: deployed || runTokenConfigured,
    canExecuteWithoutToken: !deployed && !runTokenConfigured,
    present,
  };
}

export function requireEnv(env: LabEnv, keys: string[]) {
  const missing = keys.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

export function assertRunAllowed(request: Request, env: LabEnv) {
  const deployed = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
  const expectedToken = env.DASHBOARD_RUN_TOKEN;
  const required = deployed || Boolean(expectedToken);

  if (!required) {
    return;
  }

  if (!expectedToken) {
    throw new Error(
      "DASHBOARD_RUN_TOKEN is required before execute actions can run on a deployed dashboard.",
    );
  }

  const providedToken = request.headers.get("x-dashboard-run-token");

  if (providedToken !== expectedToken) {
    throw new Error("Run token is missing or invalid.");
  }
}
