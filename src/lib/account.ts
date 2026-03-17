import {
  DEFAULT_AUTH_STATE,
  DEFAULT_LICENSE_CACHE,
  DEFAULT_SYNC_STATE,
} from './defaults'
import type { AuthState, LicenseCache, SyncState } from './types'

export type AccountSnapshot = {
  authState: AuthState
  syncState: SyncState
  licenseCache: LicenseCache
}

type RuntimeResponse<T> =
  | ({ ok: true } & T)
  | { ok: false; error?: string; status?: string }

function withDefaultAuthState(value: unknown): AuthState {
  return (value as AuthState | undefined) ?? structuredClone(DEFAULT_AUTH_STATE)
}

function withDefaultSyncState(value: unknown): SyncState {
  return (value as SyncState | undefined) ?? structuredClone(DEFAULT_SYNC_STATE)
}

function withDefaultLicenseCache(value: unknown): LicenseCache {
  return (value as LicenseCache | undefined) ?? structuredClone(DEFAULT_LICENSE_CACHE)
}

function sendRuntimeMessage<T>(message: unknown): Promise<RuntimeResponse<T>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError?.message
      if (error) {
        reject(new Error(error))
        return
      }

      resolve((response ?? { ok: false, error: 'No response' }) as RuntimeResponse<T>)
    })
  })
}

export async function getAccountSnapshot(): Promise<AccountSnapshot> {
  const result = (await chrome.storage.local.get([
    'authState',
    'syncState',
    'licenseCache',
  ])) as Partial<AccountSnapshot>

  return {
    authState: withDefaultAuthState(result.authState),
    syncState: withDefaultSyncState(result.syncState),
    licenseCache: withDefaultLicenseCache(result.licenseCache),
  }
}

export function watchAccountSnapshot(
  callback: (snapshot: AccountSnapshot) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== 'local') {
      return
    }

    if (!changes.authState && !changes.syncState && !changes.licenseCache) {
      return
    }

    void getAccountSnapshot().then(callback)
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

export async function signInToAccount(): Promise<AuthState['user']> {
  const response = await sendRuntimeMessage<{ user: AuthState['user'] }>({
    type: 'auth:sign-in',
  })

  if (!response.ok) {
    throw new Error(response.error ?? 'Sign-in failed')
  }

  return response.user
}

export async function signOutFromAccount(): Promise<void> {
  const response = await sendRuntimeMessage<{}>({
    type: 'auth:sign-out',
  })

  if (!response.ok) {
    throw new Error(response.error ?? 'Sign-out failed')
  }
}

export async function forceCloudSync(): Promise<void> {
  const response = await sendRuntimeMessage<{}>({
    type: 'sync:force',
  })

  if (!response.ok) {
    throw new Error(response.error ?? response.status ?? 'Sync failed')
  }
}
