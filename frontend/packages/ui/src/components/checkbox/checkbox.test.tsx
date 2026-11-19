import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as checkboxStories from './checkbox.stories'

const stories = composeStories(checkboxStories)

const LABEL = 'メールでお知らせを受け取る'

describe('Checkbox', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be named by its label and start unchecked', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('checkbox', { name: LABEL })).not.toBeChecked()
  })

  it('should be checked and unchecked by pressing it, and report each change', async () => {
    // Arrange
    await stories.Default.run()
    const checkbox = screen.getByRole('checkbox', { name: LABEL })

    // Act
    await userEvent.click(checkbox)
    const checkedAfterOnePress = checkbox.matches(':checked')
    await userEvent.click(checkbox)

    // Assert
    expect(checkedAfterOnePress).toBe(true)
    expect(checkbox).not.toBeChecked()
    expect(stories.Default.args.onChange).toHaveBeenCalledTimes(2)
  })

  it('should be checked by pressing its label', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    fireEvent.click(screen.getByText(LABEL))

    // Assert
    expect(screen.getByRole('checkbox', { name: LABEL })).toBeChecked()
  })

  it('should be checked with the keyboard', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    await userEvent.tab()
    await userEvent.keyboard(' ')

    // Assert
    expect(screen.getByRole('checkbox', { name: LABEL })).toHaveFocus()
    expect(screen.getByRole('checkbox', { name: LABEL })).toBeChecked()
  })

  it('should start checked when it is given so', async () => {
    // Act
    await stories.Checked.run()

    // Assert
    expect(screen.getByRole('checkbox', { name: LABEL })).toBeChecked()
  })

  it('should show the state its caller keeps', async () => {
    // Arrange
    await stories.Default.run({
      args: { ...stories.Default.args, checked: false },
    })
    const checkbox = screen.getByRole('checkbox', { name: LABEL })

    // Act
    await userEvent.click(checkbox)

    // Assert
    expect(stories.Default.args.onChange).toHaveBeenCalledTimes(1)
    expect(checkbox).not.toBeChecked()
  })

  it('should say nothing about its choice without a description or an error', async () => {
    // Act
    await stories.Default.run()
    const checkbox = screen.getByRole('checkbox', { name: LABEL })

    // Assert
    expect(checkbox).not.toHaveAttribute('aria-describedby')
    expect(checkbox).not.toHaveAttribute('aria-invalid')
  })

  it('should be described by its description', async () => {
    // Act
    await stories.WithDescription.run()

    // Assert
    expect(
      screen.getByRole('checkbox', { name: LABEL }),
    ).toHaveAccessibleDescription(
      'キャンペーンと、次回の予約のご案内をお送りします',
    )
  })

  it('should be invalid and described by its error', async () => {
    // Act
    await stories.WithError.run()
    const checkbox = screen.getByRole('checkbox', {
      name: '利用規約に同意する',
    })

    // Assert
    expect(checkbox).toHaveAttribute('aria-invalid', 'true')
    expect(checkbox).toHaveAccessibleDescription('利用規約への同意が必要です')
  })

  it('should be required for the browser, marked for the eye, and still named by its label alone', async () => {
    // Act
    await stories.Required.run()

    // Assert
    expect(
      screen.getByRole('checkbox', { name: '利用規約に同意する' }),
    ).toBeRequired()
    expect(screen.getByText('必須')).toHaveAttribute('aria-hidden', 'true')
  })

  it('should not change while it is disabled', async () => {
    // Arrange
    await stories.Disabled.run()
    const checkbox = screen.getByRole('checkbox', { name: LABEL })

    // Act
    await userEvent.click(checkbox)

    // Assert
    expect(checkbox).toBeDisabled()
    expect(checkbox).toBeChecked()
    expect(stories.Disabled.args.onChange).not.toHaveBeenCalled()
  })

  it('should give a class of its container to the whole field, not to the checkbox', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'in-form' },
    })
    const checkbox = screen.getByRole('checkbox', { name: LABEL })

    // Assert
    expect(checkbox).toHaveClass('mark')
    expect(checkbox).not.toHaveClass('in-form')
    expect(checkbox.closest('.field')).toHaveClass('in-form')
  })
})
