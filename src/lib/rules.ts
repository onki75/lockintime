import type { BlockRule } from './types'
import type { RuleEvaluationContext } from '../background/rule-engine'
import {
  syncRules as syncRulesInternal,
  toDeclarativeRules as toDeclarativeRulesInternal,
} from '../background/rule-sync'

function normalizeContext(
  contextOrNow: RuleEvaluationContext | Date | undefined,
): RuleEvaluationContext {
  if (contextOrNow instanceof Date) {
    return { now: contextOrNow }
  }

  return contextOrNow ?? {}
}

export function toDeclarativeRules(
  blockRules: BlockRule[],
  contextOrNow?: RuleEvaluationContext | Date,
): chrome.declarativeNetRequest.Rule[] {
  return toDeclarativeRulesInternal(blockRules, normalizeContext(contextOrNow))
}

export async function syncRules(
  blockRules: BlockRule[],
  contextOrNow?: RuleEvaluationContext | Date,
): Promise<void> {
  await syncRulesInternal(blockRules, normalizeContext(contextOrNow))
}
