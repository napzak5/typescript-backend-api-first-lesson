import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as authenticatorRegistrationStories from './authenticator-registration.stories'

const stories = composeStories(authenticatorRegistrationStories)

const code = () => screen.getByLabelText('認証アプリのコード')
const part = (name: string) => screen.getByRole('region', { name })

describe('AuthenticatorRegistration', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Issued, () =>
    screen.getByRole('textbox', { name: '認証アプリのコード' }),
  )

  it('should show the QR code the app reads, and the secret in groups of four for an app that cannot read it', async () => {
    // Act
    await stories.Issued.run()

    // Assert
    const registration = part('認証アプリに登録する')
    expect(
      within(registration).getByRole('img', {
        name: '認証アプリで読み取る QR コード',
      }),
    ).toBeVisible()
    expect(within(registration).getByRole('code')).toHaveTextContent(
      /^JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP$/,
    )
  })

  it('should ask for the six digits the app shows, as a phone offers the code it was sent, and say that a backup code does not do', async () => {
    // Act
    await stories.Issued.run()

    // Assert
    expect(within(part('コードを確かめる')).getByRole('textbox')).toBe(code())
    expect(code()).toHaveAttribute('inputmode', 'numeric')
    expect(code()).toHaveAttribute('autocomplete', 'one-time-code')
    expect(code()).toBeRequired()
    expect(code()).toHaveAccessibleDescription(
      '認証アプリに表示されている 6 桁の数字です。バックアップコードは使えません。',
    )
  })

  it('should hand over the code as it was typed, under the name of the request', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Issued.run({
      args: {
        ...stories.Issued.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.type(code(), '012 345')
    await userEvent.click(
      screen.getByRole('button', { name: '2 要素認証を有効にする' }),
    )

    // Assert
    expect(received).toEqual([[['code', '012 345']]])
  })

  it('should lead back to the screen of the security of the account', async () => {
    // Act
    await stories.Issued.run()

    // Assert
    expect(screen.getByRole('link', { name: 'やめる' })).toHaveAttribute(
      'href',
      '/account/security',
    )
  })

  it('should say at the code that it is wrong', async () => {
    // Act
    await stories.CodeWrong.run()

    // Assert
    expect(code()).toBeInvalid()
    expect(code()).toHaveAccessibleDescription(
      expect.stringContaining('コードが違います。'),
    )
  })
})
