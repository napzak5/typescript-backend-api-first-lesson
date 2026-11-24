import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as twoFactorResetStories from './two-factor-reset.stories'

const stories = composeStories(twoFactorResetStories)

const part = (name = '2 要素認証のリセット') =>
  screen.getByRole('region', { name })

describe('TwoFactorReset', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say whom a reset is for, and open the dialog when its button is pressed', async () => {
    // Arrange
    const onAsk = vi.fn()
    await stories.Offered.run({ args: { ...stories.Offered.args, onAsk } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '2 要素認証をリセットする' }),
    )

    // Assert
    expect(part()).toHaveTextContent(
      '認証アプリとバックアップコードの両方をなくした利用者のための操作です。リセットすると、利用者は、パスワードだけでログインし、2 要素認証を設定し直します。',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onAsk).toHaveBeenCalledOnce()
  })

  it('should ask, naming the account, that the user be made sure of first', async () => {
    // Arrange
    const onReset = vi.fn()
    const onClose = vi.fn()
    await stories.Asking.run({
      args: { ...stories.Asking.args, onReset, onClose },
    })
    const dialog = screen.getByRole('dialog', {
      name: 'yuki.tanaka@example.com の 2 要素認証をリセットしますか？',
    })
    expect(dialog).toHaveAccessibleDescription(
      '依頼した人が、このアカウントの利用者本人であることを、サポートの手続きで確かめてから行ってください。システムは確かめません。リセットすると、認証アプリのコードもバックアップコードも使えなくなります。利用者には、メールで知らせます。ログインしている端末は、そのまま使えます。',
    )

    // Act
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'リセットする' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    expect(onReset).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('should say in the dialog what went wrong with the last attempt', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('alert'),
    ).toHaveTextContent('2 要素認証をリセットできませんでした。')
  })

  it('should say why the account resets nothing', async () => {
    // Act
    await stories.Forbidden.run()

    // Assert
    expect(within(part()).getByRole('alert')).toHaveTextContent(
      'このアカウントでは、ログインアカウントを扱えません。',
    )
  })
})

describe('TwoFactorReset on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say whom a reset is for, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Offered.run()

    // Assert
    expect(part('Resetting two-factor authentication')).toHaveTextContent(
      'This is for a user who lost both the authenticator app and the backup codes. Once it is reset, the user signs in with the password alone and sets up two-factor authentication again.',
    )
    expect(
      screen.getByRole('button', { name: 'Reset two-factor authentication' }),
    ).toBeVisible()
  })

  it('should ask in English, naming the account, that the user be made sure of first', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Asking.run()

    // Assert
    const dialog = screen.getByRole('dialog', {
      name: 'Reset the two-factor authentication of yuki.tanaka@example.com?',
    })
    expect(dialog).toHaveAccessibleDescription(
      /^Before you reset it, make sure through the support procedure/,
    )
    expect(within(dialog).getByRole('button', { name: 'Reset' })).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeVisible()
  })

  it('should say in English why the account resets nothing', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Forbidden.run()

    // Assert
    expect(
      within(part('Resetting two-factor authentication')).getByRole('alert'),
    ).toHaveTextContent(/^This account cannot handle sign-in accounts\./)
  })
})
