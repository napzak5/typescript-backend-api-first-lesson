import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { type ReactNode, useLayoutEffect, useState } from 'react'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { plainSalon, salon } from '../examples'
import { SalonResults, type SalonResultsProps } from './salon-results'
import * as salonResultsStories from './salon-results.stories'

const stories = composeStories(salonResultsStories)

const results = (): HTMLElement =>
  screen.getByRole('region', { name: '検索結果' })

const salonNamed = (name: string): HTMLElement => {
  const item = within(results())
    .getAllByRole('listitem')
    .find((candidate) =>
      within(candidate).queryByRole('heading', { level: 3, name }),
    )
  if (item === undefined) {
    throw new Error(`No salon is named ${name}`)
  }

  return item
}

const ADDED_ID = 'e7092b4c-68fd-4a13-9b35-d7f902245846'

type WhereTheFocusIs = (focused: Element | null) => void

type GrowingResultsProps = SalonResultsProps & {
  seen: WhereTheFocusIs
  children?: ReactNode
}

/**
 * A list that gets two salons more when its button is pressed, as the
 * screen does when the next page arrives, and when 「読み直す」 is: a list
 * that is read again may come back longer. It hands over where the focus
 * is in the commit that shows the salons: the layout effect of a component
 * runs after those of what it holds, and before the browser paints.
 */
const GrowingResults = ({ seen, ...props }: GrowingResultsProps) => {
  const [salons, setSalons] = useState(props.salons)

  useLayoutEffect(() => {
    seen(document.activeElement)
  })

  const add = (): void =>
    setSalons([
      ...salons,
      { ...salon, id: ADDED_ID, name: '美容室 あさひ' },
      { ...plainSalon, id: `${ADDED_ID}-2`, name: '美容室 ゆうひ' },
    ])

  return (
    <>
      <SalonResults {...props} salons={salons} onMore={add} />
      <button type='button' onClick={add}>
        読み直す
      </button>
    </>
  )
}

describe('SalonResults', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a part of the page under its own heading', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(
      within(results()).getByRole('heading', { level: 2, name: '検索結果' }),
    ).toBeVisible()
  })

  it('should list the salons in the order it is given, each under its name', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(
      within(results())
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['ヘアサロン こもれび 表参道', '理容 みなと'])
  })

  it('should lead from the name of a salon to its page', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(
      screen.getByRole('link', { name: 'ヘアサロン こもれび 表参道' }),
    ).toHaveAttribute('href', `/salons/${salon.id}`)
    expect(screen.getByRole('link', { name: '理容 みなと' })).toHaveAttribute(
      'href',
      `/salons/${plainSalon.id}`,
    )
  })

  it('should say where a salon is, how it is rated and what it offers', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    const found = within(salonNamed('ヘアサロン こもれび 表参道'))
    expect(
      found.getByText('東京都 渋谷区 神宮前 4-1-1 こもれびビル 2 階'),
    ).toBeVisible()
    expect(
      found.getByRole('img', { name: '5 段階中 4.5（128 件）' }),
    ).toBeVisible()
    expect(
      found.getByText(
        '表参道駅から歩いて 3 分。髪と頭皮にやさしい薬剤だけを使う、席数 6 の小さなサロンです。',
      ),
    ).toBeVisible()
    expect(
      within(
        found.getByRole('list', { name: 'ヘアサロン こもれび 表参道の特徴' }),
      )
        .getAllByRole('listitem')
        .map((feature) => feature.textContent),
    ).toEqual(['個室あり', 'キッズスペース', '駐車場'])
  })

  it('should say that nobody rated a salon, and leave out what the salon did not write', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    const found = within(salonNamed('理容 みなと'))
    expect(found.getByText('大阪府 大阪市浪速区 難波中 2-3-4')).toBeVisible()
    expect(found.getByText('評価なし')).toBeVisible()
    expect(found.queryByRole('img')).toBeNull()
    expect(found.queryByRole('list')).toBeNull()
  })

  it.each([
    { story: stories.Complete, count: '2 件のサロンが見つかりました' },
    {
      story: stories.WithMore,
      count: '41 件のサロンが見つかりました（2 件を表示しています）',
    },
    { story: stories.NotCounted, count: '2 件を表示しています' },
  ])(
    'should say how many salons there are: $count',
    async ({ story, count }) => {
      // Act
      await story.run()

      // Assert
      expect(within(results()).getByRole('status')).toHaveTextContent(count)
    },
  )

  it('should have no way to more when the list is complete', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(within(results()).queryByRole('button')).toBeNull()
    expect(within(results()).queryByRole('alert')).toBeNull()
  })

  it('should ask for the next salons when its button is pressed', async () => {
    // Arrange
    await stories.WithMore.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.WithMore.args.onMore).toHaveBeenCalledTimes(1)
  })

  it('should not ask again while the next salons are on their way', async () => {
    // Arrange
    await stories.LoadingMore.run()
    const more = screen.getByRole('button', { name: 'さらに表示' })

    // Act
    await userEvent.click(more)

    // Assert
    expect(more).toHaveAttribute('aria-busy', 'true')
    expect(stories.LoadingMore.args.onMore).not.toHaveBeenCalled()
  })

  it('should say that the next salons did not come, and offer to ask again', async () => {
    // Arrange
    await stories.MoreFailed.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'もう一度読み込む' }),
    )

    // Assert
    expect(within(results()).getByRole('alert')).toHaveTextContent(
      '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(stories.MoreFailed.args.onMore).toHaveBeenCalledTimes(1)
    // The salons that were read stay
    expect(
      within(results()).getAllByRole('heading', { level: 3 }),
    ).toHaveLength(2)
  })

  it('should move the focus to the first salon that was added, in the commit that shows it', async () => {
    // Arrange
    const seen = vi.fn<WhereTheFocusIs>()
    const Growing = composeStory(
      {
        ...salonResultsStories.WithMore,
        render: (args) => <GrowingResults {...args} seen={seen} />,
      },
      salonResultsStories.default,
    )
    await Growing.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    const added = screen.getByRole('link', { name: '美容室 あさひ' })
    expect(seen).toHaveBeenLastCalledWith(added)
    expect(added).toHaveFocus()
    expect(
      within(results())
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      'ヘアサロン こもれび 表参道',
      '理容 みなと',
      '美容室 あさひ',
      '美容室 ゆうひ',
    ])
  })

  it('should leave the focus where it is when salons come that no press asked for: the list was read again', async () => {
    // Arrange
    const Growing = composeStory(
      {
        ...salonResultsStories.WithMore,
        render: (args) => <GrowingResults {...args} seen={() => undefined} />,
      },
      salonResultsStories.default,
    )
    await Growing.run()

    // Act: an event that moves no focus
    fireEvent.click(screen.getByRole('button', { name: '読み直す' }))

    // Assert
    expect(screen.getByRole('link', { name: '美容室 あさひ' })).toBeVisible()
    expect(document.body).toHaveFocus()
  })

  it('should leave the focus where it is when the list appears', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(document.body).toHaveFocus()
  })
})
