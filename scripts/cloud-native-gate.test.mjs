import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  summarizeCommittedBudget,
  validateCloudNativePortfolio,
} from "./lib/cloud-native-gate.mjs";

function validPortfolio() {
  return {
    schemaVersion: 2,
    confirmedIssuedKrw: 300_000,
    providers: [
      {
        id: "naver",
        confirmedIssuedKrw: 300_000,
        grants: [{ id: "urgent", amountKrw: 300_000 }],
      },
    ],
    allocations: [
      {
        id: "urgent-plan",
        providerId: "naver",
        grantId: "urgent",
        availableKrw: 300_000,
        committedCapKrw: 80_000,
        parkedKrw: 220_000,
        items: [{ label: "multi-region probe", capKrw: 80_000 }],
      },
    ],
    opportunities: [
      {
        priority: 1,
        providerId: "naver",
        grantId: "urgent",
        title: "multi-region probe",
        cloudExclusiveCapability: "Runs continuously from independent cloud regions.",
        gptSubstitute: false,
        budgetCapKrw: 80_000,
        unlockConditions: ["Three regional actions are deployed."],
        stopRule: "Stop if all regions produce the same result for 14 days.",
      },
    ],
    rejectedIdeas: [{ idea: "OCR", reason: "A general model can do it." }],
  };
}

test("accepts a bounded portfolio whose approved work is cloud-exclusive", () => {
  assert.doesNotThrow(() => validateCloudNativePortfolio(validPortfolio()));
  assert.deepEqual(summarizeCommittedBudget(validPortfolio()), {
    availableKrw: 300_000,
    committedCapKrw: 80_000,
    parkedKrw: 220_000,
    committedRatio: 0.2667,
  });
});

test("validates the deployed schema v2 portfolio", () => {
  const portfolio = JSON.parse(
    readFileSync("apps/dashboard/src/data/credit-portfolio.json", "utf8"),
  );

  assert.doesNotThrow(() => validateCloudNativePortfolio(portfolio));
  assert.equal(summarizeCommittedBudget(portfolio).committedCapKrw, 230_000);
  assert.equal(summarizeCommittedBudget(portfolio).parkedKrw, 15_070_000);
});

test("rejects opportunities that a general GPT can substitute", () => {
  const portfolio = validPortfolio();
  portfolio.opportunities[0].gptSubstitute = true;

  assert.throws(
    () => validateCloudNativePortfolio(portfolio),
    /GPT-substitutable opportunity/,
  );
});

test("rejects opportunities without a concrete cloud-exclusive capability", () => {
  const portfolio = validPortfolio();
  portfolio.opportunities[0].cloudExclusiveCapability = "";

  assert.throws(
    () => validateCloudNativePortfolio(portfolio),
    /cloud-exclusive capability/,
  );
});

test("rejects unbounded opportunities", () => {
  const portfolio = validPortfolio();
  portfolio.opportunities[0].stopRule = "";

  assert.throws(() => validateCloudNativePortfolio(portfolio), /stop rule/);
});

test("rejects allocations whose committed and parked totals do not balance", () => {
  const portfolio = validPortfolio();
  portfolio.allocations[0].parkedKrw = 200_000;

  assert.throws(() => validateCloudNativePortfolio(portfolio), /allocation balance/i);
});

test("rejects confirmed totals that do not match provider grants", () => {
  const portfolio = validPortfolio();
  portfolio.confirmedIssuedKrw = 299_999;

  assert.throws(() => validateCloudNativePortfolio(portfolio), /confirmed total/);
});
