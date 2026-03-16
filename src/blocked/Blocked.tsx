import { ShieldOff } from 'lucide-react'

export function Blocked() {
  const params = new URLSearchParams(window.location.search)
  const blockedUrl = params.get('url') ?? '不明なサイト'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <ShieldOff className="mx-auto mb-4 size-16 text-red-400" />
        <h1 className="mb-2 text-2xl font-bold text-gray-800">
          このサイトはブロック中です
        </h1>
        <p className="mb-6 text-gray-500">{blockedUrl}</p>
        <p className="text-sm text-gray-400">
          集中モード中はアクセスできません。
          <br />
          設定を変更するにはLockInTimeのオプションを開いてください。
        </p>
      </div>
    </div>
  )
}
