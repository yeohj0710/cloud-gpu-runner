import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

import { chromium } from "playwright";

const port = process.env.DASHBOARD_VERIFY_PORT ?? "3017";
const baseUrl = `http://127.0.0.1:${port}`;
const outputDir = resolve(process.cwd(), ".next");
const executeLive = process.env.DASHBOARD_VERIFY_EXECUTE === "1";
const runToken = process.env.DASHBOARD_RUN_TOKEN ?? "";

async function fetchWithTimeout(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForServer() {
  for (let i = 0; i < 45; i += 1) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/config/status`);

      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting until the dev server is ready.
    }

    await wait(1000);
  }

  throw new Error(`Dashboard did not become ready at ${baseUrl}`);
}

async function runDryRun(page, cardIndex, expectedTitle) {
  const card = page.locator(".experiment-card").nth(cardIndex);

  await card.locator('[data-run-experiment="true"][data-mode="dry-run"]').click();
  await page.getByText(expectedTitle).first().waitFor({ timeout: 15_000 });
}

async function verifyInBrowser() {
  await mkdir(outputDir, { recursive: true });

  console.log("Launching Chromium...");
  const browser = await chromium.launch();
  console.log("Chromium launched.");
  const consoleErrors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

    if (executeLive) {
      if (!runToken) {
        throw new Error(
          "DASHBOARD_RUN_TOKEN is required when DASHBOARD_VERIFY_EXECUTE=1.",
        );
      }

      await page.addInitScript((token) => {
        window.localStorage.setItem("cloud-credit-run-token", token);
      }, runToken);
    }

    page.setDefaultTimeout(15_000);
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    console.log(`Opening ${baseUrl}...`);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    console.log("Dashboard document loaded.");
    await page.locator("h1").first().waitFor();
    await page.getByRole("heading", { name: "GPT가 못 하는 일에만 크레딧을 써요" }).waitFor();
    await page.getByRole("heading", { name: /15,300,000원/ }).waitFor();
    await page.getByText("insane-search-testbed", { exact: true }).first().waitFor();
    await page.getByText("CLOVA OCR·Studio로 라벨과 문서 추출", { exact: true }).waitFor();

    const healthResponse = await page.request.head(`${baseUrl}/api/health`);
    if (healthResponse.status() !== 200) {
      throw new Error(`Health endpoint returned ${healthResponse.status()}, expected 200.`);
    }

    if (!executeLive) {
      const blockedResponse = await page.request.post(`${baseUrl}/api/ncp/region-smoke`, {
        data: { mode: "execute" },
      });

      if (blockedResponse.status() !== 403) {
        throw new Error(
          `Production execute guard returned ${blockedResponse.status()}, expected 403.`,
        );
      }
    }

    await page.screenshot({
      path: resolve(outputDir, "dashboard-desktop.png"),
      caret: "initial",
      fullPage: true,
    });
    console.log("Desktop screenshot saved.");

    console.log("Checking safe dry-run buttons...");
    await runDryRun(page, 0, "NCP region smoke test");
    await runDryRun(page, 1, "NCP cost snapshot");
    await runDryRun(page, 2, "NCP Object Storage smoke test");

    if (executeLive) {
      console.log("DASHBOARD_VERIFY_EXECUTE=1 set; checking the region execute button...");
      const firstCard = page.locator(".experiment-card").nth(0);
      await firstCard.getByRole("button", { name: "실행" }).click();
      await page.getByText("NCP region smoke test").first().waitFor({ timeout: 30_000 });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    if (horizontalOverflow > 1) {
      throw new Error(`Mobile horizontal overflow: ${horizontalOverflow}px`);
    }

    await page.screenshot({
      path: resolve(outputDir, "dashboard-mobile.png"),
      caret: "initial",
      fullPage: true,
    });
    console.log("Mobile screenshot saved.");

  } finally {
    await browser.close();
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
  }
}

console.log(`Checking dashboard at ${baseUrl}`);

try {
  await waitForServer();
  await verifyInBrowser();
  console.log(`Dashboard verification OK: ${baseUrl}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

process.exit(process.exitCode ?? 0);
