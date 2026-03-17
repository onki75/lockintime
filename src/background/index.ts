// LockInTime - Background Service Worker (Manifest V3)

import { getSettings } from '../lib/storage'
import type { Settings } from '../lib/types'
import { syncRules } from '../lib/rules'

// 初回インストール時・アップデート時にルールを同期
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings()
  await syncRules(settings.blockRules)
  console.log('LockInTime: rules synced on install')
})

// Storage変更を監視してルールを自動更新
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local' || !changes.settings) return

  const settings = changes.settings.newValue as Settings | undefined
  if (settings) {
    await syncRules(settings.blockRules)
    console.log('LockInTime: rules synced on settings change')
  }
})
