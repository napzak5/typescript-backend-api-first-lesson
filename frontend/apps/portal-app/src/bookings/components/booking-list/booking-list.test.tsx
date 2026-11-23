import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useLayoutEffect, useState } from 'react'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rows, rowWithoutNames } from '../examples'
import { BookingList, type BookingListProps } from './booking-list'
import * as bookingListStories from './booking-list.stories'

const stories = composeStories(bookingListStories)

const list = (name = 'これからの予約'): HTMLElement =>
  screen.getByRole('region', { name })

/** What each booking of the list says, line by line. */
const lines = (): (string | null)[][] =>
  within(list())
    .getAllByRole('listitem')
    .map((item) => Array.from(item.children, (line) => line.textContent))

const FIRST = '2026年11月24日火曜日 10:30〜11:30'
const SECOND = '2026年12月8日火曜日 14:00〜16:00'
const THIRD = '2026年12月19日土曜日 11:00〜11:40'

type WhereTheFocusIs = (focused: Element | null) => void

type GrowingListProps = BookingListProps & {
  seen: WhereTheFocusIs
  /** How many bookings a press of the button of the list adds */
  atOnce: number
}

/**
 * A list that gets a booking more when its button is pressed, as the
 * screen does when the next page arrives, and one more when 「名前が届く」
 * is: the screen shows a booking when the names of its salon and of its
 * service are read, which may be later than the booking. It hands over
 * where the focus is in the commit that shows them: the layout effect of a
 * component runs after those of what it holds, and before the browser
 * paints.
 */
const GrowingList = ({ seen, atOnce, ...props }: GrowingListProps) => {
  const [shown, setShown] = useState(props.rows)

  useLayoutEffect(() => {
    seen(document.activeElement)
  })

  const add = (count: number): void =>
    setShown(rows.slice(0, shown.length + count))

  return (
    <>
      <BookingList {...props} rows={shown} onMore={() => add(atOnce)} />
      <button type='button' onClick={() => add(1)}>
        名前が届く
      </button>
    </>
  )
}

/** The list with its first booking, which grows. */
const growing = (seen: WhereTheFocusIs = () => undefined, atOnce = 1) =>
  composeStory(
    {
      ...bookingListStories.WithMore,
      args: { ...bookingListStories.WithMore.args, rows: rows.slice(0, 1) },
      render: (args) => <GrowingList {...args} seen={seen} atOnce={atOnce} />,
    },
    bookingListStories.default,
  )

/** Bookings arrive that no press asked for: the event moves no focus. */
const namesArrive = (): void => {
  fireEvent.click(screen.getByRole('button', { name: '名前が届く' }))
}

