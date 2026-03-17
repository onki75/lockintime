import type { BypassEntry, BypassState, LocationState } from '../lib/types'

export function pruneExpiredBypasses(
  bypassState: BypassState,
  now = Date.now(),
): BypassState {
  return {
    entries: bypassState.entries.filter((entry) => entry.expiresAt > now),
  }
}

export function upsertBypassEntry(
  bypassState: BypassState,
  entry: BypassEntry,
): BypassState {
  const entries = bypassState.entries.filter((existing) => existing.ruleId !== entry.ruleId)
  entries.push(entry)
  entries.sort((left, right) => left.expiresAt - right.expiresAt)

  return { entries }
}

export function createBypassEntry(
  ruleId: string,
  durationMinutes: number,
  now = Date.now(),
): BypassEntry {
  return {
    ruleId,
    createdAt: now,
    expiresAt: now + durationMinutes * 60 * 1000,
  }
}

export function getActiveBypassEntry(
  bypassState: BypassState,
  ruleId: string,
  now = Date.now(),
): BypassEntry | null {
  return bypassState.entries.find(
    (entry) => entry.ruleId === ruleId && entry.expiresAt > now,
  ) ?? null
}

export function setLocationCheckResult(
  activeLocationIds: string[],
  checkedAt: number,
  lastError: string | null = null,
): LocationState {
  return {
    activeLocationIds: [...activeLocationIds].sort(),
    lastCheckedAt: checkedAt,
    lastError,
  }
}
