import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFirebaseWebConfig } from './env'

let cachedApp: FirebaseApp | null | undefined

export function getFirebaseApp(): FirebaseApp | null {
  if (cachedApp !== undefined) {
    return cachedApp
  }

  const config = getFirebaseWebConfig()
  if (!config) {
    cachedApp = null
    return cachedApp
  }

  cachedApp = getApps().length > 0 ? getApp() : initializeApp(config)
  return cachedApp
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp()
  return app ? getAuth(app) : null
}

export function getFirebaseFirestore(): Firestore | null {
  const app = getFirebaseApp()
  return app ? getFirestore(app) : null
}
