import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as selectStories from './select.stories'

const stories = composeStories(selectStories)

describe('Select', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be named by its label and offer its options in order', async () => {
    // Act
    await stories.Default.run()
    const select = screen.getByRole('combobox', { name: '担当スタッフ' })

    // Assert
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['選択してください', '佐藤 美咲', '鈴木 健', '高橋 彩'])
  })

  it('should have nothing chosen while its placeholder is shown', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('combobox', { name: '担当スタッフ' })).toHaveValue(
      '',
    )
  })

  it('should offer only its options when it has no placeholder', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, placeholder: undefined },
    })
    const select = screen.getByRole('combobox', { name: '担当スタッフ' })

    // Assert
    expect(within(select).getAllByRole('option')).toHaveLength(3)
    expect(select).toHaveValue('sato')
  })

  it('should take a choice and report the change', async () => {
    // Arrange
    await stories.Default.run()
    const select = screen.getByRole('combobox', { name: '担当スタッフ' })

    // Act
    await userEvent.selectOptions(select, '高橋 彩')

    // Assert
    expect(select).toHaveValue('takahashi')
    expect(stories.Default.args.onChange).toHaveBeenCalledTimes(1)
  })

  it('should start from the value it is given', async () => {
    // Act
    await stories.Chosen.run()

    // Assert
    expect(screen.getByRole('combobox', { name: '担当スタッフ' })).toHaveValue(
      'suzuki',
    )
  })

  it('should be reached with the Tab key', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    await userEvent.tab()

    // Assert
    expect(screen.getByRole('combobox', { name: '担当スタッフ' })).toHaveFocus()
  })

  it('should be described by its description', async () => {
    // Act
    await stories.WithDescription.run()

    // Assert
    expect(
      screen.getByRole('combobox', { name: '担当スタッフ' }),
    ).toHaveAccessibleDescription('指名料はかかりません')
  })

  it('should be invalid and described by its error', async () => {
    // Act
    await stories.WithError.run()
    const select = screen.getByRole('combobox', { name: '担当スタッフ' })

    // Assert
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription('担当スタッフを選択してください')
  })

  it('should not be valid for the browser until something is chosen, when it is required', async () => {
    // Arrange
    await stories.Required.run()
    const select = screen.getByRole('combobox', { name: '担当スタッフ' })
    const validBefore = select.matches(':valid')

    // Act
    await userEvent.selectOptions(select, '佐藤 美咲')

    // Assert
    expect(select).toBeRequired()
    expect(validBefore).toBe(false)
    expect(select.matches(':valid')).toBe(true)
    expect(screen.getByText('必須')).toHaveAttribute('aria-hidden', 'true')
  })

  it('should not take a choice while it is disabled', async () => {
    // Arrange
    await stories.Disabled.run()
    const select = screen.getByRole('combobox', { name: '担当スタッフ' })

    // Act
    await userEvent.selectOptions(select, '高橋 彩')

    // Assert
    expect(select).toBeDisabled()
    expect(select).toHaveValue('sato')
    expect(stories.Disabled.args.onChange).not.toHaveBeenCalled()
  })

  it('should give a class of its container to the whole field, not to the select', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'in-form' },
    })
    const select = screen.getByRole('combobox', { name: '担当スタッフ' })

    // Assert
    expect(select).toHaveClass('control')
    expect(select).not.toHaveClass('in-form')
    expect(select.parentElement).toHaveClass('field', 'in-form')
  })
})
