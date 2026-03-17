import type { BlockRule } from '../lib/types'
import { evaluateRule, type RuleEvaluationContext } from './rule-engine'

const BLOCKED_PAGE_URL = chrome.runtime.getURL('blocked.html')

function buildBlockedPageUrl(
  domain: string,
  ruleId: string,
  reason: string,
  until: number | null,
): string {
  const params = new URLSearchParams({
    url: domain,
    ruleId,
    reason,
  })

  if (until !== null) {
    params.set('until', String(until))
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
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: {
            url: buildBlockedPageUrl(
              domain,
              blockRule.id,
              evaluation.reason,
              evaluation.until,
            ),
          },
        },
        condition: {
          urlFilter: `||${domain}`,
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
        },
      })
    }
  }

  return rules
}

export async function syncRules(
  blockRules: BlockRule[],
  context: RuleEvaluationContext = {},
): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
  const removeRuleIds = existingRules.map((rule) => rule.id)
  const addRules = toDeclarativeRules(blockRules, context)

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  })
}
