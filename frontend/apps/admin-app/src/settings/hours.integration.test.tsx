import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  salonIdOf,
  signInAs,
} from '@beauty-salon-frontend/testing/api'
import { heading, rowsOf } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, renderAt } from '../__tests__/screens'
import { hoursChangeHrefOf, settingsHrefOf } from '../navigation'
import { weekdayOf } from '../shifts/shift-week'
import {
  dayOffArranged,
  storedCalendarOf,
  storedSalonOf,
  storedWeekOf,
} from './__tests__/arrangements'

/*
 * The hours of a salon, changed against the API. The salon in Tokyo of
 * the seed data is open from 10:00 to 20:00 from Monday to Friday, to
 * 18:00 on Saturday, and closed on Sunday; its calendar has a date on each
 * of the seven days after the day of the seed, and three dates of 2024.
 * Its owner and its manager change its hours, its stylist does not.
 * Somebody did something meanwhile where a test says so.
 */

/** Waits for the form: its heading comes first, the form once the salon was read anew. */
const openedForm = async (): Promise<void> => {
  await heading('営業時間を直す')
  await screen.findByRole('group', { name: '月曜日' })
}

/** Opens the form of the hours of the salon in Tokyo, and waits for it. */
const openForm = async (email: string): Promise<void> => {
  await openAs(hoursChangeHrefOf(await salonIdOf(TOKYO)), email)
  await openedForm()
}

/** The group of a day of the week, or of a row of a date: 「月曜日」, 「1 行目」 */
const group = (name: string) => within(screen.getByRole('group', { name }))

/** Writes a time into a control that holds one. */
const writeTime = async (
  user: ReturnType<typeof userEvent.setup>,
  control: HTMLElement,
  time: string,
): Promise<void> => {
  await user.clear(control)
  await user.type(control, time)
}

const save = (): HTMLElement => screen.getByRole('button', { name: '保存する' })

/** The hours of a day of the week as the seed data and the form keep them */
const day = (
  dayOfWeek: string,
  hours: [string, string] | undefined,
  rest: [string, string] | undefined = undefined,
) => ({
  dayOfWeek,
  operatingSlots:
    hours === undefined ? [] : [{ startTime: hours[0], endTime: hours[1] }],
  breakSlots:
    rest === undefined ? null : [{ startTime: rest[0], endTime: rest[1] }],
  isClosed: hours === undefined,
  effectivePeriod: null,
})

/**
 * The dates of the calendar from today on, as the database keeps them:
 * the seed data puts them after the day it ran on, which may be a day
 * before today in Tokyo.
 */
const storedDatesFromToday = async () => {
  const today = await dayFromToday(0)

  return (await storedCalendarOf(TOKYO)).filter(({ date }) => date >= today)
}

const SEED_WEEK = [
  day('monday', ['10:00', '20:00']),
  day('tuesday', ['10:00', '20:00']),
  day('wednesday', ['10:00', '20:00']),
  day('thursday', ['10:00', '20:00']),
  day('friday', ['10:00', '20:00']),
  day('saturday', ['10:00', '18:00']),
  day('sunday', undefined),
]

