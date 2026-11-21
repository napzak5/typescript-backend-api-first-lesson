import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as textAreaStories from './text-area.stories'

const stories = composeStories(textAreaStories)

describe('TextArea', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be named by its label', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'ご要望' })).toBeVisible()
  })

  it('should take several lines and report each change', async () => {
    // Arrange
    await stories.Default.run()
    const textArea = screen.getByRole('textbox', { name: 'ご要望' })

    // Act
    await userEvent.type(textArea, 'a{Enter}b')

    // Assert
    expect(textArea).toHaveValue('a\nb')
    expect(stories.Default.args.onChange).toHaveBeenCalledTimes(3)
  })

  it('should show three lines unless its caller says how many', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'ご要望' })).toHaveAttribute(
      'rows',
      '3',
    )
  })

  it('should show as many lines as its caller says', async () => {
    // Act
    await stories.Default.run({ args: { ...stories.Default.args, rows: 8 } })

    // Assert
    expect(screen.getByRole('textbox', { name: 'ご要望' })).toHaveAttribute(
      'rows',
      '8',
    )
  })

  it('should say nothing about its value without a description or an error', async () => {
    // Act
    await stories.Default.run()
    const textArea = screen.getByRole('textbox', { name: 'ご要望' })

    // Assert
    expect(textArea).not.toHaveAttribute('aria-describedby')
    expect(textArea).not.toHaveAttribute('aria-invalid')
  })

  it('should be described by its description', async () => {
    // Act
    await stories.WithDescription.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'ご要望' }),
    ).toHaveAccessibleDescription('当日のスタッフが読みます。1,000 文字まで')
  })

  it('should be invalid and described by its error', async () => {
    // Act
    await stories.WithError.run()
    const textArea = screen.getByRole('textbox', { name: 'キャンセルの理由' })

    // Assert
    expect(textArea).toHaveAttribute('aria-invalid', 'true')
    expect(textArea).toHaveAccessibleDescription(
      'キャンセルの理由を入力してください',
    )
  })

  it('should be required for the browser, marked for the eye, and still named by its label alone', async () => {
    // Act
    await stories.Required.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'キャンセルの理由' }),
    ).toBeRequired()
    expect(screen.getByText('必須')).toHaveAttribute('aria-hidden', 'true')
  })

  it('should not take input while it is disabled', async () => {
    // Arrange
    await stories.Disabled.run()
    const textArea = screen.getByRole('textbox', { name: 'ご要望' })

    // Act
    await userEvent.type(textArea, 'x')

    // Assert
    expect(textArea).toBeDisabled()
    expect(textArea).toHaveValue('前髪は短めでお願いします。')
  })

  it('should keep its value while it is read-only', async () => {
    // Arrange
    await stories.ReadOnly.run()
    const textArea = screen.getByRole('textbox', { name: 'ご要望' })

    // Act
    await userEvent.type(textArea, 'x')

    // Assert
    expect(textArea).toHaveValue('前髪は短めでお願いします。')
  })

  it('should give a class of its container to the whole field, not to the text area', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'in-form' },
    })
    const textArea = screen.getByRole('textbox', { name: 'ご要望' })

    // Assert
    expect(textArea).toHaveClass('control', 'textArea')
    expect(textArea).not.toHaveClass('in-form')
    expect(textArea.parentElement).toHaveClass('field', 'in-form')
  })
})
