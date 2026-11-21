import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { staff } from '../../../bookings/components/examples'
import * as reviewFilterStories from './review-filter.stories'

const stories = composeStories(reviewFilterStories)

const box = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

/** The choices of a control, in their order */
const choicesOf = (name: string): string[] =>
  within(box(name))
    .getAllByRole('option')
    .map(({ textContent }) => textContent ?? '')

describe('ReviewFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should offer the ratings from the highest, every member of the staff, and the orders, the latest first', async () => {
    // Act
    await stories.Every.run()

    // Assert
    expect(box('評価の下限').closest('search')).toHaveAttribute(
      'aria-label',
      'レビューを絞り込む',
    )
    expect(choicesOf('評価の下限')).toEqual([
      '指定しない',
      '5',
      '4',
      '3',
      '2',
      '1',
    ])
    expect(choicesOf('担当スタッフ')).toEqual([
      'すべて',
      '田中 美咲',
      '佐藤 健',
    ])
    expect(choicesOf('並び順')).toEqual([
      '新しい順',
      '評価の高い順',
      '参考になった順',
    ])
    expect(screen.queryByRole('link', { name: '条件をすべて外す' })).toBeNull()
  })

  it('should show the conditions of the address, and lead to every review', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(box('評価の下限')).toHaveValue('')
    expect(box('評価の上限')).toHaveValue('3')
    expect(box('担当スタッフ')).toHaveValue(staff[1]?.id)
    expect(box('並び順')).toHaveValue('helpful')
    expect(screen.getByRole('link', { name: '条件をすべて外す' })).toBeVisible()
  })

  it('should hand over the conditions that were chosen', async () => {
    // Arrange
    await stories.Every.run()
    const onSubmit = vi.mocked(stories.Every.args.onSubmit ?? (() => undefined))

    // Act
    await userEvent.selectOptions(box('評価の下限'), '4')
    await userEvent.selectOptions(box('並び順'), 'rating')
    await userEvent.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    const [values] = onSubmit.mock.lastCall ?? []
    expect(values?.get('min')).toBe('4')
    expect(values?.get('max')).toBe('')
    expect(values?.get('sort')).toBe('rating')
  })

  it('should say what is wrong with the highest rating at its control', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(box('評価の上限')).toBeInvalid()
    expect(box('評価の上限')).toHaveAccessibleDescription(
      '評価の上限は、下限と同じか、それより高くしてください。',
    )
  })
})
