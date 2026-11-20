import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useLayoutEffect, useState } from 'react'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { countOf, PagedTable, type PagedTableProps } from './paged-table'
import * as pagedTableStories from './paged-table.stories'

const stories = composeStories(pagedTableStories)

type Visit = (typeof pagedTableStories.VISITS)[number]

const ADDED: Visit[] = [
  { id: 'visit-3', name: '佐藤 次郎', time: '13:00' },
  { id: 'visit-4', name: '高橋 三郎', time: '15:00' },
]

type GrowingTableProps = PagedTableProps<Visit> & {
  seen: (focused: Element | null) => void
}

/**
 * A table that gets two rows more when its button is pressed, as the
 * screen does when the next page arrives. It hands over where the focus is
 * in the commit that shows the rows: the layout effect of a component runs
 * after those of what it holds, and before the browser paints.
 */
const GrowingTable = ({ seen, ...props }: GrowingTableProps) => {
  const [rows, setRows] = useState(props.rows)

  useLayoutEffect(() => {
    seen(document.activeElement)
  })

  return (
    <>
      <PagedTable
        {...props}
        rows={rows}
        onMore={() => setRows([...rows, ...ADDED])}
      />
      <button type='button' onClick={() => setRows([...rows, ...ADDED])}>
        読み直す
      </button>
    </>
  )
}

describe('PagedTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say how many there are, in a status that is read out', async () => {
    // Act
    await stories.More.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '4 件（2 件を表示しています）',
    )
  })

  it('should ask for more when its button is pressed', async () => {
    // Arrange
    await stories.More.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.More.args.onMore).toHaveBeenCalledTimes(1)
  })

  it('should show that more is on its way, and not ask again', async () => {
    // Arrange
    await stories.Loading.run()
    const button = screen.getByRole('button', { name: 'さらに表示' })

    // Act
    await userEvent.click(button)

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Loading.args.onMore).not.toHaveBeenCalled()
  })

  it('should say that the next rows did not come, and ask again', async () => {
    // Arrange
    await stories.Failed.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'もう一度読み込む' }),
    )

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(stories.Failed.args.onMore).toHaveBeenCalledTimes(1)
  })

  it('should offer no more when every row is shown', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('should move the focus to the first row it added, in the commit that shows it', async () => {
    // Arrange
    const seen = vi.fn<(focused: Element | null) => void>()
    const Growing = composeStory(
      {
        ...pagedTableStories.More,
        render: (args) => <GrowingTable {...args} seen={seen} />,
      },
      pagedTableStories.default,
    )
    await Growing.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    const added = screen.getByRole('link', { name: '佐藤 次郎' })
    expect(seen).toHaveBeenLastCalledWith(added)
    expect(added).toHaveFocus()
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['山田 花子', '鈴木 一郎', '佐藤 次郎', '高橋 三郎'])
  })

  it('should move the focus to the header of the first row it added when the rows have no link', async () => {
    // Arrange
    const Growing = composeStory(
      {
        ...pagedTableStories.WithoutLinks,
        render: (args) => <GrowingTable {...args} seen={() => undefined} />,
      },
      pagedTableStories.default,
    )
    await Growing.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    const added = screen.getByRole('rowheader', { name: '13:00' })
    expect(added).toHaveFocus()
    expect(added).toHaveAttribute('tabindex', '-1')
  })

  it('should leave the focus where it is when rows come that no press asked for: the list was read again', async () => {
    // Arrange
    const Growing = composeStory(
      {
        ...pagedTableStories.More,
        render: (args) => <GrowingTable {...args} seen={() => undefined} />,
      },
      pagedTableStories.default,
    )
    await Growing.run()

    // Act: an event that moves no focus
    fireEvent.click(screen.getByRole('button', { name: '読み直す' }))

    // Assert
    expect(screen.getByRole('link', { name: '佐藤 次郎' })).toBeVisible()
    expect(document.body).toHaveFocus()
  })
})

describe('countOf', () => {
  it.each([
    [12, 10, '12 件（10 件を表示しています）'],
    [10, 10, '10 件'],
    [null, 10, '10 件を表示しています'],
  ])(
    'should say how many of %s are shown when %i are',
    (total, shown, said) => {
      expect(countOf(total, shown, '件')).toBe(said)
    },
  )
})
