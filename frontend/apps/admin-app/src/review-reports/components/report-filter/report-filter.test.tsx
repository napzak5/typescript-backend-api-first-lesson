import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as reportFilterStories from './report-filter.stories'

const stories = composeStories(reportFilterStories)

const box = (): HTMLElement => screen.getByRole('combobox', { name: '状態' })

describe('ReportFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should offer the reports that wait first, then those dismissed, then all', async () => {
    // Act
    await stories.Pending.run()

    // Assert
    expect(box().closest('search')).toHaveAttribute(
      'aria-label',
      '通報を絞り込む',
    )
    expect(optionsOf(box())).toEqual(['未処理', '却下', 'すべて'])
    expect(box()).toHaveValue('pending')
  })

  it('should show the reports of the address', async () => {
    // Act
    await stories.All.run()

    // Assert
    expect(box()).toHaveValue('all')
  })

  it('should hand over the state that was chosen', async () => {
    // Arrange
    const onSubmit = vi.fn()
    await stories.Pending.run({ args: { ...stories.Pending.args, onSubmit } })

    // Act
    await userEvent.selectOptions(box(), 'dismissed')
    await userEvent.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    const [values] = onSubmit.mock.lastCall ?? []
    expect(values?.get('status')).toBe('dismissed')
  })
})

describe('ReportFilter on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer the reports that wait, those dismissed and all, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Pending.run()

    // Assert
    const status = screen.getByRole('combobox', { name: 'Status' })
    expect(status.closest('search')).toHaveAttribute(
      'aria-label',
      'Filter the reports',
    )
    expect(optionsOf(status)).toEqual(['Pending', 'Dismissed', 'All'])
  })
})
