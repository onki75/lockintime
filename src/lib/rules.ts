// declarativeNetRequest ルール管理

import type { BlockRule } from './storage'

const BLOCKED_PAGE_URL = chrome.runtime.getURL('blocked.html')

/**
 * BlockRule[] から declarativeNetRequest 用の動的ルールを生成する
 */
function toDeclarativeRules(
  blockRules: BlockRule[],
): chrome.declarativeNetRequest.Rule[] {
  return blockRules
    .filter((r) => r.enabled)
    .map((rule, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          url: `${BLOCKED_PAGE_URL}?url=${encodeURIComponent(rule.url)}`,
        },
      },
      condition: {
        urlFilter: `||${rule.url}`,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
        ],
      },
    }))
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
