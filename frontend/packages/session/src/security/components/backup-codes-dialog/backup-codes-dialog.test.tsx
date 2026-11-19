import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { twoFactorSetup } from '../examples'
import * as backupCodesDialogStories from './backup-codes-dialog.stories'

const stories = composeStories(backupCodesDialogStories)

const TITLE = 'バックアップコードを発行し直す'
const ISSUED =
  '新しいバックアップコードです。それまでのバックアップコードは、使えなくなりました。それぞれ 1 回だけ、認証アプリのコードの代わりに使えます。このダイアログを閉じると、二度と表示されません。印刷するか、パスワードマネージャーなどの安全な場所に控えてください。発行し直したことを、メールでお知らせしました。'

const dialog = () => screen.getByRole('dialog', { name: TITLE })
const code = () =>
  within(dialog()).getByLabelText('認証アプリのコードかバックアップコード')

describe('BackupCodesDialog', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say that the codes of before stop working, and ask for a code of the app or a backup code', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(dialog()).toHaveAccessibleDescription(
      '新しいバックアップコードを 10 個発行します。いまのバックアップコードは、使えなくなります。',
    )
    expect(code()).toHaveAttribute('autocomplete', 'one-time-code')
    expect(code()).not.toHaveAttribute('inputmode')
    expect(code()).toBeRequired()
    expect(
      within(dialog())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['戻る', '発行し直す'])
  })

  it('should hand over the code as it was typed, under the name of the request', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Asking.run({
      args: {
        ...stories.Asking.args,
        onIssue: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.type(code(), 'K7M2-PZQX-4HDA-WN3E')
    await userEvent.keyboard('{Enter}')

    // Assert
    expect(received).toEqual([[['code', 'K7M2-PZQX-4HDA-WN3E']]])
  })

  it('should send nothing again while the code is on its way', async () => {
    // Arrange
    await stories.Sending.run()
    await userEvent.type(code(), '012345')

    // Act: the button, and the form as Enter in the control sends it
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '発行し直す' }),
    )
    fireEvent.submit(code())

    // Assert
    expect(
      within(dialog()).getByRole('button', { name: '発行し直す' }),
    ).toHaveAttribute('aria-busy', 'true')
    expect(stories.Sending.args.onIssue).not.toHaveBeenCalled()
  })

  it('should say at the code that the API did not take it', async () => {
    // Act
    await stories.CodeWrong.run()

    // Assert
    expect(code()).toBeInvalid()
    expect(code()).toHaveAccessibleDescription(
      expect.stringContaining(
        'コードが違うか、使ったことのあるバックアップコードです。',
      ),
    )
  })

  it('should show the new codes in the place of the form, with what to do with them, and a button that closes', async () => {
    // Act
    await stories.Issued.run()

    // Assert
    expect(within(dialog()).queryByRole('textbox')).toBeNull()
    expect(within(dialog()).getByText(ISSUED)).toBeVisible()
    expect(
      within(dialog())
        .getAllByRole('code')
        .map((issued) => issued.textContent),
    ).toEqual(twoFactorSetup.backupCodes)
    expect(
      within(dialog())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['閉じる'])
  })

  it('should move the focus to what is said of the new codes, as they take the place of the form', async () => {
    // Arrange
    await stories.IssuedByCode.run()

    // Act
    await userEvent.type(code(), '012345{Enter}')

    // Assert
    expect(within(dialog()).getByText(ISSUED)).toHaveFocus()
  })

  it('should close when it is closed after the codes are shown', async () => {
    // Arrange
    await stories.Issued.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '閉じる' }),
    )

    // Assert
    expect(stories.Issued.args.onClose).toHaveBeenCalled()
  })
})
