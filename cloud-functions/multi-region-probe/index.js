"use strict";

const MAX_TARGETS = 20;
const DEFAULT_TIMEOUT_MS = 5_000;
const deploymentConfig = require("./targets.json");

function isPrivateHostname(hostname) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local")) {
    return true;
  }
  if (value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) {
    return true;
  }

  const parts = value.split(".").map(Number);
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return (
      parts[0] === 0 ||
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] >= 224
    );
  }

  return false;
}

function validateTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("At least one probe target is required.");
  }
  if (targets.length > MAX_TARGETS) {
    throw new Error(`A single activation supports at most ${MAX_TARGETS} targets.`);
  }

  const seenIds = new Set();

  for (const target of targets) {
    if (!target || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(target.id ?? "")) {
      throw new Error("Target ids must be lowercase letters, numbers, and hyphens.");
    }
    if (seenIds.has(target.id)) {
      throw new Error(`Duplicate target id: ${target.id}.`);
    }

    let url;
    try {
      url = new URL(target.url);
    } catch {
      throw new Error(`Target ${target.id} has an invalid URL.`);
    }

    if (url.protocol !== "https:") {
      throw new Error(`Target ${target.id} must use HTTPS.`);
    }
    if (isPrivateHostname(url.hostname)) {
      throw new Error(`Target ${target.id} must use a public HTTPS hostname.`);
    }
    if (url.username || url.password) {
      throw new Error(`Target ${target.id} must not contain URL credentials.`);
    }
    if (url.search || url.hash) {
      throw new Error(`Target ${target.id} must not contain query strings or fragments.`);
    }
    if (
      target.expectedStatus !== undefined &&
      (!Number.isInteger(target.expectedStatus) ||
        target.expectedStatus < 100 ||
        target.expectedStatus > 599)
    ) {
      throw new Error(`Target ${target.id} has an invalid expected status.`);
    }

    seenIds.add(target.id);
  }

  return targets;
}

function normalizeTimeout(value) {
  const timeout = Number(value ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeout) || timeout < 500 || timeout > 10_000) {
    throw new Error("timeoutMs must be between 500 and 10000.");
  }
  return Math.round(timeout);
}

function createProbeAction({
  boundTargets,
  boundTimeoutMs,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  nowMs = Date.now,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }

  return async function probeAction(params = {}) {
    const targets = validateTargets(boundTargets ?? params.targets);
    const timeoutMs = normalizeTimeout(boundTimeoutMs ?? params.timeoutMs);
    const region = String(params.region ?? "unknown").slice(0, 16);

    const results = await Promise.all(
      targets.map(async (target) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const startedAt = nowMs();

        try {
          const response = await fetchImpl(target.url, {
            method: "HEAD",
            redirect: "manual",
            signal: controller.signal,
            headers: { "user-agent": "cloud-gpu-multi-region-probe/1.0" },
          });
          const latencyMs = Math.max(0, Math.round(nowMs() - startedAt));
          const expectedStatus = target.expectedStatus ?? 200;

          return {
            id: target.id,
            ok: response.status === expectedStatus,
            status: response.status,
            latencyMs,
          };
        } catch {
          return {
            id: target.id,
            ok: false,
            status: null,
            latencyMs: Math.max(0, Math.round(nowMs() - startedAt)),
            error: "request_failed",
          };
        } finally {
          clearTimeout(timeoutId);
        }
      }),
    );

    return {
      ok: results.every((result) => result.ok),
      region,
      checkedAt: now().toISOString(),
      results,
    };
  };
}

const main = createProbeAction({
  boundTargets: deploymentConfig.targets,
  boundTimeoutMs: deploymentConfig.timeoutMs,
});

module.exports = { createProbeAction, main, validateTargets };
