import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as tableStories from './table.stories'

const stories = composeStories(tableStories)

describe('Table', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a table named by its caption', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('table', { name: '今日の予約' })).toBeVisible()
  })

  it('should head each column', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['お客様', '開始', 'メニュー', '状態', '金額'])
  })

  it('should show one row for each record, in order, headed by its first cell', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen.getAllByRole('rowheader').map((header) => header.textContent),
    ).toEqual(['山田 花子', '鈴木 一郎', '高橋 彩'])
    expect(
      within(screen.getByRole('row', { name: /鈴木 一郎/ }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['12/3（木）11:30', 'カット、カラー', '仮予約', '13,200 円'])
  })

  it('should head each row by the column it is told to, when that is not the first', async () => {
    // Act
    await stories.RowHeaderNotFirst.run()

    // Assert
    expect(
      screen.getAllByRole('rowheader').map((header) => header.textContent),
    ).toEqual(['山田 花子', '鈴木 一郎', '高橋 彩'])
    expect(
      within(screen.getByRole('row', { name: /鈴木 一郎/ }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['12/3（木）11:30'])
  })

  it('should line a column of amounts up at its end, header and cells alike', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('columnheader', { name: '金額' })).toHaveClass(
      'end',
    )
    expect(screen.getByRole('cell', { name: '5,500 円' })).toHaveClass('end')
    expect(screen.getByRole('cell', { name: 'カット' })).not.toHaveClass('end')
  })

  it('should say that there are no records in a cell across all columns', async () => {
    // Act
    await stories.WithoutRows.run()
    const cell = screen.getByRole('cell', { name: '今日の予約はありません。' })

    // Assert
    expect(cell).toHaveAttribute('colspan', '5')
    expect(screen.getAllByRole('columnheader')).toHaveLength(5)
    expect(screen.queryByRole('rowheader')).toBeNull()
  })

  it('should not say that there are no records when there are some', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.queryByText('今日の予約はありません。')).toBeNull()
  })

  it('should scroll inside a region of its name that the Tab key reaches', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    await userEvent.tab()

    // Assert
    expect(screen.getByRole('region', { name: '今日の予約' })).toHaveFocus()
    expect(screen.getByRole('region', { name: '今日の予約' })).toContainElement(
      screen.getByRole('table'),
    )
  })

  it('should keep its name when its caption is hidden from the eye', async () => {
    // Act
    await stories.CaptionHidden.run()

    // Assert
    expect(screen.getByRole('table', { name: '今日の予約' })).toBeVisible()
    expect(screen.getByText('今日の予約')).toHaveClass('captionHidden')
  })

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'in-page' },
    })

    // Assert
    expect(screen.getByRole('region', { name: '今日の予約' })).toHaveClass(
      'frame',
      'in-page',
    )
  })
})
