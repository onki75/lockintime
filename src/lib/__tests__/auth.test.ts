import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../types'

const firebaseAuth = { currentUser: null }
const signInWithCredentialMock = vi.fn()
const signOutMock = vi.fn()
const credentialMock = vi.fn()
const onAuthStateChangedMock = vi.fn()
const getFirebaseAuthMock = vi.fn<() => typeof firebaseAuth | null>(() => firebaseAuth)

function createChromeIdentityMock(token = 'oauth-token') {
  return {
    identity: {
      getAuthToken: vi.fn(
        (
          _details: { interactive?: boolean },
          callback: (result?: string) => void,
        ) => {
          callback(token)
        },
      ),
      removeCachedAuthToken: vi.fn(
        (
          _details: { token: string },
          callback?: () => void,
        ) => {
          callback?.()
        },
      ),
    },
    runtime: {
      lastError: undefined,
    },
  }
}

async function loadAuthModule(token = 'oauth-token') {
  vi.resetModules()
  vi.unstubAllGlobals()

  vi.doMock('firebase/auth', () => ({
    GoogleAuthProvider: {
      credential: credentialMock,
    },
    onAuthStateChanged: onAuthStateChangedMock,
    signInWithCredential: signInWithCredentialMock,
    signOut: signOutMock,
  }))

  vi.doMock('../firebase', () => ({
    getFirebaseAuth: getFirebaseAuthMock,
  }))

  vi.stubGlobal('chrome', createChromeIdentityMock(token))

  return import('../auth')
}

beforeEach(() => {
  vi.clearAllMocks()
  credentialMock.mockImplementation((_idToken: string | null, accessToken: string) => ({
    accessToken,
  }))
  signInWithCredentialMock.mockResolvedValue({
    user: {
      uid: 'user-1',
      email: 'user@example.com',
      displayName: 'Example User',
      photoURL: 'https://example.com/avatar.png',
    },
  })
  signOutMock.mockResolvedValue(undefined)
  onAuthStateChangedMock.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
    callback(null)
    return vi.fn()
  })
  getFirebaseAuthMock.mockReturnValue(firebaseAuth)
})

describe('signInWithGoogle', () => {
  it('exchanges a chrome identity token for a firebase session', async () => {
    const { signInWithGoogle } = await loadAuthModule()

    await expect(signInWithGoogle()).resolves.toEqual({
      uid: 'user-1',
      email: 'user@example.com',
      displayName: 'Example User',
      photoURL: 'https://example.com/avatar.png',
    })

    expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
      { interactive: true },
      expect.any(Function),
    )
    expect(credentialMock).toHaveBeenCalledWith(null, 'oauth-token')
    expect(signInWithCredentialMock).toHaveBeenCalledWith(firebaseAuth, {
      accessToken: 'oauth-token',
    })
  })

  it('throws when firebase auth is unavailable', async () => {
    getFirebaseAuthMock.mockReturnValue(null)
    const { signInWithGoogle } = await loadAuthModule()

    await expect(signInWithGoogle()).rejects.toThrow(/firebase auth/i)
  })
})

describe('signOutFromGoogle', () => {
  it('signs out firebase and clears the cached chrome token', async () => {
    const { signOutFromGoogle } = await loadAuthModule('cached-token')

    await signOutFromGoogle()

    expect(signOutMock).toHaveBeenCalledWith(firebaseAuth)
    expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith(
      { token: 'cached-token' },
      expect.any(Function),
    )
  })
})

describe('observeAuthState', () => {
  it('maps firebase auth state into extension auth state', async () => {
    const states: Array<{ status: string; user: AuthUser | null }> = []
    onAuthStateChangedMock.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback({
        uid: 'user-2',
        email: 'signed-in@example.com',
        displayName: null,
        photoURL: null,
      })
      return vi.fn()
    })

    const { observeAuthState } = await loadAuthModule()

    observeAuthState((state) => {
      states.push({
        status: state.status,
        user: state.user,
      })
    })

    expect(states).toEqual([
      {
        status: 'authenticated',
        user: {
          uid: 'user-2',
          email: 'signed-in@example.com',
          displayName: null,
          photoURL: null,
        },
      },
    ])
  })
})
