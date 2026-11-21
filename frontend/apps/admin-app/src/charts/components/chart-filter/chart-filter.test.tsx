import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as chartFilterStories from './chart-filter.stories'

const stories = composeStories(chartFilterStories)

describe('ChartFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Everything, () =>
    screen.getByRole('searchbox', { name: 'キーワード' }),
  )

  it('should show the conditions of the address, and lead to every chart', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('searchbox', { name: 'キーワード' })).toHaveValue(
      'ジアミン',
    )
    expect(
      screen.getByRole('combobox', { name: 'アレルギーの記録' }),
    ).toHaveDisplayValue('ある')
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      '?',
    )
  })

  it('should send the conditions that were filled in', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Everything.run({
      args: {
        ...stories.Everything.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()

    // Act
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'キーワード' }),
      'PPD',
    )
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'アレルギーの記録' }),
      'ない',
    )
    await userEvent.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(received).toEqual([
      [
        ['search', 'PPD'],
        ['allergies', 'without'],
      ],
    ])
  })

  it('should say what is wrong with the keyword, and give it the focus', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    const keyword = screen.getByRole('searchbox', { name: 'キーワード' })
    expect(keyword).toHaveAccessibleDescription(
      expect.stringContaining('キーワードは 100 文字以内で入力してください。'),
    )
    expect(keyword).toHaveFocus()
  })

  it('should count on its button the conditions of the sheet that narrow the charts, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（1）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})
