import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { type ReactNode, useLayoutEffect } from 'react'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as formStories from './form.stories'

const stories = composeStories(formStories)

type WhereTheFocusIs = (focused: Element | null) => void

type InCommitProps = {
  seen: WhereTheFocusIs
  children: ReactNode
}

/**
 * Hands over where the focus is in the commit that shows what it holds: the
 * layout effect of a component runs after those of what it holds, and before
 * the browser paints.
 */
const InCommit = ({ seen, children }: InCommitProps) => {
  useLayoutEffect(() => {
    seen(document.activeElement)
  })

  return children
}

const email = () => screen.getByRole('textbox', { name: 'メールアドレス' })
const password = () => screen.getByLabelText('パスワード')
const submit = () => screen.getByRole('button', { name: '登録する' })

describe('Form', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should hand over the values of its controls, under their names, when its button is pressed', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Default.run({
      args: {
        ...stories.Default.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.type(email(), 'hanako@example.com')
    await userEvent.type(password(), 'kirei na kami de dekakeru')

    // Act
    await userEvent.click(submit())

    // Assert
    expect(received).toEqual([
      [
        ['email', 'hanako@example.com'],
        ['password', 'kirei na kami de dekakeru'],
      ],
    ])
  })

  it('should be sent by the Enter key in a control', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    await userEvent.type(email(), 'hanako@example.com{Enter}')

    // Assert
    expect(stories.Default.args.onSubmit).toHaveBeenCalledTimes(1)
  })

  it('should leave the checking of the values to its screen: the browser shows no message of its own', async () => {
    // Arrange
    await stories.Default.run()

    // Act: nothing is typed into the required controls
    await userEvent.click(submit())

    // Assert
    expect(stories.Default.args.onSubmit).toHaveBeenCalledTimes(1)
    expect(submit().closest('form')).toHaveAttribute('novalidate')
  })

  it('should say what went wrong with the attempt at once, above the controls', async () => {
    // Act
    await stories.WithMessage.run()
    const alert = screen.getByRole('alert')

    // Assert
    expect(alert).toHaveTextContent(
      '登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(
      alert.compareDocumentPosition(email()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('should say nothing about the attempt while there is nothing to say', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.queryByRole('alert')).toBeNull()
    expect(email()).not.toHaveFocus()
  })

  it('should move the focus to the first control that has an error', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(email()).toHaveFocus()
    expect(email()).toHaveAccessibleDescription(
      'メールアドレスの形式で入力してください。',
    )
  })

  it('should have moved the focus in the commit that shows the errors, before they are painted', async () => {
    // Arrange
    const seen = vi.fn<WhereTheFocusIs>()
    const WithErrors = composeStory(
      {
        ...formStories.WithErrors,
        decorators: [
          (Story) => (
            <InCommit seen={seen}>
              <Story />
            </InCommit>
          ),
        ],
      },
      formStories.default,
    )

    // Act
    await WithErrors.run()

    // Assert
    expect(seen).toHaveBeenLastCalledWith(email())
  })

  it('should move the focus to the first button of a group of radio buttons that has an error while none is chosen: the group takes no focus', async () => {
    // Act
    await stories.WithChoiceError.run()

    // Assert
    expect(screen.getByRole('radio', { name: '1 名' })).toHaveFocus()
    expect(
      screen.getByRole('radiogroup', { name: 'ご来店の人数' }),
    ).toHaveAccessibleDescription('人数を選んでください。')
  })

  it('should move the focus to the chosen button of such a group, where the Tab key would enter it', async () => {
    // Act
    await stories.WithChoiceRefused.run()

    // Assert
    expect(screen.getByRole('radio', { name: '2 名' })).toHaveFocus()
  })

  it('should move the focus past the controls that have no error', async () => {
    // Act
    await stories.WithOneError.run()

    // Assert
    expect(password()).toHaveFocus()
  })

  it('should move the focus again for the answer to another attempt, also when it says the same', async () => {
    // Arrange
    await stories.WithOneError.run()
    await userEvent.click(email())

    // Act
    await stories.WithOneError.run({
      args: {
        ...stories.WithOneError.args,
        errors: { ...stories.WithOneError.args.errors },
      },
    })

    // Assert
    expect(password()).toHaveFocus()
  })

  it('should show that an attempt is on its way, and not be sent again by a press', async () => {
    // Arrange
    await stories.Pending.run()

    // Act
    await userEvent.click(submit())

    // Assert
    expect(submit()).toHaveAttribute('aria-busy', 'true')
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should not be sent again by the Enter key while an attempt is on its way', async () => {
    // Arrange
    await stories.Pending.run()

    // Act
    await userEvent.type(email(), 'hanako@example.com{Enter}')

    // Assert
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should not be sent again by a script while an attempt is on its way', async () => {
    // Arrange
    await stories.Pending.run()
    const form = submit().closest('form')

    // Act: an extension that sends the form itself presses no button
    form?.requestSubmit()

    // Assert
    expect(form).toBeInstanceOf(HTMLFormElement)
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should show what else can be done beside its button, and not send the form with it', async () => {
    // Arrange
    await stories.WithActions.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'やめる' }))

    // Assert
    expect(stories.WithActions.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should stand its button and what else can be done in one row, which is a column on a narrow screen', async () => {
    // Act
    await stories.WithActions.run()

    // Assert
    const row = screen.getByRole('button', { name: 'やめる' }).parentElement
    expect(row).toHaveClass('row')
    expect(row).toContainElement(submit())
  })
})
