import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const execute = process.argv.slice(2).includes("--execute");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const values = {};

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    values[line.slice(0, separator).trim()] = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }

  return values;
}

const env = {
  ...parseEnvFile(resolve(process.cwd(), ".env.local")),
  ...process.env,
};
const apiKey = env.NCP_CLOVASTUDIO_API_KEY;
const baseUrl = (
  env.NCP_CLOVASTUDIO_BASE_URL || "https://clovastudio.stream.ntruss.com/v1/openai"
).replace(/\/+$/, "");
const model = env.NCP_CLOVASTUDIO_MODEL || "HCX-DASH-002";
const body = {
  model,
  messages: [
    {
      role: "system",
      content:
        "건강기능식품 라벨에서 성분명, 1일 섭취량 기준 함량, 단위를 추출하세요. 추측하지 말고 JSON 한 개만 출력하세요.",
    },
    {
      role: "user",
      content:
        "표시 예시: 1일 섭취량 2정(1,200 mg). 비타민D 25 μg, 칼슘 300 mg, 마그네슘 150 mg.",
    },
  ],
  temperature: 0,
  max_tokens: 120,
};

console.log("NCP CLOVA Studio smoke test");
console.log(`Mode: ${execute ? "execute" : "dry-run"}`);
console.log(`Endpoint: ${baseUrl}/chat/completions`);
console.log(`Model: ${model}`);
console.log("Input: synthetic supplement label; no user or company document is sent");
console.log("Output cap: 120 tokens");
console.log("Cost cap: one request, <= 1,000 KRW guardrail");

if (!execute) {
  console.log(JSON.stringify(body, null, 2));
  console.log("Dry-run only. Re-run with --execute after issuing a CLOVA Studio API key.");
  process.exit(0);
}

if (!apiKey) {
  console.error("Missing NCP_CLOVASTUDIO_API_KEY. Issue a test/service API key in CLOVA Studio first.");
  process.exit(1);
}

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);

try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-NCP-CLOVASTUDIO-REQUEST-ID": randomUUID(),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const payload = await response.json().catch(() => null);

  console.log(`HTTP status: ${response.status}`);

  if (!response.ok) {
    const code = payload?.error?.code ?? payload?.status?.code ?? "unknown";
    const message = payload?.error?.message ?? payload?.status?.message ?? "No error message";
    throw new Error(`${code}: ${message}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  const usage = payload?.usage;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("CLOVA Studio returned no message content.");
  }

  console.log(`Result: ${content.trim().slice(0, 1000)}`);

  if (usage) {
    console.log(
      `Usage: input=${usage.prompt_tokens ?? "n/a"}, output=${usage.completion_tokens ?? "n/a"}, total=${usage.total_tokens ?? "n/a"}`,
    );
  }

  console.log("NCP CLOVA Studio smoke test: OK");
} catch (error) {
  console.error(`NCP CLOVA Studio smoke test failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutId);
}
