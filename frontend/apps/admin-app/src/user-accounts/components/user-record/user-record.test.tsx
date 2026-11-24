import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as userRecordStories from './user-record.stories'

const stories = composeStories(userRecordStories)

const record = (name = 'アカウントの状態') =>
  screen.getByRole('region', { name })

/** Each term of the record with its description */
const detailsOf = (name?: string): string[][] => {
  const descriptions = within(record(name)).getAllByRole('definition')

  return within(record(name))
    .getAllByRole('term')
    .map((term, index) => [
      term.textContent ?? '',
      descriptions[index]?.textContent ?? '',
    ])
}

/** The notes under the record, in their order */
const notesOf = (name?: string): string[] =>
  within(record(name))
    .getAllByRole('paragraph')
    .map((note) => note.textContent ?? '')

const TIME_ZONE_NOTE =
  '日時は、この端末のタイムゾーン（Asia/Tokyo）で表示しています。'

describe('UserRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the account as the device tells its moments', async () => {
    // Act
    await stories.InUse.run()

    // Assert
    expect(detailsOf()).toEqual([
      ['メールアドレス', 'yuki.tanaka@example.com'],
      ['ロール', 'お客様'],
      ['状態', '有効'],
      ['メールアドレスの確認', '確認済み'],
      ['ロック', 'ロックされていません'],
      ['パスワードの誤り', 'ありません'],
      ['2 要素認証', '設定しています'],
      ['パスワードの変更', '2026年6月2日（火） 10:15'],
      ['最後のログイン', '2026年11月20日（金） 08:45'],
      ['最後のログインの IP アドレス', '203.0.113.24'],
      ['紐づいている台帳', 'お客様の台帳'],
      ['作った日時', '2026年4月1日（水） 09:30'],
    ])
    expect(notesOf()).toEqual([TIME_ZONE_NOTE])
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('should say until when a locked account cannot sign in, and why', async () => {
    // Act
    await stories.Locked.run()

    // Assert
    expect(detailsOf()).toEqual(
      expect.arrayContaining([
        ['状態', 'ロック中'],
        ['ロック', '2026年11月20日（金） 12:05までロック中'],
        ['パスワードの誤り', '5 回続けて誤っています'],
      ]),
    )
    expect(notesOf()).toEqual([
      'パスワードを続けて誤ったため、2026年11月20日（金） 12:05まで、新しいログインができません。正しいパスワードでも同じです。ログインしている端末は、そのまま使えます。',
      TIME_ZONE_NOTE,
    ])
  })

  it('should say that a lock that ran out comes back at the next wrong password', async () => {
    // Act
    await stories.LockRanOut.run()

    // Assert
    expect(detailsOf()).toEqual(
      expect.arrayContaining([
        ['状態', 'ロック中'],
        ['ロック', 'ロックの期限は過ぎています'],
      ]),
    )
    expect(notesOf()).toEqual([
      'ロックの期限は過ぎましたが、次にパスワードを一度誤ると、またロックされます。',
      TIME_ZONE_NOTE,
    ])
  })

  it('should say what an account that never signed in has not done yet', async () => {
    // Act
    await stories.NeverSignedIn.run()

    // Assert
    expect(detailsOf()).toEqual(
      expect.arrayContaining([
        ['ロール', 'スタッフ'],
        ['2 要素認証', '設定していません'],
        ['パスワードの変更', 'まだ変えていません'],
        ['最後のログイン', 'まだログインしていません'],
        ['最後のログインの IP アドレス', '記録がありません'],
        ['紐づいている台帳', 'スタッフ台帳'],
      ]),
    )
  })

  it('should say why an account whose address is not confirmed cannot sign in', async () => {
    // Act
    await stories.Unverified.run()

    // Assert
    expect(detailsOf()).toEqual(
      expect.arrayContaining([
        ['状態', 'メールアドレスの確認待ち'],
        ['メールアドレスの確認', 'まだ確認していません'],
      ]),
    )
    expect(notesOf()).toEqual([
      'メールアドレスの確認が済むまで、ログインできません。',
      TIME_ZONE_NOTE,
    ])
  })

  it('should say that an administrator is linked to no ledger', async () => {
    // Act
    await stories.Administrator.run()

    // Assert
    expect(detailsOf()).toEqual(
      expect.arrayContaining([
        ['ロール', '管理者'],
        ['紐づいている台帳', 'どの台帳にも紐づいていません'],
      ]),
    )
  })

  it('should say above the record what changed meanwhile', async () => {
    // Act
    await stories.ChangedMeanwhile.run()

    // Assert
    expect(within(record()).getByRole('status')).toHaveTextContent(
      'このアカウントのロックは、その間に解けていました。',
    )
  })
})

describe('UserRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should show the account in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.InUse.run()

    // Assert
    expect(detailsOf('State of the account')).toEqual([
      ['Email address', 'yuki.tanaka@example.com'],
      ['Role', 'Customer'],
      ['Status', 'Active'],
      ['Email address confirmation', 'Confirmed'],
      ['Lock', 'Not locked'],
      ['Wrong passwords', 'None'],
      ['Two-factor authentication', 'Set up'],
      ['Password changed', 'Tue, June 2, 2026 at 10:15'],
      ['Last sign-in', 'Fri, November 20, 2026 at 08:45'],
      ['IP address of the last sign-in', '203.0.113.24'],
      ['Linked ledgers', 'Customer ledger'],
      ['Created', 'Wed, April 1, 2026 at 09:30'],
    ])
    expect(notesOf('State of the account')).toEqual([
      'Times are shown in the time zone of this device (Asia/Tokyo).',
    ])
  })

  it('should say in English until when a locked account cannot sign in', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Locked.run()

    // Assert
    expect(detailsOf('State of the account')).toEqual(
      expect.arrayContaining([
        ['Status', 'Locked'],
        ['Lock', 'Locked until Fri, November 20, 2026 at 12:05'],
        ['Wrong passwords', '5 wrong passwords in a row'],
      ]),
    )
    expect(notesOf('State of the account')[0]).toBe(
      'After wrong passwords in a row, the account cannot sign in anew until Fri, November 20, 2026 at 12:05, not even with the right password. The devices that are signed in can still be used.',
    )
  })

  it('should say in English what an account that never signed in has not done yet', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NeverSignedIn.run()

    // Assert
    expect(detailsOf('State of the account')).toEqual(
      expect.arrayContaining([
        ['Password changed', 'Not changed yet'],
        ['Last sign-in', 'Has not signed in yet'],
        ['IP address of the last sign-in', 'Not recorded'],
        ['Linked ledgers', 'Staff ledger'],
      ]),
    )
  })

  it('should say in English above the record what changed meanwhile', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.ChangedMeanwhile.run()

    // Assert
    expect(
      within(record('State of the account')).getByRole('status'),
    ).toHaveTextContent(/^Meanwhile, the lock of this account was lifted/)
  })
})
