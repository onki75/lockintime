import type { DailyStats } from './types'

export type SiteStatsSummary = {
  domain: string
  visits: number
  minutes: number
}

export type WeeklyStatsSummary = {
  totalVisits: number
  totalMinutes: number
  activeDays: number
  topSites: SiteStatsSummary[]
}

function compareDateDesc(left: string, right: string): number {
  return right.localeCompare(left)
}

export function aggregateSiteStats(
  dailyStatsHistory: Record<string, DailyStats>,
): SiteStatsSummary[] {
  const aggregated = new Map<string, SiteStatsSummary>()

  for (const dailyStats of Object.values(dailyStatsHistory)) {
    const domains = new Set([
      ...Object.keys(dailyStats.counts),
      ...Object.keys(dailyStats.durations),
    ])

    for (const domain of domains) {
      const entry = aggregated.get(domain) ?? {
        domain,
        visits: 0,
        minutes: 0,
      }

      entry.visits += dailyStats.counts[domain] ?? 0
      entry.minutes += dailyStats.durations[domain] ?? 0
      aggregated.set(domain, entry)
    }
  }

  return [...aggregated.values()].sort((left, right) => {
    if (right.minutes !== left.minutes) {
      return right.minutes - left.minutes
    }

    if (right.visits !== left.visits) {
      return right.visits - left.visits
    }

    return left.domain.localeCompare(right.domain)
  })
}

export function getWeeklyStatsSummary(
  dailyStatsHistory: Record<string, DailyStats>,
  options: {
    endDate?: string
    days?: number
    topSitesLimit?: number
  } = {},
): WeeklyStatsSummary {
  const days = options.days ?? 7
  const topSitesLimit = options.topSitesLimit ?? 5
  const sortedDates = Object.keys(dailyStatsHistory).sort(compareDateDesc)
  const endDate = options.endDate ?? sortedDates[0]

  if (!endDate) {
    return {
      totalVisits: 0,
      totalMinutes: 0,
      activeDays: 0,
      topSites: [],
    }
  }

  const end = new Date(`${endDate}T00:00:00`)
  const included: Record<string, DailyStats> = {}

  for (const [date, dailyStats] of Object.entries(dailyStatsHistory)) {
    const current = new Date(`${date}T00:00:00`)
    const diffDays = Math.floor((end.getTime() - current.getTime()) / 86_400_000)

    if (diffDays >= 0 && diffDays < days) {
      included[date] = dailyStats
    }
  }

  const allSites = aggregateSiteStats(included)
  const topSites = allSites.slice(0, topSitesLimit)

  return {
    totalVisits: allSites.reduce((total, site) => total + site.visits, 0),
    totalMinutes: allSites.reduce((total, site) => total + site.minutes, 0),
    activeDays: Object.keys(included).length,
    topSites,
  }
}
