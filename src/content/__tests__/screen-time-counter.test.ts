import { describe, expect, it } from 'vitest'
import {
  formatSessionTime,
  formatTodayMinutes,
} from '../screen-time-counter'

describe('formatSessionTime', () => {
  it('formats elapsed milliseconds as mm:ss', () => {
    expect(formatSessionTime(0)).toBe('0:00')
    expect(formatSessionTime(65_000)).toBe('1:05')
    expect(formatSessionTime(3_600_000)).toBe('60:00')
  })
})

describe('formatTodayMinutes', () => {
  it('formats today usage in Japanese minute and hour labels', () => {
    expect(formatTodayMinutes(0)).toBe('0分')
    expect(formatTodayMinutes(23.5)).toBe('23分')
    expect(formatTodayMinutes(90)).toBe('1時間30分')
    expect(formatTodayMinutes(60)).toBe('1時間')
  })
})
