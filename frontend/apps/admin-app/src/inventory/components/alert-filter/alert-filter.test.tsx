import {
  itShouldBeAccessibleInEveryStory,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as filterStories from './alert-filter.stories'

const stories = composeStories(filterStories)

const choice = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

describe('AlertFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should offer every kind, every severity, and whether somebody saw to the alert, with nothing chosen', async () => {
    // Act
    await stories.Everything.run()

    // Assert
    // The element `search`: the testing library does not know its role yet
    expect(choice('種類').closest('search')).toHaveAttribute(
      'aria-label',
      '在庫のアラートを絞り込む',
    )
    expect(optionsOf(choice('種類'))).toEqual([
      'すべて',
      '在庫僅少',
      '在庫過剰',
      '期限切れ間近',
      '期限切れ',
    ])
    expect(optionsOf(choice('重要度'))).toEqual([
      'すべて',
      '緊急',
      '注意',
      '情報',
    ])
    expect(optionsOf(choice('確認'))).toEqual(['すべて', '未確認', '確認済み'])
    expect(choice('種類')).toHaveValue('')
    expect(choice('重要度')).toHaveValue('')
    expect(choice('確認')).toHaveValue('')
    // A link without an address would be no link: nothing of it is there
    expect(screen.queryByText('条件を外す')).toBeNull()
  })

  it('should show the conditions that narrow the alerts, and the way back to all of them', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(choice('種類')).toHaveValue('expired')
    expect(choice('重要度')).toHaveValue('critical')
    expect(choice('確認')).toHaveValue('false')
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      '?',
    )
  })

  it('should send the conditions chosen', async () => {
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
    await userEvent.selectOptions(choice('重要度'), '注意')
    await userEvent.selectOptions(choice('確認'), '確認済み')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(received).toEqual([
      [
        ['alert', ''],
        ['severity', 'warning'],
        ['acknowledged', 'true'],
      ],
    ])
  })

  it('should count on its button the conditions of the sheet that narrow the alerts, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（3）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})
