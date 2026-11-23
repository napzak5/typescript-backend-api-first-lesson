import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as textFieldStories from './text-field.stories'

const stories = composeStories(textFieldStories)

describe('TextField', () => {
  itShouldBeAccessibleInEveryStory(stories)

  afterEach(() => {
    localStorage.clear()
  })

  it('should be named by its label', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'お名前' })).toBeVisible()
  })

  it('should take what is typed and report each change', async () => {
    // Arrange
    await stories.Default.run()
    const input = screen.getByRole('textbox', { name: 'お名前' })

    // Act
    await userEvent.type(input, 'Hanako')

    // Assert
    expect(input).toHaveValue('Hanako')
    expect(stories.Default.args.onChange).toHaveBeenCalledTimes(6)
  })

  it('should be reached with the Tab key', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    await userEvent.tab()

    // Assert
    expect(screen.getByRole('textbox', { name: 'お名前' })).toHaveFocus()
  })

  it('should say nothing about its value without a description or an error', async () => {
    // Act
    await stories.Default.run()
    const input = screen.getByRole('textbox', { name: 'お名前' })

    // Assert
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toBeValid()
  })

  it('should be described by its description', async () => {
    // Act
    await stories.WithDescription.run()
    const input = screen.getByRole('textbox', { name: '電話番号' })

    // Assert: said as close to the control as a note of a form is
    expect(input).toHaveAccessibleDescription('ハイフンなしで入力してください')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText('ハイフンなしで入力してください')).toHaveClass(
      'note',
      'small',
    )
  })

  it('should be invalid and described by its description, then by its error', async () => {
    // Act
    await stories.WithError.run()
    const input = screen.getByRole('textbox', { name: 'メールアドレス' })

    // Assert
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      '予約の確認をお送りします メールアドレスは、hanako@example.com のような形で入力してください',
    )
  })

  it('should be required for the browser, marked for the eye, and still named by its label alone', async () => {
    // Act
    await stories.Required.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'お名前' })).toBeRequired()
    expect(screen.getByText('必須')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByLabelText('お名前')).toBe(
      screen.getByRole('textbox', { name: 'お名前' }),
    )
  })

  it('should show no mark of a required value when it is not required', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'お名前' })).not.toBeRequired()
    expect(screen.queryByText('必須')).not.toBeInTheDocument()
  })

  it('should not take input while it is disabled', async () => {
    // Arrange
    await stories.Disabled.run()
    const input = screen.getByRole('textbox', { name: 'お名前' })

    // Act
    await userEvent.type(input, 'x')

    // Assert
    expect(input).toBeDisabled()
    expect(input).toHaveValue('山田 花子')
    expect(stories.Disabled.args.onChange).not.toHaveBeenCalled()
  })

  it('should keep its value, and stay focusable, while it is read-only', async () => {
    // Arrange
    await stories.ReadOnly.run()
    const input = screen.getByRole('textbox', { name: 'お名前' })

    // Act
    await userEvent.type(input, 'x')

    // Assert
    expect(input).toHaveFocus()
    expect(input).toHaveValue('山田 花子')
    expect(stories.ReadOnly.args.onChange).not.toHaveBeenCalled()
  })

  it('should pass the attributes of an input on to it', async () => {
    // Act
    await stories.Password.run()
    const input = screen.getByLabelText('パスワード')

    // Assert
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAttribute('name', 'password')
    expect(input).toHaveAttribute('autocomplete', 'current-password')
  })

  it('should be an input of one line of text unless a type is given', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'お名前' })).toHaveAttribute(
      'type',
      'text',
    )
  })

  it('should hold a date as the browser writes it', async () => {
    // Act
    await stories.DateInput.run()

    // Assert
    expect(screen.getByLabelText('来店日')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('来店日')).toHaveValue('2026-12-03')
  })

  it('should make the control of a short value as wide as its value, and leave the field the width of its column', async () => {
    // Act
    await stories.DateInput.run()
    const date = screen.getByLabelText('来店日')

    // Assert
    expect(date).toHaveClass('control', 'short')
    expect(date.parentElement).not.toHaveClass('short')
  })

  it('should make its control as wide as its column unless its value is short', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'お名前' })).not.toHaveClass(
      'short',
    )
  })

  it('should show the value its caller keeps', async () => {
    // Arrange
    await stories.Default.run({
      args: { ...stories.Default.args, value: '佐藤' },
    })
    const input = screen.getByRole('textbox', { name: 'お名前' })

    // Act
    await userEvent.type(input, 'x')

    // Assert
    expect(stories.Default.args.onChange).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue('佐藤')
  })

  it('should give a class of its container to the whole field, not to the input', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'in-form' },
    })
    const input = screen.getByRole('textbox', { name: 'お名前' })

    // Assert
    expect(input).toHaveClass('control')
    expect(input).not.toHaveClass('in-form')
    expect(input.parentElement).toHaveClass('field', 'in-form')
  })

  it('should keep an id its caller chooses, with its label and its messages tied to it', async () => {
    // Act
    await stories.WithError.run({
      args: { ...stories.WithError.args, id: 'contact-email' },
    })
    const input = screen.getByRole('textbox', { name: 'メールアドレス' })

    // Assert
    expect(input).toHaveAttribute('id', 'contact-email')
    expect(input).toHaveAttribute(
      'aria-describedby',
      'contact-email-description contact-email-error',
    )
  })

  it('should mark a value that is required in English on a page in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Required.run()

    // Assert
    expect(screen.getByText('Required')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByText('必須')).toBeNull()
  })
})
