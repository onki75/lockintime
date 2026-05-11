import type { BlockRule, Location } from '../../lib/types'
import { SiteRuleEditor } from './SiteRuleEditor'
import { GroupRuleEditor } from './GroupRuleEditor'

type RuleDetailScreenProps = {
  rule: BlockRule
  locations: Location[]
  onBack: () => void
}

export function RuleDetailScreen({ rule, locations, onBack }: RuleDetailScreenProps) {
  if (rule.type === 'site') {
    return <SiteRuleEditor rule={rule} activationState="active" locations={locations} onBack={onBack} />
  }

  return <GroupRuleEditor rule={rule} activationState="active" locations={locations} onBack={onBack} />
}
