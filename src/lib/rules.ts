import type { BlockRule } from './types'
import { getBlockedDomains } from './storage'
import { isWithinSchedule } from '../background/time-scheduler'

const BLOCKED_PAGE_URL = chrome.runtime.getURL('blocked.html')

function shouldBlockRule(rule: BlockRule, now: Date): boolean {
  const hasFullBlock = rule.restrictions.some((restriction) => restriction.type === 'full_block')
  if (hasFullBlock) return true

  return rule.restrictions.some((restriction) => {
    return restriction.type === 'time_of_day' && isWithinSchedule(restriction.schedule, now)
  })
}

/**
 * BlockRule[] からブロック対象ルールの declarativeNetRequest 動的ルールを生成する。
 * 各ドメインに対して1つのリダイレクトルールを作成する。
 */
function toDeclarativeRules(
  blockRules: BlockRule[],
  now: Date,
): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = []
  let ruleId = 1

  for (const rule of blockRules) {
    if (!rule.enabled) continue
    if (!shouldBlockRule(rule, now)) continue

    for (const domain of getBlockedDomains(rule)) {
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: {
            url: `${BLOCKED_PAGE_URL}?url=${encodeURIComponent(domain)}&ruleId=${rule.id}`,
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

/**
 * 現在の動的ルールをすべて削除し、新しいルールに置き換える
 */
export async function syncRules(
  blockRules: BlockRule[],
  now: Date = new Date(),
): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
  const removeRuleIds = existingRules.map((r) => r.id)
  const addRules = toDeclarativeRules(blockRules, now)

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  })
}
