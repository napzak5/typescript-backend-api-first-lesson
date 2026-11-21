import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as checkboxGroupStories from './checkbox-group.stories'

const stories = composeStories(checkboxGroupStories)

const LABEL = '連絡の方法'

const chosen = (): (string | null)[] =>
  screen
    .getAllByRole('checkbox', { checked: true })
    .map((box) => box.getAttribute('value'))

describe('CheckboxGroup', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a group named by its label that holds its options in order', async () => {
    // Act
    await stories.Default.run()
    const group = screen.getByRole('group', { name: LABEL })

    // Assert
    expect(
      within(group)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('value')),
    ).toEqual(['email', 'sms', 'phone'])
    expect(within(group).getByRole('checkbox', { name: 'SMS' })).toBeVisible()
  })

  it('should have nothing chosen unless values are given', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.queryByRole('checkbox', { checked: true })).toBeNull()
  })

  it('should start from the values it is given', async () => {
    // Act
    await stories.Chosen.run()

    // Assert
    expect(chosen()).toEqual(['email', 'phone'])
  })

  it('should take a choice besides those there are, and give one up', async () => {
    // Arrange
    await stories.Chosen.run()

    // Act
    await userEvent.click(screen.getByRole('checkbox', { name: 'SMS' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '電話' }))

    // Assert
    expect(chosen()).toEqual(['email', 'sms'])
  })

  it('should take a choice by pressing the label of an option', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    fireEvent.click(screen.getByText('メール'))

    // Assert
    expect(screen.getByRole('checkbox', { name: 'メール' })).toBeChecked()
  })

  it('should take a choice from the keyboard: each box is a stop of the Tab key, and Space chooses', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.keyboard(' ')

    // Assert
    expect(screen.getByRole('checkbox', { name: 'SMS' })).toHaveFocus()
    expect(chosen()).toEqual(['sms'])
  })

  it('should send every chosen value under its one name', async () => {
    // Act
    await stories.Chosen.run()

    // Assert
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box).toHaveAttribute('name', 'contactMethods')
    }
  })

  it('should say nothing about its choice without a description or an error', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('group', { name: LABEL })).not.toHaveAttribute(
      'aria-describedby',
    )
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box).not.toHaveAttribute('aria-invalid')
    }
  })

  it('should be described, as a group, by its description', async () => {
    // Act
    await stories.WithDescription.run()

    // Assert
    expect(
      screen.getByRole('group', { name: LABEL }),
    ).toHaveAccessibleDescription('いくつでも選べます')
  })

  it('should be described, as a group, by its error, and mark each of its boxes as invalid', async () => {
    // Act
    await stories.WithError.run()

    // Assert
    expect(
      screen.getByRole('group', { name: LABEL }),
    ).toHaveAccessibleDescription('選択肢から選んでください')
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box).toHaveAttribute('aria-invalid', 'true')
    }
  })

  it('should place its options one below the other unless it is asked for columns', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const options = screen
      .getByRole('checkbox', { name: 'メール' })
      .closest('label')?.parentElement
    expect(options).toHaveClass('options')
    expect(options).not.toHaveClass('columns')
  })

  it('should place many short options in columns when it is asked to', async () => {
    // Act
    await stories.InColumns.run()

    // Assert
    expect(
      screen.getByRole('checkbox', { name: 'カット' }).closest('label')
        ?.parentElement,
    ).toHaveClass('options', 'columns')
    expect(chosen()).toEqual(['cut', 'color'])
  })
})
