import type { BlockRule } from '../../lib/types'
import type { RuleActivationState } from '../../lib/rule-activation'
import { SiteRuleEditor } from './SiteRuleEditor'
import { GroupRuleEditor } from './GroupRuleEditor'

type RuleDetailScreenProps = {
  rule: BlockRule
  activationState: RuleActivationState
  onBack: () => void
}

export function RuleDetailScreen({ rule, activationState, onBack }: RuleDetailScreenProps) {
  if (rule.type === 'site') {
    return <SiteRuleEditor rule={rule} activationState={activationState} onBack={onBack} />
  }

  return <GroupRuleEditor rule={rule} activationState={activationState} onBack={onBack} />
}
