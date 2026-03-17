import type { BlockRule } from './types'
import { getBlockedDomains } from './storage'

const BLOCKED_PAGE_URL = chrome.runtime.getURL('blocked.html')

/**
 * BlockRule[] から full_block 制限を持つルールの declarativeNetRequest 動的ルールを生成する。
 * 各ドメインに対して1つのリダイレクトルールを作成する。
 */
function toDeclarativeRules(
  blockRules: BlockRule[],
): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = []
  let ruleId = 1

  for (const rule of blockRules) {
    if (!rule.enabled) continue
    const hasFullBlock = rule.restrictions.some((r) => r.type === 'full_block')
    if (!hasFullBlock) continue

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
export async function syncRules(blockRules: BlockRule[]): Promise<void> {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules()
  const removeRuleIds = existingRules.map((r) => r.id)
  const addRules = toDeclarativeRules(blockRules)

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  })
}
