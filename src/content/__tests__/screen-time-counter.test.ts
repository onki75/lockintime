import { describe, expect, it } from 'vitest'
import {
  formatSessionTime,
  formatTodayTime,
} from '../screen-time-counter'

describe('formatSessionTime', () => {
  it('formats elapsed milliseconds as mm:ss', () => {
    expect(formatSessionTime(0)).toBe('0:00')
    expect(formatSessionTime(65_000)).toBe('1:05')
    expect(formatSessionTime(3_600_000)).toBe('1:00:00')
  })
})

describe('formatTodayTime', () => {
  it('formats today usage with seconds', () => {
    expect(formatTodayTime(0)).toBe('0:00')
    expect(formatTodayTime(0.5)).toBe('0:30')
    expect(formatTodayTime(23.5)).toBe('23:30')
    expect(formatTodayTime(90)).toBe('1:30:00')
  })
})
