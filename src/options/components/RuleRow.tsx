import { useState } from 'react'
import { Folder } from 'lucide-react'
import { EditTimeOfDayDialog } from '../../components/dialogs/EditTimeOfDayDialog'
import { RestrictionPopover } from '../../components/dialogs/RestrictionPopover'
import { RestrictionBadge } from '../../components/RestrictionBadge'
import type { BlockRule, DaySchedule, RestrictionType } from '../../lib/types'
import type { RuleActivationState } from '../../lib/rule-activation'
import { getBlockedDomains, updateRule } from '../../lib/storage'

type RuleRowProps = {
  rule: BlockRule
  activationState: RuleActivationState
  onClick: () => void
}

const ALL_TYPES: RestrictionType[] = [
  'full_block', 'time_of_day', 'daily_count', 'daily_duration', 'cooldown', 'delay', 'location',
]

function getStatusLabel(activationState: RuleActivationState): string | null {
  if (activationState === 'inactive_free_limit') {
    return 'Freeでは現在非適用'
  }

  if (activationState === 'inactive_pro_lock') {
    return 'Pro限定のためFreeでは非適用'
  }

  return null
}

export function RuleRow({ rule, activationState, onClick }: RuleRowProps) {
  const [activePopoverType, setActivePopoverType] =
    useState<RestrictionType | null>(null)
  const [editTimeOfDayOpen, setEditTimeOfDayOpen] = useState(false)
  const activeTypes = new Set(rule.restrictions.map((r) => r.type))
  const selectedRestriction = activePopoverType
    ? rule.restrictions.find((restriction) => restriction.type === activePopoverType) ?? null
    : null
  const selectedSchedule =
    selectedRestriction?.type === 'time_of_day'
      ? selectedRestriction.schedule
      : undefined
  const statusLabel = getStatusLabel(activationState)
  const rowClasses = [
    'w-full text-left rounded-lg px-4 py-3 transition-colors cursor-pointer',
    activationState === 'active'
      ? 'bg-white hover:bg-gray-50'
      : 'bg-white/80 hover:bg-white ring-1 ring-amber-200',
  ].join(' ')

  function handleOpenTimeOfDayEditor() {
    setActivePopoverType(null)
    setEditTimeOfDayOpen(true)
  }

  async function handleSaveSchedule(schedule: DaySchedule[]) {
    const nextRestrictions = rule.restrictions.map((r) =>
      r.type === 'time_of_day' ? { ...r, schedule } : r,
    )
    await updateRule(rule.id, { restrictions: nextRestrictions })
    setEditTimeOfDayOpen(false)
  }

  if (rule.type === 'group') {
    const domains = getBlockedDomains(rule)
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
          className={`${rowClasses} space-y-1.5`}
        >
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-gray-900">
                {rule.name} ({domains.length}サイト)
              </span>
              {statusLabel ? <span className="text-xs text-amber-700">{statusLabel}</span> : null}
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {ALL_TYPES.map((t) => {
                const isActive = activeTypes.has(t)

                return (
                  <RestrictionBadge
                    key={t}
                    type={t}
                    active={isActive}
                    onClick={isActive ? () => setActivePopoverType(t) : undefined}
                  />
                )
              })}
            </div>
          </div>
          <p className="truncate pl-8 text-xs text-gray-400">
            {domains.join(', ')}
          </p>
        </div>
        <RestrictionPopover
          open={activePopoverType !== null}
          onClose={() => setActivePopoverType(null)}
          restrictionType={activePopoverType}
          schedule={selectedSchedule}
        />
      </>
    )
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
        className={`flex w-full items-center gap-3 text-left ${rowClasses}`}
      >
        <img
          src={`https://www.google.com/s2/favicons?domain=${rule.url}&sz=16`}
          alt=""
          className="h-5 w-5 shrink-0 rounded"
        />
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-900">{rule.url}</span>
          {statusLabel ? <span className="text-xs text-amber-700">{statusLabel}</span> : null}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {ALL_TYPES.map((t) => {
            const isActive = activeTypes.has(t)

            return (
              <RestrictionBadge
                key={t}
                type={t}
                active={isActive}
                onClick={isActive ? () => setActivePopoverType(t) : undefined}
              />
            )
          })}
        </div>
      </div>
      <RestrictionPopover
        open={activePopoverType !== null}
        onClose={() => setActivePopoverType(null)}
        restrictionType={activePopoverType}
        schedule={selectedSchedule}
        onEdit={activePopoverType === 'time_of_day' ? handleOpenTimeOfDayEditor : undefined}
      />
      <EditTimeOfDayDialog
        open={editTimeOfDayOpen}
        onClose={() => setEditTimeOfDayOpen(false)}
        schedule={selectedSchedule ?? []}
        onSave={(schedule) => void handleSaveSchedule(schedule)}
      />
    </>
  )
}
