import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayoutEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import {
  dayFromToday,
  MANAGER,
  OWNER,
  STYLIST,
  salonIdOf,
  signInAs,
  THERAPIST,
  TOKYO,
} from '../bookings/__tests__/arrangements'
import {
  scheduleChangeHrefOf,
  scheduleHrefOf,
  shiftsHrefOf,
  shiftWeekHrefOf,
  staffMemberHrefOf,
} from '../navigation'
import { dayAfter, dayNameOf } from '../salon-time'
import {
  arrangeInactive,
  arrangeLedgerOrder,
  arrangeMembers,
  arrangeOwnerAccount,
  crowdIdOf,
  removedMeanwhile,
  SUZUKI,
  staffIdOf,
  TANAKA,
  WATANABE,
} from '../staff/__tests__/arrangements'
import {
  arrangeDateRow,
  scheduleRowIdsOf,
  storedScheduleOf,
} from './__tests__/arrangements'
import { mondayOf, weekNameOf } from './shift-week'

/*
 * The shifts of the salon in Tokyo: the schedules of the seed data (Hiroshi
 * Tanaka and Mika Suzuki work from Monday to Saturday), and the rows of
 * dates a test arranges. The weeks are those of today at the salon, or
 * weeks after it, so that the rows of dates a test arranges are shown.
 */

const TITLE = 'Beauty Salon Admin'

/** The path a screen was opened at, and what the page showed in the commit that opened it */
let firstSight: [string, string] = ['', '']

const FirstSight = () => {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    firstSight = [pathname, document.querySelector('main')?.textContent ?? '']
  }, [pathname])

  return null
}

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
        <FirstSight />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const heading = (name: string) =>
  screen.findByRole('heading', { level: 1, name })

/** What the application says in its notifications. */
const notifications = (): string[] =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent ?? '')
    .filter((said) => said !== '')

/** The name of the table of the shifts of a week */
const weekTableOf = (monday: string): string => `${weekNameOf(monday)}のシフト`

/** The rows of a table, cell by cell, the header of the row first. */
const rowsOf = (caption: string): string[][] =>
  within(screen.getByRole('table', { name: caption }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).queryAllByRole('rowheader'),
        ...within(row).queryAllByRole('cell'),
      ].map((cell) => cell.textContent ?? ''),
    )

/** A day of the week, or a row of a date, of the form */
const group = (name: string): HTMLElement => screen.getByRole('group', { name })

const WEEKDAY = '09:00〜20:00休憩 13:00〜14:00'
const SATURDAY = '10:00〜18:00休憩 13:00〜14:00'
const NO_WORK = '勤務なし'

/** What the schedule of Tanaka and Suzuki in the seed data says of the days of a week */
const SEED_WEEK = [
  WEEKDAY,
  WEEKDAY,
  WEEKDAY,
  WEEKDAY,
  WEEKDAY,
  SATURDAY,
  NO_WORK,
]

const NO_WEEK = Array.from({ length: 7 }, () => NO_WORK)

/** The weekly rows of the seed data as the database keeps them */
const SEED_ROWS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
].map((dayOfWeek) => ({
  dayOfWeek,
  date: null,
  startTime: dayOfWeek === 'saturday' ? '10:00:00' : '09:00:00',
  endTime: dayOfWeek === 'saturday' ? '18:00:00' : '20:00:00',
  breakStartTime: '13:00:00',
  breakEndTime: '14:00:00',
  isRecurring: true,
  isAvailable: true,
  notes: null,
}))

/** A row of a date as the database keeps a day off */
const storedDayOff = (date: string, notes: string | null) => ({
  dayOfWeek: null,
  date,
  startTime: null,
  endTime: null,
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: false,
  isAvailable: false,
  notes,
})

/** Writes a time into a control that holds one. */
const writeTime = async (
  user: ReturnType<typeof userEvent.setup>,
  control: HTMLElement,
  time: string,
): Promise<void> => {
  await user.clear(control)
  await user.type(control, time)
}

/** Opens the form of the schedule of a member as the manager, and waits for it. */
const openChange = async (staffCode: string): Promise<string> => {
  const salonId = await salonIdOf(TOKYO)
  renderAt(scheduleChangeHrefOf(salonId, await staffIdOf(staffCode)))
  await signInAs(MANAGER)
  await screen.findByRole('group', { name: '月曜日' })

  return salonId
}

