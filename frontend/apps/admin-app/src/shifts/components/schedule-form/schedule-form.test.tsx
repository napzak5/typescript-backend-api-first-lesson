import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as scheduleFormStories from './schedule-form.stories'

const stories = composeStories(scheduleFormStories)

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

describe('ScheduleForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open every day of the week with its row: the hours of a day of work, the note of a day off', async () => {
    // Act
    await stories.Whole.run()

    // Assert
    const monday = within(group('月曜日'))
    expect(monday.getByRole('radio', { name: '勤務する' })).toBeChecked()
    expect(monday.getByLabelText('始まり')).toHaveValue('09:00')
    expect(monday.getByLabelText('終わり')).toHaveValue('20:00')
    expect(monday.getByLabelText('休憩の始まり')).toHaveValue('13:00')
    expect(monday.getByLabelText('休憩の終わり')).toHaveValue('14:00')
    const saturday = within(group('土曜日'))
    expect(saturday.getByLabelText('休憩の始まり')).toHaveValue('')
    const sunday = within(group('日曜日'))
    expect(sunday.getByRole('radio', { name: '勤務しない' })).toBeChecked()
    expect(sunday.queryByLabelText('始まり')).toBeNull()
    expect(sunday.getByLabelText('備考')).toHaveValue('定休日')
  })

  it('should show the rows of dates from today, and offer to remove those before it', async () => {
    // Act
    await stories.Whole.run()

    // Assert
    expect(screen.queryByRole('group', { name: '2 行目' })).toBeNull()
    const first = within(group('1 行目'))
    expect(first.getByLabelText('日付')).toHaveValue('2026-11-21')
    expect(first.getByRole('radio', { name: '勤務する' })).toBeChecked()
    expect(first.getByLabelText('始まり')).toHaveValue('12:00')
    expect(first.getByLabelText('備考')).toHaveValue('午前は講習')
    expect(
      screen.getByRole('checkbox', {
        name: '今日より前の日付の行（2 行）を消す',
      }),
    ).not.toBeChecked()
  })

  it('should ask for the hours of a day once the member works on it', async () => {
    // Arrange
    await stories.Empty.run()
    const sunday = within(group('日曜日'))

    // Act
    await userEvent.click(sunday.getByRole('radio', { name: '勤務する' }))

    // Assert
    expect(sunday.getByLabelText('始まり')).toHaveValue('')
    expect(sunday.getByLabelText('終わり')).toBeRequired()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('should add a row of a date as a day off at the end, and give its date the focus', async () => {
    // Arrange
    await stories.Whole.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '日付の行を足す' }),
    )

    // Assert
    const second = within(group('2 行目'))
    expect(second.getByLabelText('日付')).toHaveFocus()
    expect(second.getByRole('radio', { name: '休み' })).toBeChecked()
    expect(second.queryByLabelText('始まり')).toBeNull()
  })

  it('should take a row away and give the focus to the button that adds one', async () => {
    // Arrange
    await stories.Whole.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '1 行目を外す' }))

    // Assert
    expect(screen.queryByRole('group', { name: '1 行目' })).toBeNull()
    expect(screen.getByRole('button', { name: '日付の行を足す' })).toHaveFocus()
  })

  it('should send every day of the week and every row of a date under the names of their controls', async () => {
    // Act
    const sent = await sentBy('Whole', async () => {
      await userEvent.click(
        within(group('土曜日')).getByRole('radio', { name: '勤務しない' }),
      )
      await userEvent.click(
        screen.getByRole('button', { name: '日付の行を足す' }),
      )
      await userEvent.type(
        within(group('2 行目')).getByLabelText('日付'),
        '2026-12-24',
      )
      await userEvent.click(
        screen.getByRole('checkbox', {
          name: '今日より前の日付の行（2 行）を消す',
        }),
      )
    })

    // Assert
    expect(sent.filter(([name]) => name.startsWith('saturday.'))).toEqual([
      ['saturday.works', 'off'],
      ['saturday.notes', ''],
    ])
    expect(sent.filter(([name]) => name.startsWith('dates.'))).toEqual([
      ['dates.0.date', '2026-11-21'],
      ['dates.0.works', 'works'],
      ['dates.0.startTime', '12:00'],
      ['dates.0.endTime', '18:00'],
      ['dates.0.breakStartTime', ''],
      ['dates.0.breakEndTime', ''],
      ['dates.0.notes', '午前は講習'],
      ['dates.1.date', '2026-12-24'],
      ['dates.1.works', 'off'],
      ['dates.1.notes', ''],
    ])
    expect(sent.filter(([name]) => name === 'dropPast')).toHaveLength(1)
  })

  it('should say what is wrong under the control it belongs to', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      within(group('月曜日')).getByLabelText('終わり'),
    ).toHaveAccessibleDescription(expect.stringContaining('始まりより後の時刻'))
    expect(
      within(group('1 行目')).getByLabelText('日付'),
    ).toHaveAccessibleDescription(expect.stringContaining('ほかの行と同じ'))
  })

  it('should hide the errors of the rows of dates once one was taken away, and keep those of the week', async () => {
    // Arrange
    await stories.WithErrors.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '日付の行を足す' }),
    )
    await userEvent.click(screen.getByRole('button', { name: '2 行目を外す' }))

    // Assert
    expect(
      within(group('1 行目')).getByLabelText('日付'),
    ).not.toHaveAccessibleDescription(expect.stringContaining('ほかの行と同じ'))
    expect(
      within(group('月曜日')).getByLabelText('終わり'),
    ).toHaveAccessibleDescription(expect.stringContaining('始まりより後の時刻'))
  })

  it('should say what went wrong with the attempt above the form', async () => {
    // Act
    await stories.ChangedMeanwhile.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'ほかのアカウントがこの勤務スケジュールを変えていました',
    )
  })
})
