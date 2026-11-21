import type {
  ModelsUserResponse,
  ModelsUserRoleType,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { aLockedUser, aUser, NOW } from './components/examples'
import {
  ADMINISTRATORS_ONLY,
  administersAccounts,
  afterTwoFactorReset,
  afterUnlocking,
  failuresNameOf,
  ledgersOf,
  lockOf,
  type Support,
  supportOf,
  userRoleNameOf,
} from './user-accounts'
import type { TwoFactorReset, Unlocking } from './user-accounts-api'

const EMAIL = 'yuki.tanaka@example.com'

const SESSION = '0f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b'

describe('administersAccounts', () => {
  it.each<[ModelsUserRoleType, boolean]>([
    ['admin', true],
    ['owner', false],
    ['manager', false],
    ['staff', false],
    ['customer', false],
  ])('should say whether %s looks after the accounts: %s', (role, expected) => {
    expect(administersAccounts(role)).toBe(expected)
  })
})

describe('userRoleNameOf', () => {
  it.each<[ModelsUserRoleType, string]>([
    ['customer', 'お客様'],
    ['staff', 'スタッフ'],
    ['manager', 'マネージャー'],
    ['owner', 'オーナー'],
    ['admin', '管理者'],
  ])('should call %s %s', (role, name) => {
    expect(userRoleNameOf(role)).toBe(name)
  })
})

describe('lockOf', () => {
  it.each<[string, ModelsUserResponse, string]>([
    ['a lock that lasts beyond now', aLockedUser(), 'locked'],
    [
      'a lock that lasts beyond now on an account of another state',
      aLockedUser({ status: 'suspended' }),
      'locked',
    ],
    [
      'a lock that ran out, of an account still locked',
      aLockedUser({ lockedUntil: '2026-11-20T02:45:00Z' }),
      'ranOut',
    ],
    [
      'a locked state without a moment',
      aLockedUser({ lockedUntil: null }),
      'ranOut',
    ],
    ['a lock that ends now', aUser({ lockedUntil: NOW.toISOString() }), 'none'],
    ['no lock', aUser(), 'none'],
  ])('should weigh %s', (_, user, type) => {
    expect(lockOf(user, NOW).type).toBe(type)
  })

  it('should give the moment a lock lasts until', () => {
    expect(lockOf(aLockedUser(), NOW)).toEqual({
      type: 'locked',
      until: '2026-11-20T03:05:00Z',
    })
  })
})

describe('failuresNameOf', () => {
  it.each<[number, string]>([
    [0, 'ありません'],
    [1, '1 回続けて誤っています'],
    [5, '5 回続けて誤っています'],
  ])('should say %i wrong passwords as %s', (failures, name) => {
    expect(failuresNameOf(failures)).toBe(name)
  })
})

describe('ledgersOf', () => {
  it.each<[string, Partial<ModelsUserResponse>, string]>([
    ['a customer', {}, 'お客様の台帳'],
    [
      'a member of the staff',
      { customerId: null, staffId: '4a2e6c8b-1d3f-4e5a-8b7c-9d0e1f2a3b51' },
      'スタッフ台帳',
    ],
    [
      'both',
      { staffId: '4a2e6c8b-1d3f-4e5a-8b7c-9d0e1f2a3b51' },
      'お客様の台帳、スタッフ台帳',
    ],
    ['none', { customerId: null }, 'どの台帳にも紐づいていません'],
  ])('should name the ledgers of %s', (_, changes, name) => {
    expect(ledgersOf(aUser(changes))).toBe(name)
  })
})

describe('supportOf', () => {
  it.each<[string, ModelsUserResponse, Support]>([
    [
      'a locked account with two factors',
      aLockedUser(),
      { type: 'some', unlock: true, reset: true },
    ],
    [
      'a lock that ran out',
      aLockedUser({
        lockedUntil: '2026-11-20T02:45:00Z',
        twoFactorStatus: 'disabled',
      }),
      { type: 'some', unlock: true, reset: false },
    ],
    [
      'two factors without a lock',
      aUser(),
      { type: 'some', unlock: false, reset: true },
    ],
    [
      'a second factor being set up',
      aUser({ twoFactorStatus: 'pending' }),
      { type: 'none' },
    ],
    ['neither', aUser({ twoFactorStatus: 'disabled' }), { type: 'none' }],
    [
      'the account of the session',
      aLockedUser({ id: SESSION }),
      { type: 'own' },
    ],
  ])('should offer for %s what the API takes', (_, user, support) => {
    expect(supportOf(user, NOW, SESSION)).toEqual(support)
  })
})

describe('afterUnlocking', () => {
  it('should show the account the API answered with, and say that it signs in at once', () => {
    // Arrange
    const user = aUser()

    // Act
    const says = afterUnlocking({ type: 'unlocked', user }, EMAIL)

    // Assert
    expect(says).toEqual({
      type: 'done',
      user,
      message:
        'yuki.tanaka@example.com のロックを解除しました。いまのパスワードで、すぐにログインできます。',
    })
  })

  it.each<[string, Unlocking, ReturnType<typeof afterUnlocking>]>([
    [
      'a lock that ran out meanwhile',
      { type: 'notLocked' },
      {
        type: 'meanwhile',
        message:
          'このアカウントのロックは、その間に解けていました。利用者がログインしたか、パスワードを再設定したか、ほかの管理者が解除しました。いまの状態を表示しています。',
      },
    ],
    ['an account deleted meanwhile', { type: 'notFound' }, { type: 'gone' }],
    [
      'a refusal',
      { type: 'forbidden' },
      { type: 'refused', message: ADMINISTRATORS_ONLY },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'again',
        message:
          'ロックを解除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what follows %s', (_, outcome, says) => {
    expect(afterUnlocking(outcome, EMAIL)).toEqual(says)
  })
})

describe('afterTwoFactorReset', () => {
  it('should show the account the API answered with, and say that the user is told by mail', () => {
    // Arrange
    const user = aUser({ twoFactorStatus: 'disabled' })

    // Act
    const says = afterTwoFactorReset({ type: 'reset', user }, EMAIL)

    // Assert
    expect(says).toEqual({
      type: 'done',
      user,
      message:
        'yuki.tanaka@example.com の 2 要素認証をリセットしました。パスワードだけでログインできます。利用者には、メールで知らせます。',
    })
  })

  it.each<[string, TwoFactorReset, ReturnType<typeof afterTwoFactorReset>]>([
    [
      'a second factor turned off meanwhile',
      { type: 'notEnabled' },
      {
        type: 'meanwhile',
        message:
          'このアカウントの 2 要素認証は、その間に有効でなくなっていました。利用者が無効にしたか、ほかの管理者がリセットしました。いまの状態を表示しています。',
      },
    ],
    ['an account deleted meanwhile', { type: 'notFound' }, { type: 'gone' }],
    [
      'a refusal',
      { type: 'forbidden' },
      { type: 'refused', message: ADMINISTRATORS_ONLY },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'again',
        message:
          '2 要素認証をリセットできませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what follows %s', (_, outcome, says) => {
    expect(afterTwoFactorReset(outcome, EMAIL)).toEqual(says)
  })
})
