import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as accountRecordStories from './account-record.stories'

const stories = composeStories(accountRecordStories)

/** The terms of the account with what they say, in their order. */
const terms = (): [string | null, string | null][] =>
  within(screen.getByRole('region', { name: 'ログインアカウント' }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

describe('AccountRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the address, the role, the state, the two factors and the moments of an account', async () => {
    // Act
    await stories.InUse.run()

    // Assert
    expect(terms()).toEqual([
      ['メールアドレス', 'misaki.tanaka@example.com'],
      ['ロール', 'スタッフ'],
      ['状態', '有効'],
      ['2 要素認証', '設定しています'],
      ['最後のログイン', '2026年11月20日（金） 08:45'],
      ['作った日時', '2026年4月1日（水） 09:30'],
    ])
    expect(
      screen.getByRole('button', { name: '紐づけを解除する' }),
    ).toBeVisible()
  })

  it('should say that an account was never signed in with', async () => {
    // Act
    await stories.NeverSignedIn.run()

    // Assert
    expect(terms()).toEqual(
      expect.arrayContaining([
        ['ロール', 'マネージャー'],
        ['2 要素認証', '設定していません'],
        ['最後のログイン', 'まだログインしていません'],
      ]),
    )
  })

  it('should say what a lock means, and which address the member signs in with', async () => {
    // Act
    await stories.Locked.run()

    // Assert
    expect(terms()).toEqual(
      expect.arrayContaining([
        ['状態', 'ロック中'],
        ['2 要素認証', '設定の途中です'],
      ]),
    )
    expect(
      screen.getByText(/15 分の間、新しいログインができません/),
    ).toBeVisible()
    expect(
      screen.getByText(/ログインには、このメールアドレスを使います/),
    ).toHaveTextContent('台帳のメールアドレス（misaki.tanaka@example.com）')
  })

  it('should say nothing of the state or of the address of an account in use', async () => {
    // Act
    await stories.InUse.run()

    // Assert
    expect(screen.queryByText(/ログインには/)).not.toBeInTheDocument()
    expect(screen.queryByText(/ログインできません/)).not.toBeInTheDocument()
  })
})
