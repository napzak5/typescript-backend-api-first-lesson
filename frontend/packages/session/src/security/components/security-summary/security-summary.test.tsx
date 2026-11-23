import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as securitySummaryStories from './security-summary.stories'

const stories = composeStories(securitySummaryStories)

const part = (name: string) => screen.getByRole('region', { name })

describe('SecuritySummary', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say when the password was changed, in the time zone of whoever reads, and lead to the screen that changes it', async () => {
    // Act
    await stories.PasswordOnly.run()

    // Assert
    const password = part('パスワード')
    expect(within(password).getByText('2026年10月2日 18:30')).toBeVisible()
    expect(
      within(password).getByRole('link', { name: 'パスワードを変更する' }),
    ).toHaveAttribute('href', '/account/security/password')
  })

  it('should say that the password was never changed', async () => {
    // Act
    await stories.PasswordNeverChanged.run()

    // Assert
    expect(
      within(part('パスワード')).getByText(
        'アカウントを作ってから、変更していません',
      ),
    ).toBeVisible()
  })

  it.each([
    [
      stories.PasswordOnly,
      '未設定',
      'サインインのときに確かめるのは、パスワードだけです。',
    ],
    [
      stories.TwoFactorPending,
      '設定の途中',
      '設定を始めましたが、認証アプリのコードで確かめていません。',
    ],
    [
      stories.TwoFactorEnabled,
      '有効',
      'サインインのときに、パスワードに加えて、認証アプリが表示するコードを確かめます。',
    ],
  ])(
    'should say what the second factor is: %#',
    async (story, label, description) => {
      // Act
      await story.run()

      // Assert
      const twoFactor = part('2 要素認証')
      expect(within(twoFactor).getByText(label)).toBeVisible()
      expect(
        within(twoFactor).getByText(description, { exact: false }),
      ).toBeVisible()
    },
  )

  it.each([
    [stories.PasswordOnly, '2 要素認証を設定する'],
    [stories.TwoFactorPending, '設定をやり直す'],
  ])(
    'should lead a second factor that is not on to the screen that sets it up: %#',
    async (story, name) => {
      // Act
      await story.run()

      // Assert
      const twoFactor = part('2 要素認証')
      expect(within(twoFactor).getByRole('link', { name })).toHaveAttribute(
        'href',
        '/account/security/two-factor',
      )
      expect(within(twoFactor).getAllByRole('link')).toHaveLength(1)
      expect(within(twoFactor).queryByRole('button')).toBeNull()
    },
  )

  it('should offer new backup codes and the end of a second factor that is on, and lead nowhere else', async () => {
    // Arrange
    const onIssueBackupCodes = vi.fn()
    const onStopTwoFactor = vi.fn()
    await stories.TwoFactorEnabled.run({
      args: {
        ...stories.TwoFactorEnabled.args,
        onIssueBackupCodes,
        onStopTwoFactor,
      },
    })
    const twoFactor = part('2 要素認証')

    // Act
    await userEvent.click(
      within(twoFactor).getByRole('button', {
        name: 'バックアップコードを発行し直す',
      }),
    )
    await userEvent.click(
      within(twoFactor).getByRole('button', { name: '2 要素認証を無効にする' }),
    )

    // Assert
    expect(onIssueBackupCodes).toHaveBeenCalledTimes(1)
    expect(onStopTwoFactor).toHaveBeenCalledTimes(1)
    expect(within(twoFactor).queryByRole('link')).toBeNull()
  })
})

describe('SecuritySummary on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say the password and a second factor that is not set up in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.PasswordOnly.run()

    // Assert
    const password = part('Password')
    expect(within(password).getByRole('term')).toHaveTextContent('Last changed')
    expect(within(password).getByText('October 2, 2026 at 18:30')).toBeVisible()
    expect(
      within(password).getByRole('link', { name: 'Change the password' }),
    ).toBeVisible()
    const twoFactor = part('Two-factor authentication')
    expect(within(twoFactor).getByRole('term')).toHaveTextContent('Status')
    expect(within(twoFactor).getByText('Not set up')).toBeVisible()
    expect(
      within(twoFactor).getByRole('link', {
        name: 'Set up two-factor authentication',
      }),
    ).toBeVisible()
  })

  it.each([
    [stories.PasswordNeverChanged, 'Not changed since the account was created'],
    [stories.TwoFactorPending, 'Set-up not finished'],
    [stories.TwoFactorPending, 'Set up again'],
    [stories.TwoFactorEnabled, 'On'],
    [stories.TwoFactorEnabled, 'Issue new backup codes'],
    [stories.TwoFactorEnabled, 'Turn off two-factor authentication'],
  ])('should say in English: %#, "%s"', async (story, said) => {
    // Arrange
    languageStore.choose('en')

    // Act
    await story.run()

    // Assert
    expect(screen.getByText(said)).toBeVisible()
  })
})
