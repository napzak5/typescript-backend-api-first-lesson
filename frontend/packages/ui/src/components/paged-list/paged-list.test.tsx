import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { COUNTED, type Counted, countOf } from './paged-list'
import * as pagedListStories from './paged-list.stories'

const stories = composeStories(pagedListStories)

/** A list that is read again, and holds one more review: no press asked for it */
const ReadAgain = () => {
  const [count, setCount] = useState(2)

  return (
    <>
      <button type='button' onClick={() => setCount(3)}>
        読み込み直す
      </button>
      <stories.Failed
        items={Array.from({ length: count }, (_, index) => ({
          id: `review-${index + 1}`,
          title: `レビュー ${index + 1}`,
        }))}
        more='none'
      />
    </>
  )
}

const items = (): HTMLElement[] =>
  within(screen.getByRole('list', { name: 'レビュー' })).getAllByRole(
    'listitem',
  )

describe('PagedList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say how many there are, and list those that were read', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      '6 件（2 件を表示しています）',
    )
    expect(items().map((item) => item.textContent)).toEqual([
      'レビュー 1',
      'レビュー 2',
    ])
  })

  it('should move the focus to the link of the first item its button added', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(items()).toHaveLength(4)
    expect(screen.getByRole('link', { name: 'レビュー 3' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      '6 件（4 件を表示しています）',
    )
    expect(stories.Default.args.onMore).toHaveBeenCalledOnce()
  })

  it('should leave out its button once every item was read', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(items()).toHaveLength(6)
    expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
    expect(screen.getByRole('link', { name: 'レビュー 5' })).toHaveFocus()
  })

  it('should move the focus to the item itself when it is to be read from its beginning', async () => {
    // Arrange
    await stories.ItemFocus.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(items()[2]).toHaveFocus()
    expect(items()[2]).toHaveAttribute('tabindex', '-1')
  })

  it('should move the focus to an added item that has no link', async () => {
    // Arrange
    await stories.WithoutLinks.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(items()[2]).toHaveFocus()
  })

  it('should leave the focus where it is when items come that no press asked for', async () => {
    // Arrange
    await composeStory(
      { ...pagedListStories.Failed, render: () => <ReadAgain /> },
      pagedListStories.default,
    ).run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '読み込み直す' }))

    // Assert
    expect(items()).toHaveLength(3)
    expect(screen.getByRole('button', { name: '読み込み直す' })).toHaveFocus()
  })

  it('should say that the page did not come, and keep the items it has', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'もう一度読み込む' }),
    ).toBeVisible()
    expect(items()).toHaveLength(2)
  })
})

describe('countOf', () => {
  it.each<[number | null, number, LocalizedText]>([
    [
      12,
      10,
      { en: '12 items (showing 10)', ja: '12 件（10 件を表示しています）' },
    ],
    [10, 10, { en: '10 items', ja: '10 件' }],
    // A list that grew while it was read says the count of its last page
    [2, 3, { en: '2 items', ja: '2 件' }],
    [null, 10, { en: 'Showing 10 items', ja: '10 件を表示しています' }],
    [1, 1, { en: '1 item', ja: '1 件' }],
    [null, 1, { en: 'Showing 1 item', ja: '1 件を表示しています' }],
  ])(
    'should say how many of %s are shown when %i are, in every language',
    (total, shown, said) => {
      // Act
      const count = countOf(total, shown, COUNTED.items)

      // Assert
      expect(count).toEqual(said)
    },
  )

  it.each<[keyof typeof COUNTED, LocalizedText]>([
    [
      'items',
      { en: '34 items (showing 20)', ja: '34 件（20 件を表示しています）' },
    ],
    [
      'people',
      { en: '34 people (showing 20)', ja: '34 人（20 人を表示しています）' },
    ],
    [
      'rows',
      { en: '34 rows (showing 20)', ja: '34 行（20 行を表示しています）' },
    ],
  ])('should count with the word of the %s', (word, said) => {
    // Act
    const count = countOf(34, 20, COUNTED[word])

    // Assert
    expect(count).toEqual(said)
  })

  it.each<[number | null, number, LocalizedText]>([
    [
      3,
      3,
      {
        en: 'Signed in on 3 devices',
        ja: '3 台の端末でサインインしています',
      },
    ],
    [
      24,
      20,
      {
        en: 'Signed in on 24 devices (showing 20)',
        ja: '24 台の端末でサインインしています（20 台を表示しています）',
      },
    ],
    [null, 20, { en: 'Showing 20 devices', ja: '20 台を表示しています' }],
  ])(
    'should say the whole in the words it is given, of %s and %i',
    (total, shown, said) => {
      // Arrange
      const devices: Counted = (count) => ({
        en: `${count} devices`,
        ja: `${count} 台`,
      })
      const signedIn: Counted = (count) => ({
        en: `Signed in on ${count} devices`,
        ja: `${count} 台の端末でサインインしています`,
      })

      // Act
      const count = countOf(total, shown, devices, signedIn)

      // Assert
      expect(count).toEqual(said)
    },
  )
})
