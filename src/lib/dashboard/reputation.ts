const DEFAULT_REPUTATION = 40;
const MAX_REPUTATION = 100;
const MIN_REPUTATION = 0;
const REPUTATION_SCHEMA_VERSION = 2;

function normalizeReputation(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REPUTATION;
  return Math.min(MAX_REPUTATION, Math.max(MIN_REPUTATION, Math.round(value)));
}

/** Effective reputation for a (possibly legacy / unmigrated) user document. */
export function getEffectiveReputation(user: {
  reputation?: number | null;
  reputationVersion?: number | null;
}): number {
  const v = user.reputationVersion ?? 1;
  if (v < REPUTATION_SCHEMA_VERSION) return DEFAULT_REPUTATION;
  return normalizeReputation(user.reputation ?? DEFAULT_REPUTATION);
}