describe('the shifts, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', TITLE)
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should show who works when in a week: the row of a date on its day, the weekly row on the others, and no inactive member', async () => {
    // Arrange
    await arrangeLedgerOrder()
    await arrangeInactive(WATANABE)
    const salonId = await salonIdOf(TOKYO)
    const monday = mondayOf(await dayFromToday(14))
    await arrangeDateRow(TANAKA, {
      date: dayAfter(monday, 2),
      hours: undefined,
      notes: '研修',
    })
    await arrangeDateRow(SUZUKI, {
      date: dayAfter(monday, 3),
      hours: ['12:00', '16:00'],
      notes: '講習',
    })

    // Act
    renderAt(shiftWeekHrefOf(salonId, monday))
    await signInAs(MANAGER)

    // Assert
    expect(await heading('シフト')).toHaveFocus()
    await screen.findByRole('table', { name: weekTableOf(monday) })
    expect(rowsOf(weekTableOf(monday))).toEqual([
      ['Akiko Mori', ...NO_WEEK],
      ['Kenji Sato', ...NO_WEEK],
      [
        'Hiroshi Tanaka',
        WEEKDAY,
        WEEKDAY,
        '休み研修（この日だけ）',
        WEEKDAY,
        WEEKDAY,
        SATURDAY,
        NO_WORK,
      ],
      [
        'Mika Suzuki',
        WEEKDAY,
        WEEKDAY,
        WEEKDAY,
        '12:00〜16:00（この日だけ）',
        WEEKDAY,
        SATURDAY,
        NO_WORK,
      ],
    ])
    expect(
      screen.getByRole('link', { name: 'Hiroshi Tanaka' }),
    ).toHaveAttribute('href', scheduleHrefOf(salonId, await staffIdOf(TANAKA)))
    expect(
      within(
        screen.getByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: 'シフト' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('should open on the week of today at the salon', async () => {
    // Arrange
    const thisWeek = mondayOf(await dayFromToday(0))

    // Act
    renderAt(shiftsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)

    // Assert
    await screen.findByRole('table', { name: weekTableOf(thisWeek) })
    expect(rowsOf(weekTableOf(thisWeek))).toContainEqual([
      'Mika Suzuki',
      ...SEED_WEEK,
    ])
  })

  it.each<[string, number, number]>([
    ['次の週', 0, 1],
    ['前の週', 0, -1],
    ['今週', 2, 0],
  ])(
    'should move to the week 「%s」 leads to',
    async (link, shownWeeks, movedWeeks) => {
      // Arrange
      const user = userEvent.setup()
      const salonId = await salonIdOf(TOKYO)
      const thisWeek = mondayOf(await dayFromToday(0))
      const shown = dayAfter(thisWeek, 7 * shownWeeks)
      renderAt(shiftWeekHrefOf(salonId, shown))
      await signInAs(OWNER)
      await screen.findByRole('table', { name: weekTableOf(shown) })

      // Act
      await user.click(screen.getByRole('link', { name: link }))

      // Assert
      expect(
        await screen.findByRole('table', {
          name: weekTableOf(dayAfter(thisWeek, 7 * movedWeeks)),
        }),
      ).toBeVisible()
    },
  )

  it('should show a member of the staff their own row, and their schedule without the way to change it', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const monday = mondayOf(await dayFromToday(14))
    renderAt(shiftWeekHrefOf(salonId, monday))
    await signInAs(STYLIST)
    await screen.findByRole('table', { name: weekTableOf(monday) })
    expect(rowsOf(weekTableOf(monday))).toEqual([
      ['Hiroshi Tanaka', ...SEED_WEEK],
    ])

    // Act
    await user.click(screen.getByRole('link', { name: 'Hiroshi Tanaka' }))

    // Assert
    expect(await heading('勤務スケジュール')).toHaveFocus()
    expect(await screen.findByText('Hiroshi Tanaka さん')).toBeVisible()
    await screen.findByRole('table', { name: '毎週' })
    expect(
      screen.queryByRole('link', { name: '勤務スケジュールを直す' }),
    ).toBeNull()
    expect(
      within(
        screen.getByRole('navigation', { name: 'メインメニュー' }),
      ).getByRole('link', { name: 'シフト' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('should not show a member of the staff the schedule of another, nor the form of their own', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    renderAt(scheduleHrefOf(salonId, await staffIdOf(SUZUKI)))
    await signInAs(STYLIST)

    // Act
    const refused =
      await screen.findByText(/^この勤務スケジュールは、見られません。/)

    // Assert
    expect(refused).toBeVisible()
    expect(screen.queryByText('Mika Suzuki さん')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should tell a member of the staff that the form of their schedule is not theirs to send', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const tanaka = await staffIdOf(TANAKA)

    // Act
    renderAt(scheduleChangeHrefOf(salonId, tanaka))
    await signInAs(STYLIST)

    // Assert
    expect(
      await screen.findByText(
        /^このアカウントでは、勤務スケジュールを直せません。/,
      ),
    ).toBeVisible()
    expect(screen.queryByRole('group', { name: '月曜日' })).toBeNull()
    expect(
      screen.getByRole('link', { name: '勤務スケジュールへ' }),
    ).toHaveAttribute('href', scheduleHrefOf(salonId, tanaka))
  })

  it('should show the schedule of a member: every day of the week, the rows of dates from today, and how many are before it', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)
    const tanaka = await staffIdOf(TANAKA)
    const soon = await dayFromToday(3)
    const later = await dayFromToday(10)
    await arrangeDateRow(TANAKA, {
      date: later,
      hours: ['12:00', '16:00'],
      notes: null,
    })
    await arrangeDateRow(TANAKA, {
      date: soon,
      hours: undefined,
      notes: '有給休暇',
    })
    await arrangeDateRow(TANAKA, {
      date: await dayFromToday(-3),
      hours: undefined,
      notes: null,
    })

    // Act
    renderAt(scheduleHrefOf(salonId, tanaka))
    await signInAs(MANAGER)

    // Assert
    expect(await heading('勤務スケジュール')).toHaveFocus()
    await screen.findByRole('table', { name: '毎週' })
    expect(screen.getByText('Hiroshi Tanaka さん')).toBeVisible()
    expect(rowsOf('毎週')).toEqual([
      ['月曜日', '09:00〜20:00', '13:00〜14:00', ''],
      ['火曜日', '09:00〜20:00', '13:00〜14:00', ''],
      ['水曜日', '09:00〜20:00', '13:00〜14:00', ''],
      ['木曜日', '09:00〜20:00', '13:00〜14:00', ''],
      ['金曜日', '09:00〜20:00', '13:00〜14:00', ''],
      ['土曜日', '10:00〜18:00', '13:00〜14:00', ''],
      ['日曜日', '勤務なし', '', ''],
    ])
    expect(rowsOf('日付ごと')).toEqual([
      [dayNameOf(soon), '休み', '', '有給休暇'],
      [dayNameOf(later), '12:00〜16:00', 'なし', ''],
    ])
    expect(
      screen.getByText('今日より前の日付の行が、ほかに 1 行あります。'),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: '勤務スケジュールを直す' }),
    ).toHaveAttribute('href', scheduleChangeHrefOf(salonId, tanaka))
  })

  it('should save the hours of the week and a day off of a date, and show the schedule saved at once', async () => {
    // Arrange
    const user = userEvent.setup()
    const leave = await dayFromToday(20)
    await openChange(WATANABE)
    const monday = within(group('月曜日'))
    await user.click(monday.getByRole('radio', { name: '勤務する' }))
    await writeTime(user, monday.getByLabelText('始まり'), '10:00')
    await writeTime(user, monday.getByLabelText('終わり'), '19:00')
    await writeTime(user, monday.getByLabelText('休憩の始まり'), '12:00')
    await writeTime(user, monday.getByLabelText('休憩の終わり'), '13:00')
    await user.type(within(group('日曜日')).getByLabelText('備考'), '定休日')
    await user.click(screen.getByRole('button', { name: '日付の行を足す' }))
    await user.type(within(group('1 行目')).getByLabelText('日付'), leave)
    await user.type(within(group('1 行目')).getByLabelText('備考'), '有給休暇')

    // Act
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await heading('勤務スケジュール')).toHaveFocus()
    expect(notifications()).toContain(
      'Yui Watanabe さんの勤務スケジュールを保存しました。',
    )
    expect(await storedScheduleOf(WATANABE)).toEqual([
      {
        dayOfWeek: 'monday',
        date: null,
        startTime: '10:00:00',
        endTime: '19:00:00',
        breakStartTime: '12:00:00',
        breakEndTime: '13:00:00',
        isRecurring: true,
        isAvailable: true,
        notes: null,
      },
      {
        dayOfWeek: 'sunday',
        date: null,
        startTime: null,
        endTime: null,
        breakStartTime: null,
        breakEndTime: null,
        isRecurring: true,
        isAvailable: false,
        notes: '定休日',
      },
      storedDayOff(leave, '有給休暇'),
    ])
    // The schedule read before it was saved is not shown
    expect(firstSight[1]).toContain('有給休暇')
    expect(rowsOf('毎週')[0]).toEqual([
      '月曜日',
      '10:00〜19:00',
      '12:00〜13:00',
      '',
    ])
  })

  it('should say what is wrong at the controls before sending, and save nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const day = await dayFromToday(5)
    await openChange(TANAKA)
    const end = within(group('月曜日')).getByLabelText('終わり')
    await writeTime(user, end, '08:00')
    await user.click(screen.getByRole('button', { name: '日付の行を足す' }))
    await user.type(within(group('1 行目')).getByLabelText('日付'), day)
    await user.click(screen.getByRole('button', { name: '日付の行を足す' }))
    await user.type(within(group('2 行目')).getByLabelText('日付'), day)

    // Act
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    await waitFor(() => expect(end).toHaveFocus())
    expect(end).toHaveAccessibleDescription(
      expect.stringContaining('始まりより後の時刻'),
    )
    expect(
      within(group('2 行目')).getByLabelText('日付'),
    ).toHaveAccessibleDescription(
      expect.stringContaining('この日付は、1 行目と同じです。'),
    )
    expect(await storedScheduleOf(TANAKA)).toEqual(SEED_ROWS)
  })

  it('should not replace a schedule another account changed while the form was open, until it is sent again', async () => {
    // Arrange
    const user = userEvent.setup()
    const training = await dayFromToday(6)
    await openChange(TANAKA)
    await arrangeDateRow(TANAKA, {
      date: training,
      hours: undefined,
      notes: '研修',
    })
    await writeTime(
      user,
      within(group('月曜日')).getByLabelText('始まり'),
      '10:00',
    )
    await user.click(screen.getByRole('button', { name: '保存する' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'ほかのアカウントがこの勤務スケジュールを変えていました',
    )
    expect(await storedScheduleOf(TANAKA)).toEqual([
      ...SEED_ROWS,
      storedDayOff(training, '研修'),
    ])

    // Act
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await heading('勤務スケジュール')).toHaveFocus()
    expect(await storedScheduleOf(TANAKA)).toEqual(
      SEED_ROWS.map((row) =>
        row.dayOfWeek === 'monday' ? { ...row, startTime: '10:00:00' } : row,
      ),
    )
  })

  it('should ask the API for nothing when the form is sent as it was opened', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await scheduleRowIdsOf(TANAKA)
    await openChange(TANAKA)

    // Act
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await heading('勤務スケジュール')).toHaveFocus()
    expect(notifications()).toContain('変更はありませんでした。')
    expect(await scheduleRowIdsOf(TANAKA)).toEqual(before)
  })

  it.each<[string, boolean]>([
    ['keep the rows of the days before today', false],
    ['remove the rows of the days before today when told to', true],
  ])('should %s', async (_, dropped) => {
    // Arrange
    const user = userEvent.setup()
    const past = await dayFromToday(-3)
    await arrangeDateRow(TANAKA, { date: past, hours: undefined, notes: null })
    await openChange(TANAKA)
    await user.type(within(group('月曜日')).getByLabelText('備考'), '朝礼あり')
    if (dropped) {
      await user.click(
        screen.getByRole('checkbox', {
          name: '今日より前の日付の行（1 行）を消す',
        }),
      )
    }

    // Act
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await heading('勤務スケジュール')).toHaveFocus()
    const stored = await storedScheduleOf(TANAKA)
    expect(stored[0]?.notes).toBe('朝礼あり')
    expect(stored.slice(6)).toEqual(dropped ? [] : [storedDayOff(past, null)])
  })

  it('should let the owner plan the schedule of an inactive member from the staff ledger', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeInactive(WATANABE)
    const salonId = await salonIdOf(TOKYO)
    renderAt(staffMemberHrefOf(salonId, await staffIdOf(WATANABE)))
    await signInAs(OWNER)
    await user.click(
      await screen.findByRole('link', { name: '勤務スケジュール' }),
    )
    expect(
      await screen.findByText(
        /^無効なスタッフです。有効に戻すまで、シフトには出ません。/,
      ),
    ).toBeVisible()
    await user.click(
      screen.getByRole('link', { name: '勤務スケジュールを直す' }),
    )
    const friday = within(await screen.findByRole('group', { name: '金曜日' }))
    await user.click(friday.getByRole('radio', { name: '勤務する' }))
    await writeTime(user, friday.getByLabelText('始まり'), '11:00')
    await writeTime(user, friday.getByLabelText('終わり'), '17:00')

    // Act
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await heading('勤務スケジュール')).toHaveFocus()
    expect(await storedScheduleOf(WATANABE)).toEqual([
      {
        dayOfWeek: 'friday',
        date: null,
        startTime: '11:00:00',
        endTime: '17:00:00',
        breakStartTime: null,
        breakEndTime: null,
        isRecurring: true,
        isAvailable: true,
        notes: null,
      },
    ])
  })

  it('should say that the member is not found when they were removed while the form was open', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangeMembers(1)
    const staffId = await crowdIdOf(1)
    renderAt(scheduleChangeHrefOf(await salonIdOf(TOKYO), staffId))
    await signInAs(MANAGER)
    const monday = within(await screen.findByRole('group', { name: '月曜日' }))
    await removedMeanwhile(staffId)
    await user.click(monday.getByRole('radio', { name: '勤務する' }))
    await writeTime(user, monday.getByLabelText('始まり'), '10:00')
    await writeTime(user, monday.getByLabelText('終わり'), '18:00')

    // Act
    await user.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(await heading('スタッフが見つかりません')).toBeVisible()
  })

  it.each<[string, (salonId: string) => Promise<string>, RegExp]>([
    [
      'the shifts',
      async (salonId) => shiftsHrefOf(salonId),
      /^このサロンのシフトは、見られません。/,
    ],
    [
      'the schedule of a member',
      async (salonId) => scheduleHrefOf(salonId, await staffIdOf(TANAKA)),
      /^この勤務スケジュールは、見られません。/,
    ],
  ])(
    'should tell the owner of another salon that %s of the salon are not theirs to see',
    async (_, hrefOf, refusal) => {
      // Arrange
      await arrangeOwnerAccount(THERAPIST)

      // Act
      renderAt(await hrefOf(await salonIdOf(TOKYO)))
      await signInAs(THERAPIST)

      // Assert
      expect(await screen.findByText(refusal)).toBeVisible()
      expect(screen.queryByRole('table')).toBeNull()
    },
  )

  it.each<
    [string, (salonId: string) => Promise<string>, () => Promise<unknown>]
  >([
    [
      'the shifts of a week',
      async (salonId) => shiftsHrefOf(salonId),
      () => screen.findByRole('link', { name: 'Hiroshi Tanaka' }),
    ],
    [
      'the schedule of a member',
      async (salonId) => scheduleHrefOf(salonId, await staffIdOf(TANAKA)),
      () => screen.findByRole('table', { name: '日付ごと' }),
    ],
    [
      'the change of a schedule',
      async (salonId) => scheduleChangeHrefOf(salonId, await staffIdOf(TANAKA)),
      () => screen.findByRole('group', { name: '日曜日' }),
    ],
  ])('should be accessible on %s', async (_, hrefOf, shown) => {
    // Arrange
    renderAt(await hrefOf(await salonIdOf(TOKYO)))
    await signInAs(MANAGER)

    // Act
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})
