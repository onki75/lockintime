import { DEFAULT_LOCK_MODE } from './defaults'
import { getSettings, saveSettings } from './storage'
import type { LockModeLevel, LockModeSettings, Settings } from './types'

export type LockModeKind = 'off' | 'password' | 'text_challenge' | 'nuclear'

export type LockStatus = {
  mode: LockModeKind
  enabled: boolean
  isNuclearActive: boolean
  requiresPassword: boolean
  requiresChallenge: boolean
  nuclearUntil: number | null
  delayUnlockUntil: number | null
}

type LockMutationOptions = {
  currentSecret?: string
  challengeText?: string
  nuclearDurationHours?: number
  now?: number
  password?: string
}

const DEFAULT_CHALLENGE_TEXT = 'LOCKINTIME'
const DELAYED_UNLOCK_MS = 24 * 60 * 60 * 1000
const PASSWORD_ITERATIONS = 310_000

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}

function fromUtf8(value: string): ArrayBuffer {
  return toArrayBuffer(new TextEncoder().encode(value))
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string): ArrayBuffer {
  return toArrayBuffer(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)))
}

function createRandomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return toBase64(bytes)
}

async function derivePasswordHash(password: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    fromUtf8(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromBase64(salt),
      iterations: PASSWORD_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )

  return toHex(bits)
}

async function persistLockMode(lockMode: LockModeSettings): Promise<void> {
  const settings = await getSettings()
  const nextSettings: Settings = {
    ...settings,
    lockMode: structuredClone(lockMode),
    updatedAt: Math.max(settings.updatedAt, lockMode.updatedAt),
  }
  await saveSettings(nextSettings)
}

function isDelayedUnlockActive(lockMode: LockModeSettings, now: number): boolean {
  return lockMode.delayUnlockUntil !== null && lockMode.delayUnlockUntil > now
}

function isNuclearActive(lockMode: LockModeSettings, now: number): boolean {
  return (
    lockMode.level === 'nuclear' &&
    lockMode.enabled &&
    lockMode.nuclearUntil !== null &&
    lockMode.nuclearUntil > now
  )
}

export function sanitizeLockModeForCloud(lockMode: LockModeSettings): LockModeSettings {
  return {
    ...lockMode,
    passwordHash: null,
    passwordSalt: null,
    challengeText: null,
  }
}

export function mergeLockModeSecrets(
  local: LockModeSettings,
  remote: LockModeSettings,
): LockModeSettings {
  const winner = local.updatedAt >= remote.updatedAt ? local : remote
  const fallback = winner === local ? remote : local

  return {
    ...winner,
    passwordHash: winner.passwordHash ?? fallback.passwordHash ?? null,
    passwordSalt: winner.passwordSalt ?? fallback.passwordSalt ?? null,
    challengeText: winner.challengeText ?? fallback.challengeText ?? null,
  }
}

export function getLockModeKind(lockMode: LockModeSettings): LockModeKind {
  if (!lockMode.enabled || lockMode.level === 'off') {
    return 'off'
  }

  if (lockMode.level === 'nuclear') {
    return 'nuclear'
  }

  if (lockMode.passwordHash) {
    return 'password'
  }

  return 'text_challenge'
}

export function getLockStatus(
  lockMode: LockModeSettings,
  now = Date.now(),
): LockStatus {
  return {
    mode: getLockModeKind(lockMode),
    enabled: lockMode.enabled,
    isNuclearActive: isNuclearActive(lockMode, now),
    requiresPassword:
      lockMode.enabled &&
      lockMode.level === 'hard' &&
      lockMode.passwordHash !== null,
    requiresChallenge:
      lockMode.enabled &&
      lockMode.level === 'soft' &&
      typeof lockMode.challengeText === 'string' &&
      lockMode.challengeText.length > 0,
    nuclearUntil: isNuclearActive(lockMode, now) ? lockMode.nuclearUntil : null,
    delayUnlockUntil: isDelayedUnlockActive(lockMode, now)
      ? lockMode.delayUnlockUntil
      : null,
  }
}

export async function getCurrentLockMode(): Promise<LockModeSettings> {
  const settings = await getSettings()
  return structuredClone(settings.lockMode)
}

async function verifyCurrentSecret(
  lockMode: LockModeSettings,
  currentSecret: string | undefined,
): Promise<boolean> {
  const secret = currentSecret?.trim()
  if (!secret) {
    return false
  }

  if (
    lockMode.level === 'hard' &&
    lockMode.passwordHash &&
    lockMode.passwordSalt
  ) {
    return (await derivePasswordHash(secret, lockMode.passwordSalt)) === lockMode.passwordHash
  }

  if (lockMode.level === 'soft' && lockMode.challengeText) {
    return secret === lockMode.challengeText.trim()
  }

  return false
}

