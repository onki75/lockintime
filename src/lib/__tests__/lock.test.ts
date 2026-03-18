import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCK_MODE } from '../defaults'

const getSettingsMock = vi.fn()
const saveSettingsMock = vi.fn(async () => undefined)

async function loadLockModule() {
  vi.resetModules()
  vi.unstubAllGlobals()

  vi.doMock('../storage', () => ({
    getSettings: getSettingsMock,
    saveSettings: saveSettingsMock,
  }))

  return import('../lock')
}

beforeEach(() => {
  vi.clearAllMocks()
  getSettingsMock.mockResolvedValue({
    blockRules: [],
    adultFilter: false,
    locations: [],
    streakDisplayMode: 'number',
    customQuotes: [],
    lockMode: structuredClone(DEFAULT_LOCK_MODE),
    updatedAt: 0,
  })
})

describe('configureLockMode', () => {
  it('stores a password mode with a salt and derived hash', async () => {
    const { configureLockMode, verifyLockPassword } = await loadLockModule()

    const lockMode = await configureLockMode('password', {
      password: 'secret',
      now: 100,
    })

    expect(lockMode.level).toBe('hard')
    expect(lockMode.passwordHash).not.toBe('secret')
    expect(lockMode.passwordSalt).not.toBeNull()

    getSettingsMock.mockResolvedValue({
      blockRules: [],
      adultFilter: false,
      locations: [],
      streakDisplayMode: 'number',
      customQuotes: [],
      lockMode,
      updatedAt: 100,
    })

    await expect(verifyLockPassword('secret')).resolves.toBe(true)
  })

  it('requires the current secret before changing an active password lock', async () => {
    const existing = {
      ...(await (await loadLockModule()).configureLockMode('password', {
        password: 'secret',
        now: 100,
      })),
    }
    getSettingsMock.mockResolvedValue({
      blockRules: [],
      adultFilter: false,
      locations: [],
      streakDisplayMode: 'number',
      customQuotes: [],
      lockMode: existing,
      updatedAt: 100,
    })

    const { configureLockMode } = await loadLockModule()

    await expect(configureLockMode('off', { now: 200 })).rejects.toThrow(/current password/i)
    await expect(
      configureLockMode('off', { currentSecret: 'secret', now: 200 }),
    ).resolves.toMatchObject({
      enabled: false,
      level: 'off',
    })
  })

  it('stores nuclear durations', async () => {
    const { configureLockMode } = await loadLockModule()

    const lockMode = await configureLockMode('nuclear', {
      nuclearDurationHours: 6,
      now: 100,
    })

    expect(lockMode.nuclearUntil).toBe(100 + 6 * 60 * 60 * 1000)
  })
})

describe('cloud lock sanitization', () => {
  it('removes secrets from the synced lock payload', async () => {
    const { sanitizeLockModeForCloud } = await loadLockModule()

    expect(
      sanitizeLockModeForCloud({
        ...DEFAULT_LOCK_MODE,
        enabled: true,
        level: 'hard',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        challengeText: 'secret',
      }),
    ).toMatchObject({
      passwordHash: null,
      passwordSalt: null,
      challengeText: null,
    })
  })
})

describe('getLockStatus', () => {
  it('reports nuclear locks as active before expiry', async () => {
    const { getLockStatus } = await loadLockModule()

    expect(
      getLockStatus(
        {
          ...DEFAULT_LOCK_MODE,
          enabled: true,
          level: 'nuclear',
          nuclearUntil: 1000,
        },
        500,
      ).isNuclearActive,
    ).toBe(true)
  })
})

describe('requestDelayedUnlock', () => {
  it('requires the current secret before scheduling delayed unlock', async () => {
    const { configureLockMode } = await loadLockModule()
    const existing = await configureLockMode('password', {
      password: 'secret',
      now: 100,
    })
    getSettingsMock.mockResolvedValue({
      blockRules: [],
      adultFilter: false,
      locations: [],
      streakDisplayMode: 'number',
      customQuotes: [],
      lockMode: existing,
      updatedAt: 100,
    })

    const { requestDelayedUnlock } = await loadLockModule()

    await expect(requestDelayedUnlock(undefined, 100)).rejects.toThrow(/current password/i)

    const lockMode = await requestDelayedUnlock('secret', 100)

    expect(lockMode.delayUnlockUntil).toBe(100 + 24 * 60 * 60 * 1000)
  })
})
