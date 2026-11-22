import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as filterStories from './movement-filter.stories'

const stories = composeStories(filterStories)

const kind = (): HTMLElement => screen.getByRole('combobox', { name: '区分' })
const first = (): HTMLElement => screen.getByLabelText('記録した日（から）')
const last = (): HTMLElement => screen.getByLabelText('記録した日（まで）')

describe('MovementFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Everything, () =>
    screen.getByLabelText('記録した日（から）'),
  )

  it('should offer every kind, with nothing chosen', async () => {
    // Act
    await stories.Everything.run()

    // Assert
    // The element `search`: the testing library does not know its role yet
    expect(kind().closest('search')).toHaveAttribute(
      'aria-label',
      '在庫の移動を絞り込む',
    )
    expect(optionsOf(kind())).toEqual([
      'すべて',
      '仕入れ',
      '施術で使用',
      '店頭販売',
      '返品',
      '在庫の調整',
      '廃棄',
      'サロン間の移動',
    ])
    expect(kind()).toHaveValue('')
    expect(first()).toHaveValue('')
    expect(last()).toHaveValue('')
    expect(first()).toHaveAttribute('min', '1900-01-01')
    expect(last()).toHaveAttribute('max', '2999-12-31')
    // A link without an address would be no link: nothing of it is there
    expect(screen.queryByText('条件を外す')).toBeNull()
  })

  it('should show the conditions that narrow the movements, and the way back to all of them', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(kind()).toHaveValue('use')
    expect(first()).toHaveValue('2026-11-01')
    expect(last()).toHaveValue('2026-11-30')
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
    await userEvent.selectOptions(kind(), '廃棄')
    await userEvent.type(first(), '2026-11-01')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(received).toEqual([
      [
        ['type', 'disposal'],
        ['from', '2026-11-01'],
        ['to', ''],
      ],
    ])
  })

  it('should say what is wrong at the day, and take the focus to it', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(last()).toHaveAccessibleDescription(
      '終わりの日は、始まりの日と同じか、その後にしてください。',
    )
    expect(last()).toHaveFocus()
  })

  it('should count on its button the conditions of the sheet that narrow the movements, on a narrow screen', async () => {
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
