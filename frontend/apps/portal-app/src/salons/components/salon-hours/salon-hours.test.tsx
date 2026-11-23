import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as salonHoursStories from './salon-hours.stories'

const stories = composeStories(salonHoursStories)

/**
 * The days under a heading: each as its name and what is said of it. None
 * when there is no list under the heading.
 */
const daysUnder = (heading: string): (string | null)[][] =>
  Array.from(
    screen
      .getByRole('heading', { level: 3, name: heading })
      .parentElement?.querySelector('dl')?.children ?? [],
    (day) => Array.from(day.children, (said) => said.textContent),
  )

describe('SalonHours', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the hours of a week from Monday on, and name the day the salon is closed', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(daysUnder('曜日ごとの営業時間')).toEqual([
      ['月曜日', '10:00〜20:00'],
      ['火曜日', '定休日'],
      ['水曜日', '10:00〜20:00'],
      ['木曜日', '10:00〜20:00'],
      ['金曜日', '10:00〜20:00'],
      ['土曜日', '10:00〜20:00'],
      ['日曜日', '10:00〜20:00'],
    ])
  })

  it('should name every day as a term, and say its hours as the definition of it', async () => {
    // Act
    await stories.Default.run()

    // Assert: seven days of the week, and two dates
    expect(screen.getAllByRole('term')).toHaveLength(9)
    expect(
      screen.getAllByRole('term').map((term) => term.textContent),
    ).toContain('火曜日')
    expect(
      screen
        .getAllByRole('definition')
        .map((definition) => definition.textContent),
    ).toContain('定休日')
  })

  it('should list the dates that have hours of their own, with what the salon remarks', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(daysUnder('日付ごとの営業時間')).toEqual([
      [
        '11月23日（月）',
        '10:00〜18:00',
        '勤労感謝の日 祝日は 18 時までの営業です',
      ],
      ['11月25日（水）', '休業', '研修のため'],
    ])
    expect(
      screen.getByText(
        '下の日は、曜日ごとの営業時間ではなく、このとおりに営業します。',
      ),
    ).toBeVisible()
  })

  it('should say nothing of a date the salon remarks nothing about', async () => {
    // Act
    await stories.Default.run({
      args: {
        ...stories.Default.args,
        openingHours: [
          {
            dayOfWeek: 'friday',
            date: '2026-11-20',
            openTime: '09:00:00',
            closeTime: '19:00:00',
            isHoliday: false,
            holidayName: null,
            notes: null,
          },
        ],
      },
    })

    // Assert
    expect(daysUnder('日付ごとの営業時間')).toEqual([
      ['11月20日（金）', '09:00〜19:00'],
    ])
  })

  it('should say so when the salon registered no hours', async () => {
    // Act
    await stories.NothingRegistered.run()

    // Assert
    expect(
      screen.getByText('曜日ごとの営業時間は、登録されていません。'),
    ).toBeVisible()
    expect(
      screen.getByText('日付ごとに決めた営業時間は、ありません。'),
    ).toBeVisible()
    expect(daysUnder('曜日ごとの営業時間')).toEqual([])
    expect(daysUnder('日付ごとの営業時間')).toEqual([])
    expect(
      screen.queryByText(
        '下の日は、曜日ごとの営業時間ではなく、このとおりに営業します。',
      ),
    ).toBeNull()
  })

  it('should show the breaks, several slots of a day and the time the hours hold for; a day without an entry is closed', async () => {
    // Act
    await stories.BreaksAndPeriod.run()

    // Assert
    expect(daysUnder('曜日ごとの営業時間')).toEqual([
      ['月曜日', '10:00〜20:00（休憩 13:00〜14:00）'],
      ['火曜日', '定休日'],
      ['水曜日', '定休日'],
      ['木曜日', '定休日'],
      ['金曜日', '定休日'],
      ['土曜日', '定休日'],
      ['日曜日', '09:00〜12:00、14:00〜17:00（2026年12月1日〜2026年12月31日）'],
    ])
  })

  it('should leave out the dates before today', async () => {
    // Act
    await stories.ADateHasPassed.run()

    // Assert
    expect(daysUnder('日付ごとの営業時間')).toEqual([
      ['11月25日（水）', '休業', '研修のため'],
    ])
  })

  it('should show no more than fourteen dates, the nearest', async () => {
    // Act
    await stories.Default.run({
      args: {
        ...stories.Default.args,
        openingHours: Array.from({ length: 20 }, (_, index) => ({
          dayOfWeek: 'monday',
          date: `2026-12-${String(20 - index).padStart(2, '0')}`,
          openTime: '10:00:00',
          closeTime: '20:00:00',
          isHoliday: false,
          holidayName: null,
          notes: null,
        })),
      },
    })

    // Assert
    const dates = daysUnder('日付ごとの営業時間').map(([date]) => date)
    expect(dates).toHaveLength(14)
    expect(dates.at(0)).toBe('12月1日（火）')
    expect(dates.at(-1)).toBe('12月14日（月）')
  })
})

describe('SalonHours on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name the days of the week in English, and write the hours as English does', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Default.run()

    // Assert
    expect(daysUnder('Hours by day of the week')).toEqual([
      ['Monday', '10:00–20:00'],
      ['Tuesday', 'Closed'],
      ['Wednesday', '10:00–20:00'],
      ['Thursday', '10:00–20:00'],
      ['Friday', '10:00–20:00'],
      ['Saturday', '10:00–20:00'],
      ['Sunday', '10:00–20:00'],
    ])
    expect(daysUnder('Hours by date').map(([day]) => day)).toEqual([
      'Mon, November 23',
      'Wed, November 25',
    ])
  })

  it('should say the breaks and the period of the hours of a week in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.BreaksAndPeriod.run()

    // Assert
    expect(daysUnder('Hours by day of the week')).toContainEqual([
      'Monday',
      '10:00–20:00 (break 13:00–14:00)',
    ])
    expect(daysUnder('Hours by day of the week')).toContainEqual([
      'Sunday',
      '09:00–12:00, 14:00–17:00 (December 1, 2026 – December 31, 2026)',
    ])
  })

  it('should say in English that no hours are registered', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NothingRegistered.run()

    // Assert
    expect(
      screen.getByText('No hours by day of the week are registered.'),
    ).toBeVisible()
    expect(
      screen.getByText('No hours are set for particular dates.'),
    ).toBeVisible()
  })
})
