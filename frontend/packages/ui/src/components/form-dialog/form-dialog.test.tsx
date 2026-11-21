import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as formDialogStories from './form-dialog.stories'

const stories = composeStories(formDialogStories)

const dialog = () => screen.getByRole('dialog')
const tag = () => screen.getByRole('textbox', { name: 'タグ' })

/** The values a form handed over, under their names */
const entriesOf = (values: FormData | undefined): [string, string][] =>
  [...(values?.entries() ?? [])].map(([name, value]) => [name, String(value)])

describe('FormDialog', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should send the values of its controls with the button among its actions', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.Default.run({ args: { ...stories.Default.args, onSubmit } })
    await userEvent.type(tag(), 'VIP')

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'タグを付ける' }))

    // Assert
    expect(entriesOf(onSubmit.mock.lastCall?.[0])).toEqual([['tag', 'VIP']])
  })

  it('should be sent by the Enter key in a control', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.Default.run({ args: { ...stories.Default.args, onSubmit } })

    // Act
    await userEvent.type(tag(), '常連{Enter}')

    // Assert
    expect(entriesOf(onSubmit.mock.lastCall?.[0])).toEqual([['tag', '常連']])
  })

  it('should not be sent again while an attempt is on its way', async () => {
    // Arrange
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.Pending.run({ args: { ...stories.Pending.args, onSubmit } })

    // Act
    await userEvent.type(tag(), '常連{Enter}')

    // Assert
    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'タグを付ける' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('should give 「戻る」 first, which closes it and sends nothing', async () => {
    // Arrange
    const onClose = vi.fn<() => void>()
    const onSubmit = vi.fn<(values: FormData) => void>()
    await stories.Default.run({
      args: { ...stories.Default.args, onClose, onSubmit },
    })
    const [first] = within(dialog()).getAllByRole('button')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '戻る' }))

    // Assert
    expect(first).toHaveTextContent('戻る')
    expect(onClose).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('should say what went wrong with the attempt, and move the focus to the control it was about', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'タグを付けられませんでした。',
    )
    expect(tag()).toHaveFocus()
  })

  it('should show what the form brought in place of the form, with 「閉じる」 alone', async () => {
    // Act
    await stories.Answered.run()

    // Assert
    expect(within(dialog()).getByRole('status')).toHaveTextContent(
      'このタグは、選んだ 2 人にもう付いています。',
    )
    expect(within(dialog()).queryByRole('textbox')).toBeNull()
    expect(
      within(dialog())
        .getAllByRole('button')
        .map(({ textContent }) => textContent),
    ).toEqual(['閉じる'])
  })

  it('should move the focus to what the form brought, as it takes the place of the form', async () => {
    // Arrange
    await stories.AnsweredOnSending.run()

    // Act
    await userEvent.type(tag(), '常連{Enter}')

    // Assert
    expect(within(dialog()).getByRole('status').parentElement).toHaveFocus()
  })

  it('should close with a button of its own, not with 「戻る」 changed into it', async () => {
    // Arrange
    await stories.AnsweredOnSending.run()
    const back = screen.getByRole('button', { name: '戻る' })

    // Act
    await userEvent.type(tag(), '常連{Enter}')

    // Assert
    expect(screen.getByRole('button', { name: '閉じる' })).not.toBe(back)
    expect(back).not.toBeInTheDocument()
  })

  it('should say that it is to be closed when 「閉じる」 is pressed', async () => {
    // Arrange
    const onClose = vi.fn<() => void>()
    await stories.Answered.run({ args: { ...stories.Answered.args, onClose } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: '閉じる' }))

    // Assert
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('should say with the colour of its button that what is sent cannot be undone', async () => {
    // Act
    await stories.Dangerous.run()

    // Assert
    expect(screen.getByRole('button', { name: '取り消す' })).toHaveClass(
      'danger',
    )
    expect(dialog()).toHaveAccessibleDescription(
      '取り消した売上は、直すことも支払いを受けることもできません。',
    )
  })
})
