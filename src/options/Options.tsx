import { useEffect, useState } from 'react'
import {
  forceCloudSync,
  getAccountSnapshot,
  signInToAccount,
  signOutFromAccount,
  watchAccountSnapshot,
  type AccountSnapshot,
} from '../lib/account'

function formatTimestamp(value: number | null): string {
  if (value === null) {
    return '未同期'
  }

  return new Date(value).toLocaleString('ja-JP')
}

export function Options() {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getAccountSnapshot().then(setSnapshot)
    return watchAccountSnapshot(setSnapshot)
  }, [])

  async function handleSignIn() {
    setError(null)
    try {
      await signInToAccount()
      setSnapshot(await getAccountSnapshot())
    } catch (nextError) {
      setError((nextError as Error).message)
    }
  }

  async function handleSignOut() {
    setError(null)
    try {
      await signOutFromAccount()
      setSnapshot(await getAccountSnapshot())
    } catch (nextError) {
      setError((nextError as Error).message)
    }
  }

  async function handleForceSync() {
    setError(null)
    try {
      await forceCloudSync()
      setSnapshot(await getAccountSnapshot())
    } catch (nextError) {
      setError((nextError as Error).message)
    }
  }

  const accountEmail = snapshot?.authState.user?.email

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-bold">LockInTime 設定</h1>
      <p className="text-sm text-gray-600">ブロックリストやスケジュールを管理します。</p>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">アカウント</h2>
        {accountEmail ? (
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>ログイン中: {accountEmail}</p>
            <p>プラン: {snapshot?.licenseCache.plan ?? 'free'}</p>
            <p>同期状態: {snapshot?.syncState.status ?? 'disabled'}</p>
            <p>最終同期: {formatTimestamp(snapshot?.syncState.lastSyncedAt ?? null)}</p>
            <div className="flex gap-3">
              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-white"
                onClick={() => {
                  void handleForceSync()
                }}
              >
                今すぐ同期
              </button>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700"
                onClick={() => {
                  void handleSignOut()
                }}
              >
                ログアウト
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>複数デバイスで設定とストリークを同期するにはログインしてください。</p>
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-white"
              onClick={() => {
                void handleSignIn()
              }}
            >
              Googleアカウントでログイン
            </button>
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    </div>
  )
}
