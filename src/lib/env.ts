export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

type RuntimeEnv = Record<string, string | undefined>

declare global {
  var __LOCKINTIME_ENV__: RuntimeEnv | undefined
}

function readEnv(key: keyof ImportMetaEnv): string | undefined {
  return globalThis.__LOCKINTIME_ENV__?.[key] ?? import.meta.env[key]
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const config: FirebaseWebConfig = {
    apiKey: readEnv('VITE_FIREBASE_API_KEY') ?? '',
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN') ?? '',
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID') ?? '',
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET') ?? '',
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') ?? '',
    appId: readEnv('VITE_FIREBASE_APP_ID') ?? '',
  }

  return Object.values(config).every(Boolean) ? config : null
}
