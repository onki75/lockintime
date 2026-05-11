import type { BlockRule, Location } from '../../lib/types'
import { SiteRuleEditor } from './SiteRuleEditor'
import { GroupRuleEditor } from './GroupRuleEditor'
import {
  getRuleActivationState,
  type RulePlanState,
} from '../../lib/rule-activation'

type RuleDetailScreenProps = {
  rule: BlockRule
  plan: RulePlanState
  freeActiveRuleIds: string[]
  locations: Location[]
  onBack: () => void
}

export function RuleDetailScreen({
  rule,
  plan,
  freeActiveRuleIds,
  locations,
  onBack,
}: RuleDetailScreenProps) {
  const activationState = getRuleActivationState(rule, {
    plan,
    freeActiveRuleIds,
  })

  if (rule.type === 'site') {
    return <SiteRuleEditor rule={rule} activationState={activationState} locations={locations} onBack={onBack} />
  }

  return <GroupRuleEditor rule={rule} activationState={activationState} locations={locations} onBack={onBack} />
}