describe('BookingList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a part of the page under the heading it is given', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(
      within(list()).getByRole('heading', {
        level: 2,
        name: 'これからの予約',
      }),
    ).toBeVisible()
  })

  it('should be named as the list of the visits that were when it is given that name', async () => {
    // Act
    await stories.Past.run()

    // Assert
    expect(
      within(list('これまでの予約')).getAllByRole('listitem'),
    ).toHaveLength(3)
  })

  it('should say of each booking when it is at its salon, where, what, and where it stands, in the order it is given', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(lines()).toEqual([
      [FIRST, 'ヘアサロン こもれび 表参道', 'レディースカット', '確定待ち'],
      [SECOND, 'ヘアサロン こもれび 表参道', 'フルカラー', '確定'],
      [THIRD, '理容 みなと', 'カット', 'キャンセル'],
    ])
  })

  it('should make the time of a booking the heading of its item, and the link to its page', async () => {
    // Act
    await stories.Complete.run()

    // Assert
    expect(
      within(list())
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([FIRST, SECOND, THIRD])
    expect(
      within(list())
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual(
      rows.map(({ booking }, index) => [
        [FIRST, SECOND, THIRD].at(index),
        `/bookings/${booking.id}`,
      ]),
    )
  })

  it('should say the state of a visit that was in its word', async () => {
    // Act
    await stories.Past.run()

    // Assert
    expect(
      within(list('これまでの予約'))
        .getAllByRole('listitem')
        .map((item) => item.lastElementChild?.textContent),
    ).toEqual(['完了', '来店なし', '完了'])
  })

  it('should tell the day alone of a booking whose salon is no longer there, and say that the salon and the service are no longer shown', async () => {
    // Act
    await stories.WithoutNames.run()

    // Assert
    expect(lines().at(1)).toEqual([
      '2026年12月22日火曜日',
      'サロン（掲載を終えています）',
      'メニュー（掲載を終えています）',
      '確定',
    ])
    expect(
      screen.getByRole('link', { name: '2026年12月22日火曜日' }),
    ).toHaveAttribute('href', `/bookings/${rowWithoutNames.booking.id}`)
  })

  describe('how many there are', () => {
    it('should say how many bookings the list has when all of them are shown', async () => {
      // Act
      await stories.Complete.run()

      // Assert
      expect(screen.getByText('3 件の予約があります')).toHaveRole('status')
    })

    it('should say how many of them are shown when the list goes on', async () => {
      // Act
      await stories.WithMore.run()

      // Assert
      expect(
        screen.getByText('25 件の予約があります（3 件を表示しています）'),
      ).toHaveRole('status')
    })

    it('should say how many are shown when the API did not count them', async () => {
      // Act
      await stories.NotCounted.run()

      // Assert
      expect(screen.getByText('3 件を表示しています')).toHaveRole('status')
    })
  })

  describe('what comes after the bookings', () => {
    it('should have no button when every booking is shown', async () => {
      // Act
      await stories.Complete.run()

      // Assert
      expect(within(list()).queryByRole('button')).toBeNull()
      expect(within(list()).queryByRole('alert')).toBeNull()
    })

    it('should ask for the next bookings when its button is pressed', async () => {
      // Arrange
      await stories.WithMore.run()

      // Act
      await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(stories.WithMore.args.onMore).toHaveBeenCalledTimes(1)
    })

    it('should show that the next bookings are on their way, and not ask for them again', async () => {
      // Arrange
      await stories.LoadingMore.run()
      const button = screen.getByRole('button', { name: 'さらに表示' })

      // Act
      await userEvent.click(button)

      // Assert
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(stories.LoadingMore.args.onMore).not.toHaveBeenCalled()
    })

    it('should say that the next bookings did not come, keep those that were read, and ask again when its button is pressed', async () => {
      // Arrange
      await stories.MoreFailed.run()

      // Act
      await userEvent.click(
        screen.getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(within(list()).getByRole('alert')).toHaveTextContent(
        '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(stories.MoreFailed.args.onMore).toHaveBeenCalledTimes(1)
      expect(within(list()).getAllByRole('listitem')).toHaveLength(3)
    })

    it('should move the focus to the first booking that was added, in the commit that shows it', async () => {
      // Arrange
      const seen = vi.fn<WhereTheFocusIs>()
      await growing(seen).run()

      // Act
      await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      const added = screen.getByRole('link', { name: SECOND })
      expect(seen).toHaveBeenLastCalledWith(added)
      expect(added).toHaveFocus()
      expect(within(list()).getAllByRole('listitem')).toHaveLength(2)
    })

    it('should move the focus to the first of the bookings when a press adds more than one', async () => {
      // Arrange
      await growing(undefined, 2).run()

      // Act
      await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(within(list()).getAllByRole('listitem')).toHaveLength(3)
      expect(screen.getByRole('link', { name: SECOND })).toHaveFocus()
    })

    it('should leave the focus on the first booking that was added when the others of the page come later', async () => {
      // Arrange
      await growing().run()
      await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Act
      namesArrive()

      // Assert
      expect(within(list()).getAllByRole('listitem')).toHaveLength(3)
      expect(screen.getByRole('link', { name: SECOND })).toHaveFocus()
    })

    it('should leave the focus where it is when bookings come that no press asked for', async () => {
      // Arrange
      await growing().run()

      // Act
      namesArrive()

      // Assert
      expect(within(list()).getAllByRole('listitem')).toHaveLength(2)
      expect(document.body).toHaveFocus()
    })

    it('should move the focus to what the next press adds, after bookings came that no press asked for', async () => {
      // Arrange
      await growing().run()
      namesArrive()

      // Act
      await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(screen.getByRole('link', { name: THIRD })).toHaveFocus()
    })

    it('should leave the focus where it is when the list appears', async () => {
      // Act
      await stories.WithMore.run()

      // Assert
      expect(document.body).toHaveFocus()
    })
  })
})

describe('BookingList on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should count the bookings, and say when each is and where it stands, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Complete.run()

    // Assert
    expect(within(list()).getByText('3 bookings')).toBeVisible()
    expect(lines().at(0)).toEqual([
      'Tuesday, November 24, 2026 10:30–11:30',
      'ヘアサロン こもれび 表参道',
      'レディースカット',
      'Awaiting confirmation',
    ])
  })

  it('should say in English that the salon or the service of a booking is no longer listed', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithoutNames.run()

    // Assert
    expect(lines().at(1)).toEqual([
      'Tuesday, December 22, 2026',
      'Salon (no longer listed)',
      'Service (no longer listed)',
      'Confirmed',
    ])
  })
})
