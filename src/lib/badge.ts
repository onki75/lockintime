import type { BlockRule } from './types'

const ACTIVE_BADGE_COLOR = '#4CAF50'

export function updateBadge(rules: BlockRule[]): void {
  const enabledRuleCount = rules.filter((rule) => rule.enabled).length

  chrome.action.setBadgeText({
    text: enabledRuleCount > 0 ? String(enabledRuleCount) : '',
  })

  if (enabledRuleCount > 0) {
    chrome.action.setBadgeBackgroundColor({
      color: ACTIVE_BADGE_COLOR,
    })
  }
}
