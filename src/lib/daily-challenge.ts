import type {
  ChallengeTier,
  ChallengeType,
  DailyChallenge,
  DailyChallengeState,
  LicensePlan,
  RestrictionType,
} from './types'

type ChallengeDefinition = {
  type: ChallengeType
  description: string
  target: number
  condition?: (types: RestrictionType[]) => boolean
}

export interface ChallengeProgressStats {
  bypassCount: number
  accessFreeHours: number
  allRulesKept: boolean
  durationRatio: number
  countAccessCount: number
}

const hasRestrictionType = (types: RestrictionType[], target: RestrictionType): boolean =>
  types.includes(target)

export const CHALLENGE_POOL: Record<ChallengeTier, ChallengeDefinition[]> = {
  bronze: [
    {
      type: 'no_bypass',
      description: '今日はブロックの一時解除を1回もしない',
      target: 1,
    },
  ],
  silver: [
    {
      type: 'under_half_limit',
      description: '今日は使用時間を上限の50%以内に抑える',
      target: 50,
      condition: (types) => hasRestrictionType(types, 'daily_duration'),
    },
    {
      type: 'no_count_access',
      description: '今日は回数制限サイトにアクセスしない',
      target: 1,
      condition: (types) => hasRestrictionType(types, 'daily_count'),
    },
    {
      type: 'zero_access',
      description: '3時間アクセス試行ゼロを達成する',
      target: 3,
    },
  ],
  gold: [
    {
      type: 'all_rules_kept',
      description: '今日は全ルールを24時間守りきる',
      target: 1,
    },
  ],
}

const PLAN_TIERS: Record<LicensePlan, ChallengeTier[]> = {
  free: ['bronze'],
  pro: ['bronze', 'silver', 'gold'],
}

function selectChallengeDefinition(
  tier: ChallengeTier,
  activeRestrictionTypes: RestrictionType[],
): ChallengeDefinition {
  const challenge = CHALLENGE_POOL[tier].find(
    (candidate) => candidate.condition?.(activeRestrictionTypes) ?? true,
  )

  if (!challenge) {
    throw new Error(`No daily challenge available for tier: ${tier}`)
  }

  return challenge
}

function buildChallenge(
  date: string,
  tier: ChallengeTier,
  definition: ChallengeDefinition,
): DailyChallenge {
  return {
    id: crypto.randomUUID(),
    date,
    tier,
    type: definition.type,
    description: definition.description,
    target: definition.target,
    current: 0,
    completed: false,
    completedAt: null,
  }
}

export function generateDailyChallenges(
  date: string,
  plan: LicensePlan,
  activeRestrictionTypes: RestrictionType[],
): DailyChallenge[] {
  return PLAN_TIERS[plan].map((tier) =>
    buildChallenge(date, tier, selectChallengeDefinition(tier, activeRestrictionTypes)),
  )
}

function resolveChallengeCurrent(challenge: DailyChallenge, stats: ChallengeProgressStats): number {
  switch (challenge.type) {
    case 'no_bypass':
      return stats.bypassCount === 0 ? challenge.target : 0
    case 'zero_access':
      return Math.min(stats.accessFreeHours, challenge.target)
    case 'all_rules_kept':
      return stats.allRulesKept ? challenge.target : 0
    case 'under_half_limit':
      return stats.durationRatio <= 0.5 ? challenge.target : 0
    case 'no_count_access':
      return stats.countAccessCount === 0 ? challenge.target : 0
    default:
      return challenge.current
  }
}

export function updateChallengeProgress(
  challenges: DailyChallenge[],
  stats: ChallengeProgressStats,
  now: number,
): DailyChallenge[] {
  return challenges.map((challenge) => {
    if (challenge.completed) {
      return challenge
    }

    const current = resolveChallengeCurrent(challenge, stats)
    const completed = current >= challenge.target

    return {
      ...challenge,
      current,
      completed,
      completedAt: completed ? now : null,
    }
  })
}

export function shouldResetChallenges(state: DailyChallengeState, today: string): boolean {
  return state.lastGeneratedDate !== today
}

export function getChallengeSummary(challenges: DailyChallenge[]): {
  total: number
  completed: number
  goldCompleted: boolean
} {
  const completed = challenges.filter((challenge) => challenge.completed).length

  return {
    total: challenges.length,
    completed,
    goldCompleted: challenges.some(
      (challenge) => challenge.tier === 'gold' && challenge.completed,
    ),
  }
}
