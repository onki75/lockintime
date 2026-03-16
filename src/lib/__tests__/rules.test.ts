import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BlockRule } from '../storage'

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

// Import after mocking
const { syncRules } = await import('../rules')

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDynamicRules.mockResolvedValue([])
  mockUpdateDynamicRules.mockResolvedValue(undefined)
})

describe('syncRules', () => {
  it('should add rules for enabled block rules', async () => {
    const rules: BlockRule[] = [
      { id: '1', url: 'youtube.com', enabled: true },
      { id: '2', url: 'twitter.com', enabled: true },
    ]

    await syncRules(rules)

    expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [],
      addRules: [
        expect.objectContaining({
          id: 1,
          condition: expect.objectContaining({
            urlFilter: '||youtube.com',
          }),
        }),
        expect.objectContaining({
          id: 2,
          condition: expect.objectContaining({
            urlFilter: '||twitter.com',
          }),
        }),
      ],
    })
  })

  it('should skip disabled rules', async () => {
    const rules: BlockRule[] = [
      { id: '1', url: 'youtube.com', enabled: false },
      { id: '2', url: 'twitter.com', enabled: true },
    ]

    await syncRules(rules)

    const call = mockUpdateDynamicRules.mock.calls[0][0]
    expect(call.addRules).toHaveLength(1)
    expect(call.addRules[0].condition.urlFilter).toBe('||twitter.com')
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

  it('should redirect to blocked page with url param', async () => {
    const rules: BlockRule[] = [
      { id: '1', url: 'youtube.com', enabled: true },
    ]

    await syncRules(rules)

    const call = mockUpdateDynamicRules.mock.calls[0][0]
    const redirect = call.addRules[0].action.redirect.url
    expect(redirect).toContain('blocked.html')
    expect(redirect).toContain('url=youtube.com')
  })
})
