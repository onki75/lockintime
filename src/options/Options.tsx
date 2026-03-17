import { useEffect, useState } from 'react'
import { shouldShowOnboarding } from '../lib/onboarding'
import { Onboarding } from './Onboarding'

export function Options() {
  const [autoShowOnboarding, setAutoShowOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true

    void shouldShowOnboarding()
      .then((value) => {
        if (active) {
          setAutoShowOnboarding(value)
        }
      })
      .catch(() => {
        if (active) {
          setAutoShowOnboarding(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const searchParams = new URLSearchParams(window.location.search)
  const forceOnboarding = searchParams.get('onboarding') === 'true'

  if (autoShowOnboarding === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_42%),linear-gradient(180deg,#f8fafc_0%,#eefbf3_100%)] px-6">
        <div className="rounded-3xl border border-white/70 bg-white/90 px-6 py-5 text-sm text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          読み込み中...
        </div>
      </div>
    )
  }

  if (forceOnboarding || autoShowOnboarding) {
    return <Onboarding />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.15),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-6 py-10">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/80 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-blue-700 uppercase">
          Options
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
          設定ページ
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          設定ページ（後で実装）
        </p>
      </div>
    </div>
  )
}
