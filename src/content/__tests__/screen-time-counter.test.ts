import { describe, expect, it } from 'vitest'
import {
  clampCounterPosition,
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

describe('clampCounterPosition', () => {
  it('keeps the counter inside the viewport', () => {
    expect(clampCounterPosition(-10, -20, 100, 60, 320, 240)).toEqual({
      left: 0,
      top: 0,
    })
    expect(clampCounterPosition(300, 220, 100, 60, 320, 240)).toEqual({
      left: 220,
      top: 180,
    })
    expect(clampCounterPosition(80, 70, 100, 60, 320, 240)).toEqual({
      left: 80,
      top: 70,
    })
  })
})
