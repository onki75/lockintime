import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadAccountModule(storageState: Record<string, unknown> = {}) {
  vi.resetModules()
  vi.unstubAllGlobals()

  const state = structuredClone(storageState)
  const onChanged = {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }

  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (keys: string[]) => {
          const result: Record<string, unknown> = {}
          for (const key of keys) {
            result[key] = state[key]
          }
          return result
        }),
      },
      onChanged,
    },
    runtime: {
      lastError: undefined,
      sendMessage: vi.fn((message: unknown, callback: (value: unknown) => void) => {
        if ((message as { type?: string }).type === 'auth:sign-in') {
          callback({
            ok: true,
            user: {
              uid: 'user-1',
              email: 'user@example.com',
              displayName: null,
              photoURL: null,
            },
          })
          return
        }

        callback({ ok: true })
      }),
    },
  })

  return import('../account')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAccountSnapshot', () => {
  it('returns default auth and sync state when nothing is stored yet', async () => {
    const { getAccountSnapshot } = await loadAccountModule()

    await expect(getAccountSnapshot()).resolves.toEqual({
      authState: {
        status: 'anonymous',
        user: null,
        lastError: null,
      },
      syncState: {
        status: 'disabled',
        lastSyncedAt: null,
        lastError: null,
        pendingPush: false,
        isApplyingRemote: false,
      },
      licenseCache: {
        plan: 'free',
        lastVerified: null,
        source: 'default',
        expiresAt: null, email: null,
      },
    })
  })
})

describe('signInToAccount', () => {
  it('forwards the runtime auth sign-in message and returns the user payload', async () => {
    const { signInToAccount } = await loadAccountModule()

    await expect(signInToAccount()).resolves.toEqual({
      uid: 'user-1',
      email: 'user@example.com',
      displayName: null,
      photoURL: null,
    })
  })
})
