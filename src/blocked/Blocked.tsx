import { ShieldOff } from 'lucide-react'

export function Blocked() {
  const params = new URLSearchParams(window.location.search)
  const blockedUrl = params.get('url') || '不明なサイト'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-lg">
        <ShieldOff className="mx-auto w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-bold text-gray-800">
          このサイトはブロック中です
        </h1>
        <p className="text-gray-500 break-all">{blockedUrl}</p>
      </div>
    </div>
  )
}
