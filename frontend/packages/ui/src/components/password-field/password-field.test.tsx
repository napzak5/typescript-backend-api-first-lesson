import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as passwordFieldStories from './password-field.stories'

const stories = composeStories(passwordFieldStories)

describe('PasswordField', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should hide what is typed, and take it', async () => {
    // Arrange
    await stories.Default.run()
    const input = screen.getByLabelText('パスワード')

    // Act
    await userEvent.type(input, 'himitsu')

    // Assert
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveValue('himitsu')
    expect(stories.Default.args.onChange).toHaveBeenCalledTimes(7)
  })

  it('should show the password when its owner asks for it, and hide it again', async () => {
    // Arrange
    await stories.Default.run()
    const input = screen.getByLabelText('パスワード')
    const show = screen.getByRole('checkbox', { name: 'パスワードを表示する' })
    await userEvent.type(input, 'himitsu')

    // Act
    await userEvent.click(show)
    const shown = input.getAttribute('type')
    await userEvent.click(show)

    // Assert
    expect(shown).toBe('text')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveValue('himitsu')
  })

  it('should be shown and hidden with the keyboard, after the password in the order of the Tab key', async () => {
    // Arrange
    await stories.Default.run()
    const input = screen.getByLabelText('パスワード')

    // Act
    await userEvent.tab()
    const first = document.activeElement
    await userEvent.tab()
    await userEvent.keyboard(' ')

    // Assert
    expect(first).toBe(input)
    expect(
      screen.getByRole('checkbox', { name: 'パスワードを表示する' }),
    ).toHaveFocus()
    expect(input).toHaveAttribute('type', 'text')
  })

  it('should name the choice to show it after its own label', async () => {
    // Act
    await stories.WithError.run()

    // Assert
    expect(
      screen.getByRole('checkbox', { name: '新しいパスワードを表示する' }),
    ).not.toBeChecked()
  })

  it('should keep a shown password from being corrected, capitalised or spell-checked', async () => {
    // Act
    await stories.Shown.run()
    const input = screen.getByRole('textbox', { name: 'パスワード' })

    // Assert
    expect(input).toHaveValue('kirei na kami de dekakeru')
    expect(input).toHaveAttribute('spellcheck', 'false')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('autocapitalize', 'none')
  })

  it('should be the one value a form sends: the choice to show it has no name', async () => {
    // Act
    await stories.Shown.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'パスワード' })).toHaveAttribute(
      'name',
      'password',
    )
    expect(
      screen.getByRole('checkbox', { name: 'パスワードを表示する' }),
    ).not.toHaveAttribute('name')
  })

  it('should pass on what an input takes', async () => {
    // Act
    await stories.WithDescription.run()
    const input = screen.getByLabelText('パスワード')

    // Assert
    expect(input).toHaveAttribute('name', 'password')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(input).toBeRequired()
    expect(input).toHaveAccessibleDescription('15 文字以上で入力してください。')
  })

  it('should be invalid and described by its description, then by its error', async () => {
    // Act
    await stories.WithError.run()
    const input = screen.getByLabelText('新しいパスワード')

    // Assert
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      '15 文字以上で入力してください。 パスワードが短すぎます。15 文字以上で入力してください。',
    )
  })

  it('should take nothing while it is disabled', async () => {
    // Act
    await stories.Disabled.run()

    // Assert
    expect(screen.getByLabelText('パスワード')).toBeDisabled()
  })
})
