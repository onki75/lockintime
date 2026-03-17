import { Folder, Trash2 } from 'lucide-react'
import { Toggle } from '../../components/Toggle'
import { RestrictionBadge } from '../../components/RestrictionBadge'
import type { BlockRule, RestrictionType } from '../../lib/types'
import { getBlockedDomains } from '../../lib/storage'

type RuleRowProps = {
  rule: BlockRule
  onToggle: () => void
  onDelete: () => void
}

const ALL_TYPES: RestrictionType[] = [
  'full_block', 'time_of_day', 'daily_count', 'daily_duration', 'cooldown', 'delay', 'location',
]

export function RuleRow({ rule, onToggle, onDelete }: RuleRowProps) {
  const activeTypes = new Set(rule.restrictions.map((r) => r.type))

  if (rule.type === 'group') {
    const domains = getBlockedDomains(rule)
    return (
      <div className="space-y-1.5 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Folder className="h-5 w-5 shrink-0 text-blue-600" />
          <span className="flex-1 text-sm font-medium text-gray-900">
            {rule.name} ({domains.length}サイト)
          </span>
          <div className="flex items-center gap-1">
            {ALL_TYPES.map((t) => (
              <RestrictionBadge key={t} type={t} active={activeTypes.has(t)} />
            ))}
          </div>
          <Toggle checked={rule.enabled} onChange={onToggle} size="sm" />
          <button type="button" onClick={onDelete} className="text-gray-400 hover:text-gray-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="truncate pl-8 text-xs text-gray-400">
          {domains.join(', ')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <img
        src={`https://www.google.com/s2/favicons?domain=${rule.url}&sz=16`}
        alt=""
        className="h-5 w-5 shrink-0 rounded"
      />
      <span className="flex-1 text-sm font-medium text-gray-900">{rule.url}</span>
      <div className="flex items-center gap-1">
        {ALL_TYPES.map((t) => (
          <RestrictionBadge key={t} type={t} active={activeTypes.has(t)} />
        ))}
      </div>
      <Toggle checked={rule.enabled} onChange={onToggle} size="sm" />
      <button type="button" onClick={onDelete} className="text-gray-400 hover:text-gray-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
