import type { BlockRule } from './types'
import type { RulePlanState } from './rule-activation'
import { getActiveRuleCount } from './rule-activation'

const ACTIVE_BADGE_COLOR = '#4CAF50'

export function updateBadge(
  rules: BlockRule[],
  options: {
    plan: RulePlanState
    freeActiveRuleIds: string[]
  },
): void {
  const enabledRuleCount = getActiveRuleCount(rules, options)

  chrome.action.setBadgeText({
    text: enabledRuleCount > 0 ? String(enabledRuleCount) : '',
  })

  if (enabledRuleCount > 0) {
    chrome.action.setBadgeBackgroundColor({
      color: ACTIVE_BADGE_COLOR,
    })
  }
}
