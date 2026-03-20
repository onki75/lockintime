import { describe, expect, it } from 'vitest'
import { formatChange, formatMinutes } from '../format'

describe('formatMinutes', () => {
  it('formats sub-minute values as zero minutes', () => {
    expect(formatMinutes(0)).toBe('0分')
    expect(formatMinutes(0.9)).toBe('0分')
  })

  it('formats values under one hour in minutes', () => {
    expect(formatMinutes(5)).toBe('5分')
    expect(formatMinutes(59.9)).toBe('59分')
  })

  it('formats values over one hour in hours and minutes', () => {
    expect(formatMinutes(60)).toBe('1時間')
    expect(formatMinutes(61)).toBe('1時間1分')
    expect(formatMinutes(125)).toBe('2時間5分')
  })
})

describe('formatChange', () => {
  it('formats decreases as positive progress', () => {
    expect(formatChange(-22)).toEqual({
      text: '昨日より22分少ない',
      positive: true,
    })
  })

  it('formats increases as negative progress', () => {
    expect(formatChange(14.8)).toEqual({
      text: '昨日より14分多い',
      positive: false,
    })
  })

  it('formats unchanged usage', () => {
    expect(formatChange(0)).toEqual({
      text: '昨日と同じ',
      positive: true,
    })
  })
})