async function assertCanMutateCurrentLock(
  currentLockMode: LockModeSettings,
  operation: 'configure' | 'request-delayed-unlock' | 'cancel-delayed-unlock',
  currentSecret: string | undefined,
  now: number,
): Promise<void> {
  if (isNuclearActive(currentLockMode, now)) {
    throw new Error('Nuclear lock is active')
  }

  if (operation !== 'cancel-delayed-unlock' && isDelayedUnlockActive(currentLockMode, now)) {
    throw new Error('Delayed unlock is active')
  }

  if (!currentLockMode.enabled || currentLockMode.level === 'off') {
    return
  }

  if (operation === 'cancel-delayed-unlock') {
    return
  }

  const status = getLockStatus(currentLockMode, now)
  if (!status.requiresPassword && !status.requiresChallenge) {
    return
  }

  if (await verifyCurrentSecret(currentLockMode, currentSecret)) {
    return
  }

  throw new Error(status.requiresPassword ? 'Current password is required' : 'Current challenge text is required')
}

async function buildLockMode(
  mode: LockModeKind,
  options: LockMutationOptions = {},
): Promise<LockModeSettings> {
  const now = options.now ?? Date.now()

  switch (mode) {
    case 'off':
      return {
        ...DEFAULT_LOCK_MODE,
        updatedAt: now,
      }
    case 'password': {
      const password = options.password?.trim()
      if (!password) {
        throw new Error('Password is required')
      }

      const passwordSalt = createRandomSalt()
      return {
        enabled: true,
        level: 'hard',
        passwordHash: await derivePasswordHash(password, passwordSalt),
        passwordSalt,
        challengeText: null,
        nuclearUntil: null,
        delayUnlockUntil: null,
        updatedAt: now,
      }
    }
    case 'text_challenge':
      return {
        enabled: true,
        level: 'soft',
        passwordHash: null,
        passwordSalt: null,
        challengeText: options.challengeText?.trim() || DEFAULT_CHALLENGE_TEXT,
        nuclearUntil: null,
        delayUnlockUntil: null,
        updatedAt: now,
      }
    case 'nuclear': {
      const durationHours = Math.max(options.nuclearDurationHours ?? 1, 1)
      return {
        enabled: true,
        level: 'nuclear',
        passwordHash: null,
        passwordSalt: null,
        challengeText: null,
        nuclearUntil: now + durationHours * 60 * 60 * 1000,
        delayUnlockUntil: null,
        updatedAt: now,
      }
    }
  }
}

export async function configureLockMode(
  mode: LockModeKind,
  options: LockMutationOptions = {},
): Promise<LockModeSettings> {
  const currentLockMode = await getCurrentLockMode()
  const now = options.now ?? Date.now()
  await assertCanMutateCurrentLock(currentLockMode, 'configure', options.currentSecret, now)

  const lockMode = await buildLockMode(mode, options)
  await persistLockMode(lockMode)
  return lockMode
}

export async function verifyLockPassword(password: string): Promise<boolean> {
  const lockMode = await getCurrentLockMode()
  return verifyCurrentSecret(lockMode, password)
}

export async function verifyLockChallenge(input: string): Promise<boolean> {
  const lockMode = await getCurrentLockMode()
  return verifyCurrentSecret(lockMode, input)
}

export async function requestDelayedUnlock(
  currentSecret?: string,
  now = Date.now(),
): Promise<LockModeSettings> {
  const lockMode = await getCurrentLockMode()
  await assertCanMutateCurrentLock(lockMode, 'request-delayed-unlock', currentSecret, now)

  if (!lockMode.enabled || lockMode.level === 'off') {
    throw new Error('Lock mode is not enabled')
  }

  const nextLockMode: LockModeSettings = {
    ...lockMode,
    delayUnlockUntil: now + DELAYED_UNLOCK_MS,
    updatedAt: now,
  }

  await persistLockMode(nextLockMode)
  return nextLockMode
}

export async function cancelDelayedUnlock(now = Date.now()): Promise<LockModeSettings> {
  const lockMode = await getCurrentLockMode()
  await assertCanMutateCurrentLock(lockMode, 'cancel-delayed-unlock', undefined, now)

  const nextLockMode: LockModeSettings = {
    ...lockMode,
    delayUnlockUntil: null,
    updatedAt: now,
  }

  await persistLockMode(nextLockMode)
  return nextLockMode
}

export function isLockActionAllowed(
  lockMode: LockModeSettings,
  now = Date.now(),
): boolean {
  const status = getLockStatus(lockMode, now)

  if (status.isNuclearActive) {
    return false
  }

  if (status.delayUnlockUntil && status.delayUnlockUntil > now) {
    return false
  }

  return !lockMode.enabled || lockMode.level === 'off'
}

export function lockLevelFromKind(kind: LockModeKind): LockModeLevel {
  switch (kind) {
    case 'off':
      return 'off'
    case 'password':
      return 'hard'
    case 'text_challenge':
      return 'soft'
    case 'nuclear':
      return 'nuclear'
  }
}
