import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlockRule, SiteRule } from '../types'

const mockSetBadgeText = vi.fn()
const mockSetBadgeBackgroundColor = vi.fn()

vi.stubGlobal('chrome', {
  action: {
    setBadgeText: mockSetBadgeText,
    setBadgeBackgroundColor: mockSetBadgeBackgroundColor,
  },
})

const { updateBadge } = await import('../badge')

function makeSiteRule(overrides: Partial<SiteRule> = {}): SiteRule {
  return {
    id: '1',
    type: 'site',
    url: 'youtube.com',
    restrictions: [{ type: 'full_block' }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('updateBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the number of active rules in the badge text', () => {
    const rules: BlockRule[] = [
      makeSiteRule({ id: '1' }),
      makeSiteRule({ id: '2' }),
      makeSiteRule({ id: '3' }),
    ]

    updateBadge(rules, { plan: 'free', freeActiveRuleIds: ['1', '3'] })

    expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '2' })
    expect(mockSetBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#4CAF50',
    })
  })

  it('hides the badge when there are no active rules', () => {
    const rules: BlockRule[] = [
      makeSiteRule({ id: '1' }),
      makeSiteRule({ id: '2' }),
    ]

    updateBadge(rules, { plan: 'free', freeActiveRuleIds: [] })

    expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '' })
    expect(mockSetBadgeBackgroundColor).not.toHaveBeenCalled()
  })

  it('hides the badge and does not set a background color for empty rules', () => {
    updateBadge([], { plan: 'free', freeActiveRuleIds: [] })

    expect(mockSetBadgeText).toHaveBeenCalledWith({ text: '' })
    expect(mockSetBadgeBackgroundColor).not.toHaveBeenCalled()
  })
})
