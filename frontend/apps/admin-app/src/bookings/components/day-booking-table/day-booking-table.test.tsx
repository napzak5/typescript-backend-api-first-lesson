import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { salon } from '../examples'
import * as dayBookingTableStories from './day-booking-table.stories'

const stories = composeStories(dayBookingTableStories)

const table = (): HTMLElement =>
  screen.getByRole('table', { name: '2026年11月20日（金）の予約' })

describe('DayBookingTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the bookings with their times on the clock of the salon, their names and their states', async () => {
    // Act
    await stories.Day.run()

    // Assert
    expect(rowsOf(table())).toEqual([
      [
        '10:00〜11:00',
        '山田 花子',
        '田中 美咲',
        'カット',
        '確定',
        'BK-4F7H-2KQM',
      ],
      [
        '11:30〜13:30',
        '削除された顧客',
        '一覧にないスタッフ',
        'カラー、削除されたメニュー',
        '確定待ち',
        'BK-9P2R-7XWN',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('2 件')
  })

  it('should lead from the customer to the booking, a customer who was removed as well', async () => {
    // Act
    await stories.Day.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(
      dayBookingTableStories.ROWS.map(
        ({ booking }) => `/salons/${salon.id}/bookings/${booking.id}`,
      ),
    )
  })

  it('should say how many of the bookings of the day are shown', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '64 件（2 件を表示しています）',
    )
  })
})
