import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminUserAccountMessages } from './index'

const { failures, ledgers, lock, reset, unlock } = adminUserAccountMessages

const EMAIL = 'yuki.tanaka@example.com'

/** A moment as the screens of an account write it */
const MOMENT = {
  en: 'Fri, November 20, 2026 at 12:15',
  ja: '2026年11月20日（金） 12:15',
}

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminUserAccountMessages.deviceTimeZone',
    adminUserAccountMessages.deviceTimeZone('Asia/Tokyo'),
    {
      en: 'Times are shown in the time zone of this device (Asia/Tokyo).',
      ja: '日時は、この端末のタイムゾーン（Asia/Tokyo）で表示しています。',
    },
  ],
  [
    'adminUserAccountMessages.lock.lockedUntil',
    lock.lockedUntil(MOMENT),
    {
      en: 'Locked until Fri, November 20, 2026 at 12:15',
      ja: '2026年11月20日（金） 12:15までロック中',
    },
  ],
  [
    'adminUserAccountMessages.lock.lockedNote',
    lock.lockedNote(MOMENT),
    {
      en: 'After wrong passwords in a row, the account cannot sign in anew until Fri, November 20, 2026 at 12:15, not even with the right password. The devices that are signed in can still be used.',
      ja: 'パスワードを続けて誤ったため、2026年11月20日（金） 12:15まで、新しいログインができません。正しいパスワードでも同じです。ログインしている端末は、そのまま使えます。',
    },
  ],
  [
    'adminUserAccountMessages.failures.inARow',
    failures.inARow(5),
    {
      en: '5 wrong passwords in a row',
      ja: '5 回続けて誤っています',
    },
  ],
  [
    'adminUserAccountMessages.ledgers.listed',
    ledgers.listed([ledgers.customers, ledgers.staff]),
    {
      en: 'Customer ledger, Staff ledger',
      ja: 'お客様の台帳、スタッフ台帳',
    },
  ],
  [
    'adminUserAccountMessages.unlock.done',
    unlock.done(EMAIL),
    {
      en: 'Lifted the lock of yuki.tanaka@example.com. It can sign in at once with its current password.',
      ja: 'yuki.tanaka@example.com のロックを解除しました。いまのパスワードで、すぐにログインできます。',
    },
  ],
  [
    'adminUserAccountMessages.reset.question',
    reset.question(EMAIL),
    {
      en: 'Reset the two-factor authentication of yuki.tanaka@example.com?',
      ja: 'yuki.tanaka@example.com の 2 要素認証をリセットしますか？',
    },
  ],
  [
    'adminUserAccountMessages.reset.done',
    reset.done(EMAIL),
    {
      en: 'Reset the two-factor authentication of yuki.tanaka@example.com. It can sign in with the password alone. The user is told by email.',
      ja: 'yuki.tanaka@example.com の 2 要素認証をリセットしました。パスワードだけでログインできます。利用者には、メールで知らせます。',
    },
  ],
]

describe('the messages of the accounts of the users of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminUserAccountMessages }, '').made.toSorted(),
    )
  })

  it.each<[string, LocalizedText, LocalizedText]>([
    [
      'wrong password',
      failures.inARow(1),
      { en: '1 wrong password in a row', ja: '1 回続けて誤っています' },
    ],
    [
      'thousand wrong passwords',
      failures.inARow(1200),
      {
        en: '1,200 wrong passwords in a row',
        ja: '1,200 回続けて誤っています',
      },
    ],
  ])(
    'should count one %s as English and Japanese count it',
    (_what, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should name a ledger alone, as it is', () => {
    // Assert
    expect(ledgers.listed([ledgers.staff])).toEqual(ledgers.staff)
  })
})
