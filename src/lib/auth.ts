import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth } from './firebase'
import type { AuthState, AuthUser } from './types'

function getConfiguredAuth() {
  const auth = getFirebaseAuth()
  if (!auth) {
    throw new Error('Firebase Auth is not configured')
  }

  return auth
}

function readChromeRuntimeError(): Error | null {
  const message = chrome.runtime.lastError?.message
  return message ? new Error(message) : null
}

function extractAccessToken(result: unknown): string | null {
  if (typeof result === 'string') {
    return result
  }

  if (
    result &&
    typeof result === 'object' &&
    'token' in result &&
    typeof result.token === 'string'
  ) {
    return result.token
  }

  return null
}

function getChromeAuthToken(interactive: boolean): Promise<string | null> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      const runtimeError = readChromeRuntimeError()
      if (runtimeError) {
        reject(runtimeError)
        return
      }

      resolve(extractAccessToken(token))
    })
  })
}

function removeCachedAuthToken(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      const runtimeError = readChromeRuntimeError()
      if (runtimeError) {
        reject(runtimeError)
        return
      }

      resolve()
    })
  })
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName,
    photoURL: user.photoURL,
  }
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const auth = getConfiguredAuth()
  const accessToken = await getChromeAuthToken(true)

  if (!accessToken) {
    throw new Error('Google auth token was not returned')
  }

  const credential = GoogleAuthProvider.credential(null, accessToken)
  const result = await signInWithCredential(auth, credential)
  return toAuthUser(result.user)
}

export async function signOutFromGoogle(): Promise<void> {
  const auth = getConfiguredAuth()
  const cachedToken = await getChromeAuthToken(false).catch(() => null)

  await signOut(auth)

  if (cachedToken) {
    await removeCachedAuthToken(cachedToken).catch(() => undefined)
  }
}

export function observeAuthState(
  callback: (state: AuthState) => void,
): () => void {
  const auth = getConfiguredAuth()

  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      callback({
        status: 'anonymous',
        user: null,
        lastError: null,
      })
      return
    }

    callback({
      status: 'authenticated',
      user: toAuthUser(user),
      lastError: null,
    })
  })
}

export function getCurrentAuthUser(): AuthUser | null {
  const auth = getConfiguredAuth()
  return auth.currentUser ? toAuthUser(auth.currentUser) : null
}
