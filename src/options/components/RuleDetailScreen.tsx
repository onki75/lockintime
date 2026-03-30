import type { BlockRule } from '../../lib/types'
import { SiteRuleEditor } from './SiteRuleEditor'
import { GroupRuleEditor } from './GroupRuleEditor'

type RuleDetailScreenProps = {
  rule: BlockRule
  onBack: () => void
}

export function RuleDetailScreen({ rule, onBack }: RuleDetailScreenProps) {
  if (rule.type === 'site') {
    return <SiteRuleEditor rule={rule} onBack={onBack} />
  }

  return <GroupRuleEditor rule={rule} onBack={onBack} />
}
