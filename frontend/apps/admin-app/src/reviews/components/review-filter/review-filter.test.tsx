import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staff } from '../../../bookings/components/examples'
import * as reviewFilterStories from './review-filter.stories'

const stories = composeStories(reviewFilterStories)

const box = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

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
    expect(optionsOf(box('評価の下限'))).toEqual([
      '指定しない',
      '5',
      '4',
      '3',
      '2',
      '1',
    ])
    expect(optionsOf(box('担当スタッフ'))).toEqual([
      'すべて',
      '田中 美咲',
      '佐藤 健',
    ])
    expect(optionsOf(box('並び順'))).toEqual([
      '新しい順',
      '評価の高い順',
      '参考になった順',
    ])
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should show the conditions of the address, and lead to every review', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(box('評価の下限')).toHaveValue('')
    expect(box('評価の上限')).toHaveValue('3')
    expect(box('担当スタッフ')).toHaveValue(staff[1]?.id)
    expect(box('並び順')).toHaveValue('helpful')
    expect(screen.getByRole('link', { name: '条件を外す' })).toBeVisible()
  })

  it('should hold the lowest rating the reviews are narrowed to', async () => {
    // Act
    await stories.FromFour.run()

    // Assert
    expect(box('評価の下限')).toHaveValue('4')
    expect(box('評価の上限')).toHaveValue('')
    expect(screen.getByRole('link', { name: '条件を外す' })).toBeVisible()
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

  it('should count on its button the conditions of the sheet that narrow the reviews, and not the order, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（2）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})

describe('ReviewFilter on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer the ratings, the staff and the orders in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Every.run()

    // Assert
    expect(box('Lowest rating').closest('search')).toHaveAttribute(
      'aria-label',
      'Filter the reviews',
    )
    expect(optionsOf(box('Highest rating'))).toEqual([
      'Any',
      '5',
      '4',
      '3',
      '2',
      '1',
    ])
    expect(optionsOf(box('Staff member'))).toEqual([
      'All',
      '田中 美咲',
      '佐藤 健',
    ])
    expect(optionsOf(box('Sort by'))).toEqual([
      'Newest first',
      'Highest rated first',
      'Most helpful first',
    ])
  })

  it('should say in English what is wrong with the highest rating', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(box('Highest rating')).toHaveAccessibleDescription(
      'Make the highest rating the same as the lowest, or higher.',
    )
  })
})
