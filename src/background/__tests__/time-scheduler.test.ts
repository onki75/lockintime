import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DaySchedule } from '@/lib/types'

vi.stubGlobal('chrome', {})

const { isWithinSchedule } = await import('../time-scheduler')

function at(localIso: string): Date {
  return new Date(localIso)
}

describe('isWithinSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when the current time falls within a same-day schedule', () => {
    const schedule: DaySchedule[] = [
      { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
    ]

    expect(isWithinSchedule(schedule, at('2026-03-16T12:00:00'))).toBe(true)
  })

  it('returns false when the current time falls outside a same-day schedule', () => {
    const schedule: DaySchedule[] = [
      { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
    ]

    expect(isWithinSchedule(schedule, at('2026-03-16T08:59:00'))).toBe(false)
    expect(isWithinSchedule(schedule, at('2026-03-16T18:00:00'))).toBe(false)
  })

  it('returns true when any one of multiple schedules matches', () => {
    const schedule: DaySchedule[] = [
      { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '12:00' },
      { days: [1, 2, 3, 4, 5], startTime: '13:00', endTime: '18:00' },
    ]

    expect(isWithinSchedule(schedule, at('2026-03-17T14:30:00'))).toBe(true)
  })

  it('returns false for an empty schedule', () => {
    expect(isWithinSchedule([], at('2026-03-16T12:00:00'))).toBe(false)
  })

  it('returns true late at night when an overnight schedule starts today', () => {
    const schedule: DaySchedule[] = [
      { days: [1], startTime: '22:00', endTime: '06:00' },
    ]

    expect(isWithinSchedule(schedule, at('2026-03-16T23:30:00'))).toBe(true)
  })

  it('returns true after midnight when covered by the previous day overnight schedule', () => {
    const schedule: DaySchedule[] = [
      { days: [6], startTime: '22:00', endTime: '06:00' },
    ]

    expect(isWithinSchedule(schedule, at('2026-03-22T01:30:00'))).toBe(true)
  })

  it('returns false after midnight when the previous day is not included in the overnight schedule', () => {
    const schedule: DaySchedule[] = [
      { days: [1], startTime: '22:00', endTime: '06:00' },
    ]

    expect(isWithinSchedule(schedule, at('2026-03-18T01:30:00'))).toBe(false)
  })

  it('handles the weekday boundary around Sunday correctly', () => {
    const schedule: DaySchedule[] = [
      { days: [0], startTime: '22:00', endTime: '02:00' },
    ]

    expect(isWithinSchedule(schedule, at('2026-03-22T23:00:00'))).toBe(true)
    expect(isWithinSchedule(schedule, at('2026-03-23T01:00:00'))).toBe(true)
    expect(isWithinSchedule(schedule, at('2026-03-23T02:00:00'))).toBe(false)
  })
})
