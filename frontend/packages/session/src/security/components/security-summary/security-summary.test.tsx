import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
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
      expect(within(twoFactor).queryByRole('button')).toBeNull()
      expect(within(twoFactor).queryByRole('link')).toBeNull()
    },
  )
})
