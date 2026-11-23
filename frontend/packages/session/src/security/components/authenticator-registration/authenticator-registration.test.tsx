import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { act } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('AuthenticatorRegistration on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say how to register the app, and ask for its code, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Issued.run()

    // Assert
    expect(
      within(part('Register with the authenticator app')).getByRole('img', {
        name: 'QR code for the authenticator app',
      }),
    ).toBeVisible()
    const confirmation = part('Confirm the code')
    expect(
      within(confirmation).getByRole('textbox', {
        name: 'Code of the authenticator app',
      }),
    ).toHaveAccessibleDescription(
      'The 6 digits the authenticator app shows. A backup code cannot be used here.',
    )
    expect(
      within(confirmation).getByRole('button', {
        name: 'Turn on two-factor authentication',
      }),
    ).toBeVisible()
    expect(
      within(confirmation).getByRole('link', { name: 'Cancel' }),
    ).toBeVisible()
  })

  it('should say the errors anew when the page turns English, and leave the focus where it is', async () => {
    // Arrange
    await stories.CodeWrong.run()
    const code = screen.getByRole('textbox', { name: '認証アプリのコード' })
    code.blur()

    // Act
    act(() => {
      languageStore.choose('en')
    })

    // Assert
    expect(code).toHaveAccessibleDescription(
      expect.stringContaining(
        'The code is not correct. Enter the code the authenticator app shows now. After 5 wrong attempts in a row, you cannot sign in either for 15 minutes.',
      ),
    )
    expect(code).not.toHaveFocus()
  })
})
