import { useEffect, useState } from 'react'
import { LockOpen } from 'lucide-react'
import { Button } from '../Button'

type NuclearActiveStateProps = {
  nuclearEndTime?: number
  delayUnlockEndTime?: number
  onCancelDelay?: () => void
}

function formatCountdown(targetTime: number, now: number) {
  const diff = Math.max(targetTime - now, 0)
  const totalMinutes = Math.floor(diff / 1000 / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, '0')}時間${String(minutes).padStart(2, '0')}分`
}

export function NuclearActiveState({
  nuclearEndTime,
  delayUnlockEndTime,
  onCancelDelay,
}: NuclearActiveStateProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  if (!nuclearEndTime && !delayUnlockEndTime) {
    return null
  }

  return (
    <div className="space-y-4">
      {nuclearEndTime ? (
        <div className="rounded-xl border-2 border-red-600 p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                ☢️
              </span>
              <p className="text-base font-bold text-red-600">Nuclear Option 有効中</p>
            </div>
            <p className="text-xl font-bold text-gray-900">
              解除まで: {formatCountdown(nuclearEndTime, now)}
            </p>
            <p className="text-sm leading-6 text-gray-600">
              このロックは設定した期間が終了するまで解除できません。いまは判断を先延ばしせず、環境そのものに頼る段階です。
            </p>
            <p className="text-sm italic text-gray-500">設定した自分を信じてください</p>
          </div>
        </div>
      ) : null}

      {delayUnlockEndTime ? (
        <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/80 p-2">
              <LockOpen className="size-5 text-amber-500" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-amber-900">ロック解除リクエスト中</p>
              <p className="text-sm font-semibold text-amber-500">
                {formatCountdown(delayUnlockEndTime, now)}
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 text-amber-900">
            24時間後にロックが自動解除されます。必要がなければ、いまのうちにリクエストを取り消してください。
          </p>

          <Button variant="secondary" onClick={onCancelDelay} disabled={!onCancelDelay}>
            リクエストをキャンセル
          </Button>
        </div>
      ) : null}
    </div>
  )
}