describe('the hours of a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should let the manager change the week from the settings: a break, a closed day, a later closing', async () => {
    // Arrange
    const user = userEvent.setup()
    const calendar = await storedCalendarOf(TOKYO)
    await openAs(settingsHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await heading('サロンの設定')
    await user.click(
      await screen.findByRole('link', { name: '営業時間を直す' }),
    )
    await openedForm()
    const monday = group('月曜日')
    expect(monday.getByLabelText('開店')).toHaveValue('10:00')

    // Act
    await writeTime(user, monday.getByLabelText('休憩の始まり'), '13:00')
    await writeTime(user, monday.getByLabelText('休憩の終わり'), '14:00')
    await user.click(group('水曜日').getByRole('radio', { name: '休業' }))
    await writeTime(user, group('土曜日').getByLabelText('閉店'), '19:00')
    await user.click(save())

    // Assert
    expect(await heading('サロンの設定')).toHaveFocus()
    expect(
      await screen.findByText('営業時間を直しました。'),
    ).toBeInTheDocument()
    await screen.findByRole('table', { name: '営業時間' })
    expect(rowsOf('営業時間')).toEqual([
      ['月曜日', '10:00〜20:00（休憩 13:00〜14:00）'],
      ['火曜日', '10:00〜20:00'],
      ['水曜日', '休業'],
      ['木曜日', '10:00〜20:00'],
      ['金曜日', '10:00〜20:00'],
      ['土曜日', '10:00〜19:00'],
      ['日曜日', '休業'],
    ])
    expect(await storedWeekOf(TOKYO)).toEqual([
      day('monday', ['10:00', '20:00'], ['13:00', '14:00']),
      day('tuesday', ['10:00', '20:00']),
      day('wednesday', undefined),
      day('thursday', ['10:00', '20:00']),
      day('friday', ['10:00', '20:00']),
      day('saturday', ['10:00', '19:00']),
      day('sunday', undefined),
    ])
    expect(await storedCalendarOf(TOKYO)).toEqual(calendar)
  })

  it('should add a day off and a holiday the salon opens on, and keep the dates before today', async () => {
    // Arrange
    const user = userEvent.setup()
    const inspection = await dayFromToday(10)
    const holiday = await dayFromToday(12)
    const calendar = await storedCalendarOf(TOKYO)
    await openForm(OWNER)
    expect(screen.getAllByRole('group', { name: /^\d+ 行目$/ })).toHaveLength(7)
    expect(
      screen.getByText(
        '今日より前の日付（3 行）は、記録としてそのまま残ります。',
      ),
    ).toBeInTheDocument()

    // Act
    await user.click(screen.getByRole('button', { name: '日付の行を足す' }))
    const eighth = group('8 行目')
    await user.type(eighth.getByLabelText('日付'), inspection)
    await user.type(eighth.getByLabelText('祝日・休業日の名前'), '臨時休業')
    await user.type(eighth.getByLabelText('備考'), '設備の点検')
    await user.click(screen.getByRole('button', { name: '日付の行を足す' }))
    const ninth = group('9 行目')
    await user.type(ninth.getByLabelText('日付'), holiday)
    await user.click(ninth.getByRole('radio', { name: '営業する' }))
    await writeTime(user, ninth.getByLabelText('開店'), '10:00')
    await writeTime(user, ninth.getByLabelText('閉店'), '15:00')
    await user.click(ninth.getByRole('checkbox', { name: '祝日の営業' }))
    await user.type(ninth.getByLabelText('祝日・休業日の名前'), '振替休日')
    await user.click(save())

    // Assert
    expect(await heading('サロンの設定')).toHaveFocus()
    await screen.findByRole('table', { name: '営業日カレンダー' })
    expect(rowsOf('営業日カレンダー')).toEqual(
      expect.arrayContaining([
        [dayNameOf(inspection), '終日休業', '臨時休業', '設備の点検'],
        [dayNameOf(holiday), '10:00〜15:00', '振替休日', '記録なし'],
      ]),
    )
    const stored = await storedCalendarOf(TOKYO)
    expect(stored).toEqual(
      [
        ...calendar,
        {
          date: inspection,
          dayOfWeek: weekdayOf(inspection),
          openTime: null,
          closeTime: null,
          isHoliday: true,
          holidayName: '臨時休業',
          notes: '設備の点検',
        },
        {
          date: holiday,
          dayOfWeek: weekdayOf(holiday),
          openTime: '10:00:00',
          closeTime: '15:00:00',
          isHoliday: true,
          holidayName: '振替休日',
          notes: null,
        },
      ].toSorted((one, other) => one.date.localeCompare(other.date)),
    )
    expect(stored.filter(({ date }) => date.startsWith('2024-'))).toHaveLength(
      3,
    )
    expect(await storedWeekOf(TOKYO)).toEqual(SEED_WEEK)
  })

  it('should close a date that was open, and take another away', async () => {
    // Arrange
    const user = userEvent.setup()
    const [closed, removed] = (await storedDatesFromToday()).map(
      ({ date }) => date,
    )
    const calendar = await storedCalendarOf(TOKYO)
    await openForm(MANAGER)
    expect(group('2 行目').getByLabelText('日付')).toHaveValue(removed)

    // Act
    const first = group('1 行目')
    expect(first.getByLabelText('日付')).toHaveValue(closed)
    await user.click(first.getByRole('radio', { name: '終日休業' }))
    await user.type(first.getByLabelText('祝日・休業日の名前'), '研修')
    await user.click(screen.getByRole('button', { name: '2 行目を外す' }))
    await user.click(save())

    // Assert
    expect(await heading('サロンの設定')).toHaveFocus()
    expect(await storedCalendarOf(TOKYO)).toEqual(
      calendar.flatMap((row) =>
        row.date === removed
          ? []
          : row.date === closed
            ? [
                {
                  ...row,
                  openTime: null,
                  closeTime: null,
                  isHoliday: true,
                  holidayName: '研修',
                },
              ]
            : [row],
      ),
    )
  })

  it('should ask the API for nothing when nothing was changed', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedSalonOf(TOKYO)
    await openForm(OWNER)

    // Act
    await user.click(save())

    // Assert
    expect(await heading('サロンの設定')).toHaveFocus()
    expect(
      await screen.findByText('変更された項目はありません。'),
    ).toBeInTheDocument()
    expect(await storedSalonOf(TOKYO)).toEqual(before)
  })

  it('should say what is wrong at the controls before sending, and ask the API for nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedSalonOf(TOKYO)
    const yesterday = await dayFromToday(-1)
    const [twice] = await storedDatesFromToday()
    await openForm(MANAGER)
    const close = group('火曜日').getByLabelText('閉店')
    await writeTime(user, close, '09:00')
    await writeTime(
      user,
      group('火曜日').getByLabelText('休憩の始まり'),
      '12:00',
    )
    await user.click(screen.getByRole('button', { name: '日付の行を足す' }))
    await user.type(group('8 行目').getByLabelText('日付'), yesterday)
    await user.click(screen.getByRole('button', { name: '日付の行を足す' }))
    await user.type(group('9 行目').getByLabelText('日付'), twice?.date ?? '')

    // Act
    await user.click(save())

    // Assert
    await waitFor(() => expect(close).toHaveFocus())
    expect(close).toHaveAccessibleDescription(
      expect.stringContaining('閉店は、開店より後の時刻にしてください。'),
    )
    expect(
      group('火曜日').getByLabelText('休憩の終わり'),
    ).toHaveAccessibleDescription(
      expect.stringContaining('休憩の終わりの時刻も入力してください。'),
    )
    expect(group('8 行目').getByLabelText('日付')).toHaveAccessibleDescription(
      expect.stringContaining('今日か、今日より後の日付を入力してください。'),
    )
    expect(group('9 行目').getByLabelText('日付')).toHaveAccessibleDescription(
      expect.stringContaining('この日付は、1 行目と同じです。'),
    )
    expect(await storedSalonOf(TOKYO)).toEqual(before)
  })

  it('should not replace hours another account changed while the form was open, until it is sent again', async () => {
    // Arrange
    const user = userEvent.setup()
    const meanwhile = await dayFromToday(3)
    const calendar = await storedCalendarOf(TOKYO)
    await openForm(MANAGER)
    await dayOffArranged(TOKYO, meanwhile)
    await writeTime(user, group('土曜日').getByLabelText('閉店'), '19:00')
    await user.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'その間に、ほかのアカウントがこのサロンの営業時間を変えていました。',
    )
    expect(await storedWeekOf(TOKYO)).toEqual(SEED_WEEK)
    expect(
      (await storedCalendarOf(TOKYO)).find(({ date }) => date === meanwhile),
    ).toMatchObject({ holidayName: '臨時休業', openTime: null })

    // Act
    await user.click(save())

    // Assert: the form replaced the hours as they were then, its calendar among them
    expect(await heading('サロンの設定')).toHaveFocus()
    expect(await storedWeekOf(TOKYO)).toEqual(
      SEED_WEEK.map((entry) =>
        entry.dayOfWeek === 'saturday'
          ? day('saturday', ['10:00', '19:00'])
          : entry,
      ),
    )
    expect(await storedCalendarOf(TOKYO)).toEqual(calendar)
  })

  it('should refuse a stylist the form, and offer no change in the settings', async () => {
    // Act
    await openAs(hoursChangeHrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'このアカウントでは、サロンの設定を変えられません。設定を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: '設定へ戻る' }))
    await screen.findByRole('table', { name: '営業時間' })
    expect(
      screen.queryByRole('link', { name: '営業時間を直す' }),
    ).not.toBeInTheDocument()
  })

  it('should tell the manager of another salon that its hours are not theirs to change', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedSalonOf(OSAKA)
    await openAs(hoursChangeHrefOf(await salonIdOf(OSAKA)), MANAGER)
    await openedForm()
    await user.click(group('日曜日').getByRole('radio', { name: '休業' }))

    // Act
    await user.click(save())

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このサロンの営業時間は、変えられません。営業時間を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    )
    expect(await storedSalonOf(OSAKA)).toEqual(before)
  })

  it('should have no accessibility violations on the form', async () => {
    // Arrange
    const { container } = renderAt(hoursChangeHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)

    // Act
    await openedForm()

    // Assert
    expect(await findAccessibilityViolations(container)).toEqual([])
  })
})
