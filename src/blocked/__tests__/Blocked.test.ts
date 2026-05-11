import { describe, expect, it } from 'vitest'
import { getBlockedCopy, parseBlockedContext } from '../Blocked'
import type { GroupRule, SiteRule } from '../../lib/types'

describe('parseBlockedContext', () => {
  it('reads adult filter and rule redirect context from the query string', () => {
    expect(parseBlockedContext('?filter=adult')).toMatchObject({
      filter: 'adult',
      ruleId: null,
      reason: null,
      until: null,
    })

    expect(parseBlockedContext('?url=youtube.com&ruleId=rule-1&reason=time_of_day&until=1760000000000')).toEqual({
      filter: null,
      ruleId: 'rule-1',
      reason: 'time_of_day',
      url: 'youtube.com',
      until: 1760000000000,
    })
  })
})

describe('getBlockedCopy', () => {
  it('prioritizes adult-filter messaging', () => {
    const copy = getBlockedCopy(
      {
        filter: 'adult',
        ruleId: 'rule-1',
        reason: 'full_block',
        url: 'example.com',
        until: null,
      },
      null,
    )

    expect(copy.title).toBe('成人向けサイトをブロックしました')
    expect(copy.description).toContain('成人向けフィルター')
  })

  it('uses site rule context when a rule is available', () => {
    const rule: SiteRule = {
      id: 'rule-1',
      type: 'site',
      url: 'youtube.com',
      restrictions: [{ type: 'full_block' }],
      createdAt: 0,
      updatedAt: 0,
    }

    const copy = getBlockedCopy(
      {
        filter: null,
        ruleId: 'rule-1',
        reason: 'full_block',
        url: 'youtube.com',
        until: null,
      },
      rule,
    )

    expect(copy.title).toBe('このサイトはブロック中です')
    expect(copy.description).toContain('youtube.com')
    expect(copy.detail).toBe('常時ブロックのルールに一致しました。')
  })

  it('uses group names for group rule context', () => {
    const rule: GroupRule = {
      id: 'group-1',
      type: 'group',
      name: 'SNS',
      urls: ['twitter.com', 'x.com'],
      restrictions: [{ type: 'full_block' }],
      preset: true,
      createdAt: 0,
      updatedAt: 0,
    }

    const copy = getBlockedCopy(
      {
        filter: null,
        ruleId: 'group-1',
        reason: 'location',
        url: 'x.com',
        until: null,
      },
      rule,
    )

    expect(copy.description).toContain('SNS')
    expect(copy.detail).toBe('現在地に基づく制限が有効です。')
  })
})
