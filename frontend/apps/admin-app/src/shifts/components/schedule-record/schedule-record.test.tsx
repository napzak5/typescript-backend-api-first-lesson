import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as scheduleRecordStories from './schedule-record.stories'

const stories = composeStories(scheduleRecordStories)

describe('ScheduleRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say the hours, the break and the note of every day of the week', async () => {
    // Act
    await stories.Whole.run()

    // Assert
    expect(rowsOf('毎週')).toEqual([
      ['月曜日', '09:00〜20:00', '13:00〜14:00', '記録なし'],
      ['火曜日', '09:00〜20:00', '13:00〜14:00', '記録なし'],
      ['水曜日', '09:00〜20:00', '13:00〜14:00', '記録なし'],
      ['木曜日', '09:00〜20:00', '13:00〜14:00', '記録なし'],
      ['金曜日', '09:00〜20:00', '13:00〜14:00', '記録なし'],
      ['土曜日', '10:00〜18:00', 'なし', '記録なし'],
      ['日曜日', '休み', '', '定休日'],
    ])
  })

  it('should list the rows of dates from today, and count those before it', async () => {
    // Act
    await stories.Whole.run()

    // Assert
    expect(rowsOf('日付ごと')).toEqual([
      ['2026年11月21日（土）', '12:00〜18:00', 'なし', '午前は講習'],
    ])
    expect(
      screen.getByText('今日より前の日付の行が、ほかに 2 行あります。'),
    ).toBeVisible()
  })

  it('should say that a day without a row has no work, and that there are no dates', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(rowsOf('毎週').map((row) => row[1])).toEqual(
      Array.from({ length: 7 }, () => '勤務なし'),
    )
    expect(
      within(screen.getByRole('table', { name: '日付ごと' })).getByText(
        /^今日から後の日付の行はありません。/,
      ),
    ).toBeVisible()
    expect(screen.queryByText(/今日より前の日付の行が/)).toBeNull()
  })
})

describe('ScheduleRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say the hours of every day of the week and of the dates, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Whole.run()

    // Assert
    expect(
      within(screen.getByRole('table', { name: 'Every week' }))
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Day', 'Work', 'Break', 'Notes'])
    expect(rowsOf('Every week')).toEqual([
      ['Monday', '09:00–20:00', '13:00–14:00', 'Not recorded'],
      ['Tuesday', '09:00–20:00', '13:00–14:00', 'Not recorded'],
      ['Wednesday', '09:00–20:00', '13:00–14:00', 'Not recorded'],
      ['Thursday', '09:00–20:00', '13:00–14:00', 'Not recorded'],
      ['Friday', '09:00–20:00', '13:00–14:00', 'Not recorded'],
      ['Saturday', '10:00–18:00', 'None', 'Not recorded'],
      ['Sunday', 'Day off', '', '定休日'],
    ])
    expect(rowsOf('By date')).toEqual([
      ['Sat, November 21, 2026', '12:00–18:00', 'None', '午前は講習'],
    ])
    expect(
      screen.getByText('Also kept: 2 rows of dates before today.'),
    ).toBeVisible()
  })

  it('should say in English that a day without a row has no work, and that there are no dates', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Empty.run()

    // Assert
    expect(rowsOf('Every week').map((row) => row[1])).toEqual(
      Array.from({ length: 7 }, () => 'Not working'),
    )
    expect(
      within(screen.getByRole('table', { name: 'By date' })).getByText(
        /^No dates from today on\./,
      ),
    ).toBeVisible()
  })
})
