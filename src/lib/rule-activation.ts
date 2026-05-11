import type { BlockRule, LicensePlan, RestrictionType } from './types'
import { isProPlanEnabled } from './billing'

export type RulePlanState = 'free' | 'pro'
export type RuleActivationState = 'active' | 'inactive_free_limit' | 'inactive_pro_lock'

export const MAX_FREE_ACTIVE_RULES = 5

const PRO_ONLY_TYPES: RestrictionType[] = [
  'daily_count',
  'daily_duration',
  'cooldown',
  'delay',
  'location',
]

const PRO_ONLY_TYPE_SET = new Set<RestrictionType>(PRO_ONLY_TYPES)

export function isProLockedRule(rule: BlockRule): boolean {
  return rule.restrictions.some((restriction) => PRO_ONLY_TYPE_SET.has(restriction.type))
}

export function getDefaultFreeActiveRuleIds(
  rules: BlockRule[],
  maxRules = MAX_FREE_ACTIVE_RULES,
): string[] {
  return rules
    .filter((rule) => !isProLockedRule(rule))
    .slice(0, maxRules)
    .map((rule) => rule.id)
}

export function normalizeFreeActiveRuleIds(
  rules: BlockRule[],
  freeActiveRuleIds: string[],
  maxRules = MAX_FREE_ACTIVE_RULES,
): string[] {
  const allowedIds = new Set(
    rules
      .filter((rule) => !isProLockedRule(rule))
      .map((rule) => rule.id),
  )

  const nextIds: string[] = []

  for (const ruleId of freeActiveRuleIds) {
    if (nextIds.length >= maxRules) {
      break
    }

    if (!allowedIds.has(ruleId) || nextIds.includes(ruleId)) {
      continue
    }

    nextIds.push(ruleId)
  }

  return nextIds
}

export function resolveRulePlanState(options: {
  trialActive: boolean
  licensePlan: LicensePlan
}): RulePlanState {
  if (!isProPlanEnabled()) {
    return 'pro'
  }

  return options.trialActive || options.licensePlan === 'pro' ? 'pro' : 'free'
}

export function getRuleActivationState(
  rule: BlockRule,
  options: {
    plan: RulePlanState
    freeActiveRuleIds: string[]
  },
): RuleActivationState {
  if (options.plan === 'pro') {
    return 'active'
  }

  if (isProLockedRule(rule)) {
    return 'inactive_pro_lock'
  }

  return options.freeActiveRuleIds.includes(rule.id)
    ? 'active'
    : 'inactive_free_limit'
}

export function getActiveRules(
  rules: BlockRule[],
  options: {
    plan: RulePlanState
    freeActiveRuleIds: string[]
  },
): BlockRule[] {
  return rules.filter((rule) => getRuleActivationState(rule, options) === 'active')
}

export function getActiveRuleCount(
  rules: BlockRule[],
  options: {
    plan: RulePlanState
    freeActiveRuleIds: string[]
  },
): number {
  return getActiveRules(rules, options).length
}
