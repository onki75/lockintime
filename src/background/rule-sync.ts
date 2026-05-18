import type { BlockRule } from '../lib/types'
import { normalizeRulePattern } from '../lib/validation'
import { evaluateRule, type RuleEvaluationContext } from './rule-engine'

const BLOCKED_PAGE_URL = chrome.runtime.getURL('blocked.html')

function buildBlockedPageUrl(
  domain: string,
  ruleId: string,
  reason: string,
  until: number | null,
  subReason: string | null,
): string {
  const params = new URLSearchParams({
    url: domain,
    ruleId,
    reason,
  })

  if (until !== null) {
    params.set('until', String(until))
  }

  if (subReason !== null) {
    params.set('subReason', subReason)
  }

  return `${BLOCKED_PAGE_URL}?${params.toString()}`
}

export function toDeclarativeRules(
  blockRules: BlockRule[],
  context: RuleEvaluationContext = {},
): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = []
  let ruleId = 1

  for (const blockRule of blockRules) {
    const evaluation = evaluateRule(blockRule, context)
    if (!evaluation.blocked || !evaluation.reason) {
      continue
    }

    for (const domain of evaluation.matchedDomains) {
      const normalizedDomain = normalizeRulePattern(domain)
      if (normalizedDomain === null) {
        console.warn('Skipping invalid block rule domain during DNR sync', {
          ruleId: blockRule.id,
          domain,
        })
        continue
      }

      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: {
            url: buildBlockedPageUrl(
              normalizedDomain,
              blockRule.id,
              evaluation.reason,
              evaluation.until,
              evaluation.subReason,
            ),
          },
        },
        condition: {
          urlFilter: `||${normalizedDomain}`,
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
        },
      })
    }
  }

  return rules
}

async function addRulesWithQuotaFallback(
  addRules: chrome.declarativeNetRequest.Rule[],
): Promise<void> {
  if (addRules.length === 0) return

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [],
      addRules,
    })
    return
  } catch (error) {
    console.warn('Failed to add all generated DNR rules; retrying with quota-safe subset', {
      attemptedRuleCount: addRules.length,
      error,
    })
  }

  let low = 0
  let high = addRules.length
  let best = 0
  const generatedRuleIds = addRules.map((rule) => rule.id)

  while (low <= high) {
    const midpoint = Math.floor((low + high) / 2)

    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: generatedRuleIds,
        addRules: [],
      })
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [],
        addRules: addRules.slice(0, midpoint),
      })
      best = midpoint
      low = midpoint + 1
    } catch {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: generatedRuleIds,
        addRules: [],
      })
      high = midpoint - 1
    }
  }

  if (best === 0) {
    console.warn('DNR dynamic rule quota prevented adding generated rules; stale rules were removed')
    return
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: generatedRuleIds,
    addRules: [],
  })
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [],
      addRules: addRules.slice(0, best),
    })
    console.warn('DNR dynamic rule quota limited generated rules', {
      addedRuleCount: best,
      skippedRuleCount: addRules.length - best,
    })
  } catch (error) {
    console.warn('DNR dynamic rule quota changed before subset add completed; stale rules were removed', {
      attemptedRuleCount: best,
      error,
    })
  }
}

export async function syncRules(
  blockRules: BlockRule[],
  context: RuleEvaluationContext = {},
): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
  const removeRuleIds = existingRules.map((rule) => rule.id)
  const addRules = toDeclarativeRules(blockRules, context)

  console.log('[LockInTime] syncRules', {
    inputRules: blockRules.map((rule) => ({
      id: rule.id,
      domains: rule.type === 'site' ? [rule.url] : rule.urls,
      restrictions: rule.restrictions.map((restriction) => restriction.type),
      evaluation: evaluateRule(rule, context),
    })),
    activeSessions: context.sessionState?.active ?? {},
    generatedDnrFilters: addRules.map((rule) => rule.condition.urlFilter),
  })

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: [],
  })
  await addRulesWithQuotaFallback(addRules)
}
