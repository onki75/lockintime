import { Lock, Crown } from 'lucide-react'
import { Button } from '../../components/Button'

type ProLockedTabProps = {
  title: string
  description: string
}

export function ProLockedTab({ title, description }: ProLockedTabProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Lock className="h-7 w-7 text-gray-400" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500">{description}</p>
      <Button variant="primary" className="mt-6">
        <Crown className="mr-1.5 h-4 w-4" /> Proにアップグレード
      </Button>
    </div>
  )
}
