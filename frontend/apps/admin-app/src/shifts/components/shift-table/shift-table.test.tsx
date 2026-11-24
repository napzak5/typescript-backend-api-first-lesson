import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as shiftTableStories from './shift-table.stories'

const stories = composeStories(shiftTableStories)

/** The table of the week of the stories */
const week = (
  name = '2026年11月16日（月）〜2026年11月22日（日）のシフト',
): HTMLElement => screen.getByRole('table', { name })

/** The words of every cell of a row, the name first */
const rowOf = (name: string, table = week()): string[] =>
  within(within(table).getByRole('row', { name: new RegExp(`^${name}`) }))
    .getAllByRole('cell')
    .map((cell) => cell.textContent)

describe('ShiftTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name the days from Monday to Sunday', async () => {
    // Act
    await stories.Week.run()

    // Assert
    expect(
      within(week())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'スタッフ',
      '11/16（月）',
      '11/17（火）',
      '11/18（水）',
      '11/19（木）',
      '11/20（金）',
      '11/21（土）',
      '11/22（日）',
    ])
  })

  it('should lead to the schedule of each member by their name', async () => {
    // Act
    await stories.Week.run()

    // Assert
    expect(
      within(week())
        .getAllByRole('rowheader')
        .map((header) => [
          header.textContent,
          within(header).getByRole('link').getAttribute('href'),
        ]),
    ).toEqual([
      ['Misaki Tanaka', '/salons/salon/shifts/tanaka'],
      ['Yui Suzuki', '/salons/salon/shifts/suzuki'],
      ['Ren Mori', '/salons/salon/shifts/mori'],
    ])
  })

  it('should say the row of a date on its day, and the weekly row on the others', async () => {
    // Act
    await stories.Week.run()

    // Assert
    expect(rowOf('Misaki Tanaka')).toEqual([
      '09:00〜20:00休憩 13:00〜14:00',
      '09:00〜20:00休憩 13:00〜14:00',
      '休み研修（この日だけ）',
      '09:00〜20:00休憩 13:00〜14:00',
      '09:00〜20:00休憩 13:00〜14:00',
      '12:00〜18:00（この日だけ）',
      '休み定休日',
    ])
  })

  it('should tell a day without a row from a day off', async () => {
    // Act
    await stories.Week.run()

    // Assert
    expect(rowOf('Yui Suzuki').slice(5)).toEqual(['10:00〜18:00', '勤務なし'])
    expect(rowOf('Ren Mori')).toEqual(
      Array.from({ length: 7 }, () => '勤務なし'),
    )
  })

  it('should show a member of the staff their own row alone', async () => {
    // Act
    await stories.OwnRow.run()

    // Assert
    expect(
      within(week())
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['Misaki Tanaka'])
  })
})

describe('ShiftTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name the week and its days, and say who works when, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Week.run()

    // Assert
    const table = week(
      'Shifts for Mon, November 16, 2026 – Sun, November 22, 2026',
    )
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Staff member',
      'Mon, 11/16',
      'Tue, 11/17',
      'Wed, 11/18',
      'Thu, 11/19',
      'Fri, 11/20',
      'Sat, 11/21',
      'Sun, 11/22',
    ])
    expect(rowOf('Misaki Tanaka', table)).toEqual([
      '09:00–20:00Break 13:00–14:00',
      '09:00–20:00Break 13:00–14:00',
      'Day off研修This date only',
      '09:00–20:00Break 13:00–14:00',
      '09:00–20:00Break 13:00–14:00',
      '12:00–18:00This date only',
      'Day off定休日',
    ])
    expect(rowOf('Ren Mori', table)).toEqual(
      Array.from({ length: 7 }, () => 'Not working'),
    )
  })
})
