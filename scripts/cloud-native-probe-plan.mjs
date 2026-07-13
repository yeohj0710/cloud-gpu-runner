import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { validateTargets } = require("../cloud-functions/multi-region-probe/index.js");

function parseArgs(argv) {
  const parsed = {
    config: "data/cloud-native-probes.example.json",
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--config") {
      parsed.config = argv[index + 1];
      index += 1;
    } else if (argument === "--json") {
      parsed.json = true;
    } else if (argument === "--execute") {
      throw new Error(
        "This command is planning-only. Deploy actions in the NAVER console after reviewing endpoints and cost limits.",
      );
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return parsed;
}

function buildPlan(config, configPath) {
  if (config.schemaVersion !== 1) {
    throw new Error("Probe config schemaVersion must be 1.");
  }
  validateTargets(config.targets);
  if (!Array.isArray(config.regions) || config.regions.join(",") !== "KR,SGN,JPN") {
    throw new Error("The initial plan must use exactly KR, SGN, and JPN.");
  }
  if (config.privacy?.storeResponseBody !== false || config.privacy?.storeUrlInResult !== false) {
    throw new Error("Probe privacy settings must exclude response bodies and URLs from results.");
  }

  return {
    mode: "dry-run",
    config: configPath,
    actionSource: "cloud-functions/multi-region-probe",
    schedule: config.schedule,
    timeoutMs: config.timeoutMs,
    targetIds: config.targets.map((target) => target.id),
    deployments: config.regions.map((region) => ({
      region,
      actionName: `cloud-gpu-uptime-${region.toLowerCase()}`,
      trigger: "cron",
      params: { region },
      targetBinding: "cloud-functions/multi-region-probe/targets.json",
    })),
    storesResponseBody: false,
    networkCallsMade: 0,
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const configPath = resolve(args.config);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const boundTargets = JSON.parse(
    readFileSync(resolve("cloud-functions/multi-region-probe/targets.json"), "utf8"),
  );
  if (
    JSON.stringify(boundTargets.targets) !== JSON.stringify(config.targets) ||
    boundTargets.timeoutMs !== config.timeoutMs
  ) {
    throw new Error("Probe plan and the deployment-bound targets.json are out of sync.");
  }
  const plan = buildPlan(config, configPath);

  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log("Cloud-native multi-region probe plan");
    console.log(`Mode: ${plan.mode}`);
    console.log(`Regions: ${plan.deployments.map((item) => item.region).join(", ")}`);
    console.log(`Targets: ${plan.targetIds.join(", ")}`);
    console.log(`Schedule: ${plan.schedule}`);
    console.log("Stored fields: target id, region, HTTP status, latency, timestamp");
    console.log("Response body and URL storage: disabled");
    console.log("Network calls: 0");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
