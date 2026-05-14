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

function getLastUpdateCall() {
  const call = mockUpdateDynamicRules.mock.calls[mockUpdateDynamicRules.mock.calls.length - 1]?.[0]
  if (!call) throw new Error('Expected updateDynamicRules to be called')
  return call
}

function getLastAddCall() {
  const callsWithAddedRules = mockUpdateDynamicRules.mock.calls
    .map((call) => call[0])
    .filter((call) => call.addRules.length > 0)
  const call = callsWithAddedRules[callsWithAddedRules.length - 1]
  if (!call) throw new Error('Expected updateDynamicRules to add rules')
  return call
}

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

    const call = getLastAddCall()
    expect(call.addRules).toHaveLength(2)
    expect(call.addRules[0].condition.urlFilter).toBe('||youtube.com')
    expect(call.addRules[1].condition.urlFilter).toBe('||twitter.com')
  })

  it('emits DNR rules for daily_count with a session gate alongside full_block rules', async () => {
    const rules: BlockRule[] = [
      makeSiteRule({
        id: '1',
        url: 'youtube.com',
        restrictions: [{ type: 'daily_count', maxCount: 3, perSessionMinutes: 10 }],
      }),
      makeSiteRule({ id: '2', url: 'twitter.com' }),
    ]

    await syncRules(rules)

    const call = getLastAddCall()
    expect(call.addRules).toHaveLength(2)
    expect(call.addRules.map((r: { condition: { urlFilter: string } }) => r.condition.urlFilter).sort())
      .toEqual(['||twitter.com', '||youtube.com'])
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

    const call = getLastAddCall()
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

    const call = getLastUpdateCall()
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

    const call = getLastAddCall()
    expect(call.addRules).toHaveLength(1)
    expect(call.addRules[0].condition.urlFilter).toBe('||youtube.com')
  })

  it('should expand group rules to individual domain rules', async () => {
    const rules: BlockRule[] = [
      makeGroupRule({ urls: ['twitter.com', 'x.com', 'instagram.com'] }),
    ]

    await syncRules(rules)

    const call = getLastAddCall()
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

    const call = getLastAddCall()
    const redirect = call.addRules[0].action.redirect.url
    expect(redirect).toContain('blocked.html')
    expect(redirect).toContain('url=youtube.com')
    expect(redirect).toContain('ruleId=rule-123')
  })

  it('normalizes and skips unsafe domains before creating DNR filters', async () => {
    const rules: BlockRule[] = [
      makeGroupRule({
        urls: [
          'https://www.youtube.com/watch?v=abc',
          'youtube.com|http://evil.com',
          '*.example.com',
        ],
      }),
    ]

    await syncRules(rules)

    const call = getLastAddCall()
    expect(call.addRules).toHaveLength(2)
    expect(call.addRules[0].condition.urlFilter).toBe('||youtube.com')
    expect(call.addRules[1].condition.urlFilter).toBe('||example.com')
  })

  it('removes stale dynamic rules before adding a quota-safe subset', async () => {
    mockGetDynamicRules.mockResolvedValue([{ id: 41 }, { id: 42 }])
    mockUpdateDynamicRules.mockImplementation(async (options: { addRules: chrome.declarativeNetRequest.Rule[] }) => {
      const { addRules } = options
      if (addRules.length > 2) {
        throw new Error('quota exceeded')
      }
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await syncRules([
      makeGroupRule({ urls: ['one.example', 'two.example', 'three.example'] }),
    ])

    expect(mockUpdateDynamicRules.mock.calls[0][0]).toEqual({
      removeRuleIds: [41, 42],
      addRules: [],
    })
    const addCall = getLastAddCall()
    expect(addCall.addRules).toHaveLength(2)
    expect(addCall.addRules.map((rule: chrome.declarativeNetRequest.Rule) => rule.condition.urlFilter)).toEqual([
      '||one.example',
      '||two.example',
    ])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('does not restore stale dynamic rules when quota prevents adding any generated rules', async () => {
    mockGetDynamicRules.mockResolvedValue([{ id: 99 }])
    const successfulAddCounts: number[] = []
    mockUpdateDynamicRules.mockImplementation(async (options: { addRules: chrome.declarativeNetRequest.Rule[] }) => {
      const { addRules } = options
      if (addRules.length > 0) {
        throw new Error('quota exceeded')
      }
      successfulAddCounts.push(addRules.length)
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await syncRules([makeSiteRule({ url: 'youtube.com' })])

    expect(mockUpdateDynamicRules.mock.calls[0][0]).toEqual({
      removeRuleIds: [99],
      addRules: [],
    })
    expect(successfulAddCounts.every((count) => count === 0)).toBe(true)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
