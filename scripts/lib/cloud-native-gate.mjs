function assertNonEmpty(value, message) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
}

function roundRatio(value) {
  return Math.round(value * 10_000) / 10_000;
}

export function summarizeCommittedBudget(portfolio) {
  const totals = portfolio.allocations.reduce(
    (summary, allocation) => ({
      availableKrw: summary.availableKrw + allocation.availableKrw,
      committedCapKrw: summary.committedCapKrw + allocation.committedCapKrw,
      parkedKrw: summary.parkedKrw + allocation.parkedKrw,
    }),
    { availableKrw: 0, committedCapKrw: 0, parkedKrw: 0 },
  );

  return {
    ...totals,
    committedRatio:
      totals.availableKrw === 0
        ? 0
        : roundRatio(totals.committedCapKrw / totals.availableKrw),
  };
}

export function validateCloudNativePortfolio(portfolio) {
  if (!portfolio || portfolio.schemaVersion !== 2) {
    throw new Error("Cloud-native portfolio schemaVersion must be 2.");
  }

  const providers = Array.isArray(portfolio.providers) ? portfolio.providers : [];
  const allocations = Array.isArray(portfolio.allocations) ? portfolio.allocations : [];
  const opportunities = Array.isArray(portfolio.opportunities) ? portfolio.opportunities : [];
  const providerById = new Map();
  const grantByKey = new Map();
  let providerTotal = 0;

  for (const provider of providers) {
    if (providerById.has(provider.id)) {
      throw new Error(`Duplicate provider id: ${provider.id}`);
    }

    providerById.set(provider.id, provider);
    providerTotal += provider.confirmedIssuedKrw;
    const grantTotal = provider.grants.reduce((sum, grant) => sum + grant.amountKrw, 0);

    if (grantTotal !== provider.confirmedIssuedKrw) {
      throw new Error(`Provider grant total mismatch for ${provider.id}.`);
    }

    for (const grant of provider.grants) {
      const key = `${provider.id}:${grant.id}`;
      if (grantByKey.has(key)) {
        throw new Error(`Duplicate grant id: ${key}`);
      }
      grantByKey.set(key, grant);
    }
  }

  if (providerTotal !== portfolio.confirmedIssuedKrw) {
    throw new Error(
      `Portfolio confirmed total mismatch: ${providerTotal} != ${portfolio.confirmedIssuedKrw}.`,
    );
  }

  const allocationByGrant = new Map();

  for (const allocation of allocations) {
    const key = `${allocation.providerId}:${allocation.grantId}`;
    const grant = grantByKey.get(key);

    if (!grant) {
      throw new Error(`Allocation references an unknown grant: ${key}.`);
    }
    if (allocationByGrant.has(key)) {
      throw new Error(`Duplicate allocation for grant: ${key}.`);
    }
    if (allocation.availableKrw !== grant.amountKrw) {
      throw new Error(`Allocation available amount mismatch for ${allocation.id}.`);
    }
    if (allocation.committedCapKrw + allocation.parkedKrw !== allocation.availableKrw) {
      throw new Error(`Allocation balance mismatch for ${allocation.id}.`);
    }

    const itemTotal = allocation.items.reduce((sum, item) => sum + item.capKrw, 0);
    if (itemTotal !== allocation.committedCapKrw) {
      throw new Error(`Committed item total mismatch for ${allocation.id}.`);
    }

    allocationByGrant.set(key, allocation);
  }

  if (allocationByGrant.size !== grantByKey.size) {
    throw new Error("Every issued grant must have one allocation, including parked grants.");
  }

  const opportunityCaps = new Map();

  for (const opportunity of opportunities) {
    if (opportunity.gptSubstitute !== false) {
      throw new Error(`GPT-substitutable opportunity is not allowed: ${opportunity.title}.`);
    }

    assertNonEmpty(
      opportunity.cloudExclusiveCapability,
      `Opportunity lacks a cloud-exclusive capability: ${opportunity.title}.`,
    );
    assertNonEmpty(opportunity.stopRule, `Opportunity lacks a stop rule: ${opportunity.title}.`);

    if (!Array.isArray(opportunity.unlockConditions) || opportunity.unlockConditions.length === 0) {
      throw new Error(`Opportunity lacks unlock conditions: ${opportunity.title}.`);
    }
    if (!Number.isFinite(opportunity.budgetCapKrw) || opportunity.budgetCapKrw < 0) {
      throw new Error(`Opportunity has an invalid budget cap: ${opportunity.title}.`);
    }

    const key = `${opportunity.providerId}:${opportunity.grantId}`;
    if (!allocationByGrant.has(key)) {
      throw new Error(`Opportunity references an unknown allocation: ${key}.`);
    }
    opportunityCaps.set(key, (opportunityCaps.get(key) ?? 0) + opportunity.budgetCapKrw);
  }

  for (const [key, cap] of opportunityCaps) {
    if (cap > allocationByGrant.get(key).committedCapKrw) {
      throw new Error(`Opportunity caps exceed committed budget for ${key}.`);
    }
  }

  const summary = summarizeCommittedBudget(portfolio);
  if (summary.availableKrw !== portfolio.confirmedIssuedKrw) {
    throw new Error("Allocation totals do not cover the confirmed issued credits.");
  }

  return portfolio;
}
