import { useEffect, useState } from 'react'
import { getAccountSnapshot, watchAccountSnapshot, type AccountSnapshot } from '../lib/account'

export function Popup() {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null)

  useEffect(() => {
    void getAccountSnapshot().then(setSnapshot)
    return watchAccountSnapshot(setSnapshot)
  }, [])

  const syncLabel = snapshot?.syncState.status ?? 'disabled'

  return (
    <div className="w-[360px] p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">LockInTime</h1>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          ☁ {syncLabel}
        </span>
      </div>
      <p className="text-sm text-gray-600">サイトブロッカーで集中モード</p>
      {snapshot?.authState.user?.email ? (
        <p className="mt-3 text-xs text-slate-500">{snapshot.authState.user.email}</p>
      ) : null}
    </div>
  )
}
