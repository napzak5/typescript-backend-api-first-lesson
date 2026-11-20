import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as hoursFormStories from './hours-form.stories'

const stories = composeStories(hoursFormStories)

/** The group of a day of the week, or of a row of a date: 「月曜日」, 「1 行目」 */
const group = (name: string): HTMLElement => screen.getByRole('group', { name })

/** The values the form hands over when it is sent */
const sentBy = async (
  story: keyof typeof stories,
  act: () => Promise<void>,
): Promise<[string, FormDataEntryValue][]> => {
  const received: [string, FormDataEntryValue][][] = []
  await stories[story].run({
    args: {
      ...stories[story].args,
      onSubmit: vi.fn((values: FormData) => {
        received.push(Array.from(values.entries()))
      }),
    },
  })
  await act()
  await userEvent.click(screen.getByRole('button', { name: '保存する' }))

  return received.flat()
}

describe('HoursForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open every day of the week with its hours, and a closed day without them', async () => {
    // Act
    await stories.Whole.run()

    // Assert
    const monday = within(group('月曜日'))
    expect(monday.getByRole('radio', { name: '営業する' })).toBeChecked()
    expect(monday.getByLabelText('開店')).toHaveValue('10:00')
    expect(monday.getByLabelText('閉店')).toHaveValue('20:00')
    expect(monday.getByLabelText('休憩の始まり')).toHaveValue('13:00')
    expect(monday.getByLabelText('休憩の終わり')).toHaveValue('14:00')
    const saturday = within(group('土曜日'))
    expect(saturday.getByLabelText('開店')).toHaveValue('09:00')
    expect(saturday.getByLabelText('休憩の始まり')).toHaveValue('')
    const sunday = within(group('日曜日'))
    expect(sunday.getByRole('radio', { name: '休業' })).toBeChecked()
    expect(sunday.queryByLabelText('開店')).toBeNull()
  })

  it('should show the rows of the dates from today, and say that those before it are kept', async () => {
    // Act
    await stories.Whole.run()

    // Assert
    const first = within(group('1 行目'))
    expect(first.getByLabelText('日付')).toHaveValue('2026-11-23')
    expect(first.getByRole('radio', { name: '営業する' })).toBeChecked()
    expect(first.getByLabelText('開店')).toHaveValue('10:00')
    expect(first.getByLabelText('閉店')).toHaveValue('17:00')
    expect(first.getByRole('checkbox', { name: '祝日の営業' })).toBeChecked()
    expect(first.getByLabelText('祝日・休業日の名前')).toHaveValue(
      '勤労感謝の日',
    )
    expect(first.getByLabelText('備考')).toHaveValue('短縮営業')
    const second = within(group('2 行目'))
    expect(second.getByLabelText('日付')).toHaveValue('2026-12-31')
    expect(second.getByRole('radio', { name: '終日休業' })).toBeChecked()
    expect(second.queryByLabelText('開店')).toBeNull()
    expect(second.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('group', { name: '3 行目' })).toBeNull()
    expect(
      screen.getByText(
        '今日より前の日付（1 行）は、記録としてそのまま残ります。',
      ),
    ).toBeVisible()
  })

  it('should ask for the hours of a day once the salon opens on it', async () => {
    // Arrange
    await stories.Empty.run()
    const sunday = within(group('日曜日'))
    expect(sunday.getByRole('radio', { name: '休業' })).toBeChecked()

    // Act
    await userEvent.click(sunday.getByRole('radio', { name: '営業する' }))

    // Assert
    expect(sunday.getByLabelText('開店')).toHaveValue('')
    expect(sunday.getByLabelText('閉店')).toBeRequired()
    expect(sunday.getByLabelText('休憩の始まり')).not.toBeRequired()
    expect(screen.queryByText(/今日より前の日付/)).toBeNull()
  })

  it('should add a row of a date as a day off at the end, and give its date the focus', async () => {
    // Arrange
    await stories.Whole.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '日付の行を足す' }),
    )

    // Assert
    const third = within(group('3 行目'))
    expect(third.getByLabelText('日付')).toHaveFocus()
    expect(third.getByRole('radio', { name: '終日休業' })).toBeChecked()
    expect(third.queryByLabelText('開店')).toBeNull()
  })

  it('should ask for the hours of a date once the salon opens on it, and whether it is a holiday', async () => {
    // Arrange
    await stories.Whole.run()
    const second = within(group('2 行目'))

    // Act
    await userEvent.click(second.getByRole('radio', { name: '営業する' }))

    // Assert
    expect(second.getByLabelText('開店')).toBeRequired()
    expect(second.getByRole('checkbox', { name: '祝日の営業' })).toBeChecked()
  })

  it('should take a row away and give the focus to the button that adds one', async () => {
    // Arrange
    await stories.Whole.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '1 行目を外す' }))

    // Assert
    expect(within(group('1 行目')).getByLabelText('日付')).toHaveValue(
      '2026-12-31',
    )
    expect(screen.queryByRole('group', { name: '2 行目' })).toBeNull()
    expect(screen.getByRole('button', { name: '日付の行を足す' })).toHaveFocus()
  })

  it('should send every day of the week and every row of a date under the names of their controls', async () => {
    // Act
    const sent = await sentBy('Whole', async () => {
      await userEvent.click(
        within(group('土曜日')).getByRole('radio', { name: '休業' }),
      )
      await userEvent.click(
        screen.getByRole('button', { name: '日付の行を足す' }),
      )
      const third = within(group('3 行目'))
      await userEvent.type(third.getByLabelText('日付'), '2026-12-01')
      await userEvent.type(
        third.getByLabelText('祝日・休業日の名前'),
        '設備の点検',
      )
    })

    // Assert
    expect(sent.filter(([name]) => name.startsWith('saturday.'))).toEqual([
      ['saturday.opens', 'closed'],
    ])
    expect(sent.filter(([name]) => name.startsWith('monday.'))).toEqual([
      ['monday.opens', 'open'],
      ['monday.openTime', '10:00'],
      ['monday.closeTime', '20:00'],
      ['monday.breakStart', '13:00'],
      ['monday.breakEnd', '14:00'],
    ])
    expect(sent.filter(([name]) => name.startsWith('dates.'))).toEqual([
      ['dates.0.date', '2026-11-23'],
      ['dates.0.opens', 'open'],
      ['dates.0.openTime', '10:00'],
      ['dates.0.closeTime', '17:00'],
      ['dates.0.isHoliday', 'on'],
      ['dates.0.holidayName', '勤労感謝の日'],
      ['dates.0.notes', '短縮営業'],
      ['dates.1.date', '2026-12-31'],
      ['dates.1.opens', 'closed'],
      ['dates.1.holidayName', '年末年始'],
      ['dates.1.notes', ''],
      ['dates.2.date', '2026-12-01'],
      ['dates.2.opens', 'closed'],
      ['dates.2.holidayName', '設備の点検'],
      ['dates.2.notes', ''],
    ])
  })

  it('should say that a day has more hours than the form holds, and in which days hours are kept', async () => {
    // Act
    await stories.MoreThanTheFormHolds.run()

    // Assert
    const monday = within(group('月曜日'))
    expect(monday.getByLabelText('閉店')).toHaveValue('13:00')
    expect(
      monday.getByText(/最初の営業時間と最初の休憩だけが残ります。$/),
    ).toBeVisible()
    expect(
      within(group('土曜日')).getByText(
        /^この曜日の営業時間は、2026年4月1日.*から2027年3月31日.*までです。期間は、この画面では変えません。$/,
      ),
    ).toBeVisible()
    expect(within(group('火曜日')).queryByText(/期間/)).toBeNull()
  })

  it('should say what is wrong under the control it belongs to', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      within(group('月曜日')).getByLabelText('閉店'),
    ).toHaveAccessibleDescription(expect.stringContaining('開店より後の時刻'))
    expect(
      within(group('2 行目')).getByLabelText('日付'),
    ).toHaveAccessibleDescription(expect.stringContaining('1 行目と同じです'))
  })

  it('should hide the errors of the rows of dates once one was taken away, and keep those of the week', async () => {
    // Arrange
    await stories.WithErrors.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '1 行目を外す' }))

    // Assert
    expect(
      within(group('1 行目')).getByLabelText('日付'),
    ).not.toHaveAccessibleDescription(
      expect.stringContaining('1 行目と同じです'),
    )
    expect(
      within(group('月曜日')).getByLabelText('閉店'),
    ).toHaveAccessibleDescription(expect.stringContaining('開店より後の時刻'))
  })

  it('should say what went wrong with the attempt above the form', async () => {
    // Act
    await stories.ChangedMeanwhile.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'ほかのアカウントがこのサロンの営業時間を変えていました',
    )
  })
})
