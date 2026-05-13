import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

import { chromium } from "playwright";

const port = process.env.DASHBOARD_VERIFY_PORT ?? "3017";
const baseUrl = `http://localhost:${port}`;
const outputDir = resolve(process.cwd(), ".next");

async function waitForServer() {
  for (let i = 0; i < 35; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/config/status`);

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

async function verifyInBrowser() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("h1").first().waitFor();
  await page.screenshot({
    path: resolve(outputDir, "dashboard-desktop.png"),
    fullPage: true,
  });

  const firstCard = page.locator(".experiment-card").nth(0);
  await firstCard.getByRole("button", { name: "Dry run" }).click();
  await page.getByText("NCP region smoke test").first().waitFor();
  await firstCard.locator(".button-primary").click();
  await page.getByText("KR, SGN, JPN").first().waitFor({ timeout: 15000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(outputDir, "dashboard-mobile.png"),
    fullPage: true,
  });

  await browser.close();

  if (consoleErrors.length > 0) {
    throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
  }
}

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", port],
  {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let logs = "";

server.stdout.on("data", (chunk) => {
  logs += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  logs += chunk.toString();
});

try {
  await waitForServer();
  await verifyInBrowser();
  console.log(`Dashboard verification OK: ${baseUrl}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(logs.split(/\r?\n/).slice(-40).join("\n"));
  process.exitCode = 1;
} finally {
  server.kill();
}
