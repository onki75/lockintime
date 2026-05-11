import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BlockRule, SiteRule, GroupRule } from '../types'

// Chrome API mock
const mockGetDynamicRules = vi.fn()
const mockUpdateDynamicRules = vi.fn()
const mockGetURL = vi.fn((path: string) => `chrome-extension://abc123/${path}`)

vi.stubGlobal('chrome', {
  declarativeNetRequest: {
    getDynamicRules: mockGetDynamicRules,
    updateDynamicRules: mockUpdateDynamicRules,
    RuleActionType: { REDIRECT: 'redirect' },
    ResourceType: { MAIN_FRAME: 'main_frame' },
  },
  runtime: {
    getURL: mockGetURL,
  },
})

const { syncRules } = await import('../rules')

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDynamicRules.mockResolvedValue([])
  mockUpdateDynamicRules.mockResolvedValue(undefined)
})

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

function makeGroupRule(overrides: Partial<GroupRule> = {}): GroupRule {
  return {
    id: 'g1',
    type: 'group',
    name: 'SNS',
    urls: ['twitter.com', 'x.com'],
    restrictions: [{ type: 'full_block' }],
    preset: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('syncRules', () => {
  it('should add rules for site rules with full_block', async () => {
    const rules: BlockRule[] = [
      makeSiteRule({ id: '1', url: 'youtube.com' }),
      makeSiteRule({ id: '2', url: 'twitter.com' }),
    ]

    await syncRules(rules)

    const call = mockUpdateDynamicRules.mock.calls[0][0]
    expect(call.addRules).toHaveLength(2)
    expect(call.addRules[0].condition.urlFilter).toBe('||youtube.com')
    expect(call.addRules[1].condition.urlFilter).toBe('||twitter.com')
  })

  it('should skip rules without full_block restriction', async () => {
    const rules: BlockRule[] = [
      makeSiteRule({
        id: '1',
        url: 'youtube.com',
        restrictions: [{ type: 'daily_count', maxCount: 3 }],
      }),
      makeSiteRule({ id: '2', url: 'twitter.com' }),
    ]

    await syncRules(rules)

    const call = mockUpdateDynamicRules.mock.calls[0][0]
    expect(call.addRules).toHaveLength(1)
    expect(call.addRules[0].condition.urlFilter).toBe('||twitter.com')
  })

  it('should add rules for time_of_day restrictions when now is within schedule', async () => {
    const rules: BlockRule[] = [
      makeSiteRule({
        id: '1',
        url: 'youtube.com',
        restrictions: [
          {
            type: 'time_of_day',
            schedule: [{ days: [1], startTime: '09:00', endTime: '18:00' }],
          },
        ],
      }),
    ]

    await syncRules(rules, new Date('2026-01-05T10:00:00'))

    const call = mockUpdateDynamicRules.mock.calls[0][0]
    expect(call.addRules).toHaveLength(1)
    expect(call.addRules[0].condition.urlFilter).toBe('||youtube.com')
  })

  it('should skip time_of_day restrictions when now is outside schedule', async () => {
    const rules: BlockRule[] = [
      makeSiteRule({
        id: '1',
        url: 'youtube.com',
        restrictions: [
          {
            type: 'time_of_day',
            schedule: [{ days: [1], startTime: '09:00', endTime: '18:00' }],
          },
        ],
      }),
    ]

    await syncRules(rules, new Date('2026-01-05T20:00:00'))

    const call = mockUpdateDynamicRules.mock.calls[0][0]
    expect(call.addRules).toHaveLength(0)
  })

  it('should prioritize full_block over time_of_day restrictions', async () => {
    const rules: BlockRule[] = [
      makeSiteRule({
        id: '1',
        url: 'youtube.com',
        restrictions: [
          { type: 'full_block' },
          {
            type: 'time_of_day',
            schedule: [{ days: [1], startTime: '09:00', endTime: '18:00' }],
          },
        ],
      }),
    ]

    await syncRules(rules, new Date('2026-01-05T20:00:00'))

    const call = mockUpdateDynamicRules.mock.calls[0][0]
    expect(call.addRules).toHaveLength(1)
    expect(call.addRules[0].condition.urlFilter).toBe('||youtube.com')
  })

  it('should expand group rules to individual domain rules', async () => {
    const rules: BlockRule[] = [
      makeGroupRule({ urls: ['twitter.com', 'x.com', 'instagram.com'] }),
    ]

    await syncRules(rules)

    const call = mockUpdateDynamicRules.mock.calls[0][0]
    expect(call.addRules).toHaveLength(3)
    expect(call.addRules[0].condition.urlFilter).toBe('||twitter.com')
    expect(call.addRules[1].condition.urlFilter).toBe('||x.com')
    expect(call.addRules[2].condition.urlFilter).toBe('||instagram.com')
  })

  it('should remove existing rules before adding new ones', async () => {
    mockGetDynamicRules.mockResolvedValue([{ id: 10 }, { id: 20 }])

    await syncRules([])

    expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [10, 20],
      addRules: [],
    })
  })

  it('should handle empty rules', async () => {
    await syncRules([])

    expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [],
      addRules: [],
    })
  })

  it('should redirect to blocked page with url and ruleId params', async () => {
    const rules: BlockRule[] = [
      makeSiteRule({ id: 'rule-123', url: 'youtube.com' }),
    ]

    await syncRules(rules)

    const call = mockUpdateDynamicRules.mock.calls[0][0]
    const redirect = call.addRules[0].action.redirect.url
    expect(redirect).toContain('blocked.html')
    expect(redirect).toContain('url=youtube.com')
    expect(redirect).toContain('ruleId=rule-123')
  })
})
