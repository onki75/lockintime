import type { StreakProgress } from '../../lib/streak-milestones'

type StreakStatsCardProps = {
  streakDays: number
  longestStreak: number
  progress: StreakProgress | null
}

export function StreakStatsCard({ streakDays, longestStreak, progress }: StreakStatsCardProps) {
  const nextMilestone = progress?.nextMilestone ?? 30
  const daysUntil = progress?.daysUntilNextMilestone ?? nextMilestone - streakDays
  const progressRatio = nextMilestone > 0 ? Math.min(streakDays / nextMilestone, 1) : 0
  const progressPercent = Math.round(progressRatio * 100)

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔥</span>
        <span className="text-xl font-bold text-gray-900">{streakDays}日連続</span>
        <span className="text-sm text-gray-400">最長記録: {longestStreak}日</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">次の目標まであと{daysUntil}日</span>
          <span className="text-gray-400">{streakDays} / {nextMilestone}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
