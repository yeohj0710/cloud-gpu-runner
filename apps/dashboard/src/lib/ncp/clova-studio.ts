import { randomUUID } from "node:crypto";

import type { LabEnv } from "@/lib/ncp/env";

const REQUEST_TIMEOUT_MS = 30_000;

function requestBody(model: string) {
  return {
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
}

export function getClovaStudioPlan(env: LabEnv) {
  const baseUrl = (
    env.NCP_CLOVASTUDIO_BASE_URL || "https://clovastudio.stream.ntruss.com/v1/openai"
  ).replace(/\/+$/, "");
  const model = env.NCP_CLOVASTUDIO_MODEL || "HCX-DASH-002";

  return {
    endpoint: `${baseUrl}/chat/completions`,
    model,
    credentialReady: Boolean(env.NCP_CLOVASTUDIO_API_KEY),
    body: requestBody(model),
  };
}

export async function runClovaStudioSmoke(env: LabEnv) {
  const plan = getClovaStudioPlan(env);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(plan.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NCP_CLOVASTUDIO_API_KEY}`,
        "Content-Type": "application/json",
        "X-NCP-CLOVASTUDIO-REQUEST-ID": randomUUID(),
      },
      body: JSON.stringify(plan.body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
          error?: { code?: string; message?: string };
        }
      | null;

    if (!response.ok) {
      throw new Error(
        `${payload?.error?.code ?? response.status}: ${payload?.error?.message ?? "CLOVA Studio request failed"}`,
      );
    }

    const output = payload?.choices?.[0]?.message?.content?.trim();

    if (!output) {
      throw new Error("CLOVA Studio returned no message content.");
    }

    return {
      httpStatus: response.status,
      model: plan.model,
      output: output.slice(0, 1000),
      usage: payload?.usage,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
