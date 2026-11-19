import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as radioGroupStories from './radio-group.stories'

const stories = composeStories(radioGroupStories)

const LABEL = 'お支払い方法'

describe('RadioGroup', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a group named by its label that holds its options in order', async () => {
    // Act
    await stories.Default.run()
    const group = screen.getByRole('radiogroup', { name: LABEL })

    // Assert
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['cash', 'creditCard', 'electronicMoney'])
    expect(within(group).getByRole('radio', { name: '現金' })).toBeVisible()
  })

  it('should have nothing chosen unless a value is given', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.queryByRole('radio', { checked: true })).toBeNull()
  })

  it('should start from the value it is given', async () => {
    // Act
    await stories.Chosen.run()

    // Assert
    expect(screen.getByRole('radio', { checked: true })).toHaveAttribute(
      'value',
      'creditCard',
    )
  })

  it('should take a choice, give up the one before, and report each change', async () => {
    // Arrange
    await stories.Chosen.run()

    // Act
    await userEvent.click(screen.getByRole('radio', { name: '電子マネー' }))

    // Assert
    expect(screen.getByRole('radio', { name: '電子マネー' })).toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'クレジットカード' }),
    ).not.toBeChecked()
    expect(stories.Chosen.args.onChange).toHaveBeenCalledTimes(1)
  })

  it('should take a choice by pressing the label of an option', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    fireEvent.click(screen.getByText('現金'))

    // Assert
    expect(screen.getByRole('radio', { name: '現金' })).toBeChecked()
  })

  it('should move the choice with the arrow keys', async () => {
    // Arrange
    await stories.Chosen.run()

    // Act
    await userEvent.tab()
    const focusedAfterTab = document.activeElement?.getAttribute('value')
    await userEvent.keyboard('{ArrowDown}')

    // Assert
    expect(focusedAfterTab).toBe('creditCard')
    expect(screen.getByRole('radio', { name: '電子マネー' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: '電子マネー' })).toBeChecked()
  })

  it('should send the choice under its name', async () => {
    // Act
    await stories.Default.run()

    // Assert
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('name', 'paymentMethod')
    }
  })

  it('should show the value its caller keeps', async () => {
    // Arrange
    await stories.Default.run({
      args: { ...stories.Default.args, value: 'cash' },
    })

    // Act
    await userEvent.click(screen.getByRole('radio', { name: '電子マネー' }))

    // Assert
    expect(stories.Default.args.onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('radio', { name: '現金' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '電子マネー' })).not.toBeChecked()
  })

  it('should say nothing about its choice without a description or an error', async () => {
    // Act
    await stories.Default.run()
    const group = screen.getByRole('radiogroup', { name: LABEL })

    // Assert
    expect(group).not.toHaveAttribute('aria-describedby')
    expect(group).not.toHaveAttribute('aria-invalid')
    expect(group).not.toHaveAttribute('aria-required')
  })

  it('should be described, as a group, by its description', async () => {
    // Act
    await stories.WithDescription.run()

    // Assert
    expect(
      screen.getByRole('radiogroup', { name: LABEL }),
    ).toHaveAccessibleDescription('お会計のときに変更できます')
  })

  it('should be invalid, as a group, and described by its error', async () => {
    // Act
    await stories.WithError.run()
    const group = screen.getByRole('radiogroup', { name: LABEL })

    // Assert
    expect(group).toHaveAttribute('aria-invalid', 'true')
    expect(group).toHaveAccessibleDescription('お支払い方法を選択してください')
  })

  it('should be required for the browser, for assistive technology and for the eye', async () => {
    // Act
    await stories.Required.run()

    // Assert
    expect(screen.getByRole('radiogroup', { name: LABEL })).toHaveAttribute(
      'aria-required',
      'true',
    )
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeRequired()
    }
    expect(screen.getByText('必須')).toHaveAttribute('aria-hidden', 'true')
  })

  it('should not let an unavailable option be chosen', async () => {
    // Arrange
    await stories.WithUnavailableOption.run()
    const unavailable = screen.getByRole('radio', {
      name: '電子マネー（この店舗では使えません）',
    })

    // Act
    await userEvent.click(unavailable)

    // Assert
    expect(unavailable).toBeDisabled()
    expect(unavailable).not.toBeChecked()
    expect(screen.getByRole('radio', { name: '現金' })).toBeEnabled()
  })

  it('should not take a choice while it is disabled', async () => {
    // Arrange
    await stories.Disabled.run()

    // Act
    await userEvent.click(screen.getByRole('radio', { name: '電子マネー' }))

    // Assert
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
    expect(screen.getByRole('radio', { name: '現金' })).toBeChecked()
    expect(stories.Disabled.args.onChange).not.toHaveBeenCalled()
  })

  it('should place its options one below the other unless it is asked for columns', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const options = screen
      .getByRole('radio', { name: '現金' })
      .closest('label')?.parentElement
    expect(options).toHaveClass('options')
    expect(options).not.toHaveClass('columns')
  })

  it('should place many short options in columns, all of them in sight and in their order', async () => {
    // Act
    await stories.InColumns.run()
    const group = screen.getByRole('radiogroup', { name: '開始時刻' })

    // Assert
    expect(
      within(group).getByRole('radio', { name: '10:00' }).closest('label')
        ?.parentElement,
    ).toHaveClass('options', 'columns')
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(stories.InColumns.args.options?.map((option) => option.value))
    expect(within(group).getAllByRole('radio')).toHaveLength(14)
  })

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'in-form' },
    })

    // Assert
    expect(screen.getByRole('radiogroup', { name: LABEL })).toHaveClass(
      'field',
      'in-form',
    )
  })
})
