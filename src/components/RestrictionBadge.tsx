import {
  Clock4,
  Hash,
  Hourglass,
  MapPin,
  Pause,
  Shield,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import type { RestrictionType } from '../lib/types'

type RestrictionBadgeProps = {
  type: RestrictionType
  active: boolean
  onClick?: () => void
}

const badgeConfig: Record<
  RestrictionType,
  { icon: LucideIcon; label: string; classes: string }
> = {
  full_block: {
    icon: Shield,
    label: 'Full block',
    classes: 'bg-red-50 text-red-600',
  },
  time_of_day: {
    icon: Clock4,
    label: 'Time of day',
    classes: 'bg-amber-50 text-amber-500',
  },
  daily_count: {
    icon: Hash,
    label: 'Daily count',
    classes: 'bg-purple-50 text-purple-600',
  },
  daily_duration: {
    icon: Hourglass,
    label: 'Daily duration',
    classes: 'bg-blue-50 text-blue-600',
  },
  cooldown: {
    icon: Pause,
    label: 'Cooldown',
    classes: 'bg-gray-100 text-gray-600',
  },
  delay: {
    icon: Timer,
    label: 'Delay',
    classes: 'bg-orange-50 text-orange-600',
  },
  location: {
    icon: MapPin,
    label: 'Location',
    classes: 'bg-green-50 text-green-600',
  },
}

export function RestrictionBadge({
  type,
  active,
  onClick,
}: RestrictionBadgeProps) {
  const { icon: Icon, label, classes } = badgeConfig[type]
  const badgeClassName = [
    'flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200',
    active ? classes : 'bg-gray-100 text-gray-300',
    onClick ? 'cursor-pointer' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={label}
        className={badgeClassName}
        onClick={onClick}
      >
        <Icon className="size-4" />
      </button>
    )
  }

  return (
    <div aria-label={label} className={badgeClassName} role="img">
      <Icon className="size-4" />
    </div>
  )
}
