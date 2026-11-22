import { MANAGER } from '@beauty-salon-frontend/testing/seed'
import type { Locator } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { MIKA, salonId, staffId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { mainMenuLink } from './main-menu'
import { enterCredentials, heading } from './sign-in'

/*
 * The shifts of a salon as its manager plans them, with the keyboard
 * alone: the schedule of a member is opened from the table of a week,
 * the hours of a day of the week are changed, a day off is put in on a
 * date, and the week shows them. In the seed data, Mika Suzuki works from
 * Monday to Friday from 9 to 20 and on Saturday from 10 to 18, with a
 * break from 13 to 14.
 */

const daySchema = z.tuple([z.object({ day: z.string() })])

/** The Monday of the week so many weeks after this week at the salon. */
const mondayAfter = async (api: TestApi, weeks: number): Promise<string> => {
  const [{ day }] = daySchema.parse(
    await api.query(
      `select to_char(date_trunc('week', (now() at time zone 'Asia/Tokyo')::date + $1::int * 7)::date,
                      'YYYY-MM-DD') as day`,
      [weeks],
    ),
  )

  return day
}

/** The day so many days after another. */
const dayAfter = (day: string, days: number): string => {
  const moment = new Date(`${day}T00:00:00Z`)
  moment.setUTCDate(moment.getUTCDate() + days)

  return moment.toISOString().slice(0, 10)
}

/** The heading of the column of a Monday in the table of its week: 「11/23（月）」. */
const mondayColumnOf = (monday: string): string => {
  const moment = new Date(`${monday}T00:00:00Z`)

  return `${moment.getUTCMonth() + 1}/${moment.getUTCDate()}（月）`
}

const storedSchema = z.array(
  z.object({
    dayOfWeek: z.string().nullable(),
    date: z.string().nullable(),
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    isAvailable: z.boolean(),
    notes: z.string().nullable(),
  }),
)

/** The schedule of a member as the database of the API keeps it, in the order the API lists it. */
const storedScheduleOf = async (api: TestApi, staffCode: string) =>
  storedSchema.parse(
    await api.query(
      `select "dayOfWeek"::text as "dayOfWeek", date::text as date,
              "startTime"::text as "startTime", "endTime"::text as "endTime", "isAvailable", notes
       from staff_schedules
       where "staffId" = (select id from staff where "staffCode" = $1)
       order by "isRecurring" desc, staff_schedules."dayOfWeek", staff_schedules.date`,
      [staffCode],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Chooses a radio button, or ticks a checkbox, with the keyboard. */
const chooseWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Space')
}

/** Writes into a control after moving the focus to it. */
const writeInto = async (control: Locator, value: string): Promise<void> => {
  await control.focus()
  await control.fill(value)
}

/** The cells of the row of a member in the table of a week, from Monday. */
const weekRowOf = async (week: Locator, name: string): Promise<string[]> => {
  const row = week.getByRole('row', { name: new RegExp(`^${name}`) })

  return row
    .getByRole('cell')
    .evaluateAll((cells) => cells.map((cell) => cell.textContent ?? ''))
}

const WEEKDAY = '09:00〜20:00休憩 13:00〜14:00'

test.describe('the shifts, in a browser', () => {
  test('should change the hours of a member and put in a day off, with the keyboard, and show them in the week', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const monday = await mondayAfter(api, 2)
    const wednesday = dayAfter(monday, 2)
    await page.goto(`${ADMIN.origin}/salons/${salon}/shifts?week=${monday}`)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(page.getByRole('table')).toBeVisible()

    // Act: the schedule of the member, from the week
    await pressWithTheKeyboard(page.getByRole('link', { name: MIKA }))

    // Assert
    await expect(heading(page, '勤務スケジュール')).toBeFocused()
    await expect(page.getByText(`${MIKA} さん`)).toBeVisible()

    // Act: Mondays end earlier, Saturdays are off, and a training on a Wednesday
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '勤務スケジュールを直す' }),
    )
    await expect(heading(page, '勤務スケジュールを直す')).toBeFocused()
    await writeInto(
      page
        .getByRole('group', { name: '月曜日' })
        .getByLabel('終わり', { exact: true }),
      '18:00',
    )
    await chooseWithTheKeyboard(
      page
        .getByRole('group', { name: '土曜日' })
        .getByRole('radio', { name: '勤務しない' }),
    )
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '日付の行を足す' }),
    )
    const added = page.getByRole('group', { name: '1 行目' })
    await expect(added.getByLabel('日付')).toBeFocused()
    await writeInto(added.getByLabel('日付'), wednesday)
    await writeInto(added.getByLabel('備考'), '研修')
    await pressWithTheKeyboard(page.getByRole('button', { name: '保存する' }))

    // Assert
    await expect(
      page.getByText(`${MIKA} さんの勤務スケジュールを保存しました。`),
    ).toBeVisible()
    await expect(heading(page, '勤務スケジュール')).toBeFocused()
    expect(await storedScheduleOf(api, 'STF002')).toEqual([
      ...['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(
        (dayOfWeek) => ({
          dayOfWeek,
          date: null,
          startTime: '09:00:00',
          endTime: dayOfWeek === 'monday' ? '18:00:00' : '20:00:00',
          isAvailable: true,
          notes: null,
        }),
      ),
      {
        dayOfWeek: null,
        date: wednesday,
        startTime: null,
        endTime: null,
        isAvailable: false,
        notes: '研修',
      },
    ])

    // Act: the week, through the header
    await pressWithTheKeyboard(mainMenuLink(page, 'シフト'))
    // The link is pressed again once the week it led to is shown: the address changes before the screen does
    for (const shown of [dayAfter(monday, -7), monday]) {
      await pressWithTheKeyboard(page.getByRole('link', { name: '次の週' }))
      await expect(
        page.getByRole('columnheader', {
          name: mondayColumnOf(shown),
          exact: true,
        }),
      ).toBeVisible()
    }

    // Assert: the row of the date is shown on its day alone, in the week it is of
    const week = page.getByRole('table', { name: /のシフト$/ })
    await expect
      .poll(() => weekRowOf(week, MIKA))
      .toEqual([
        '09:00〜18:00休憩 13:00〜14:00',
        WEEKDAY,
        '休み研修（この日だけ）',
        WEEKDAY,
        WEEKDAY,
        '勤務なし',
        '勤務なし',
      ])
  })
})

test.describe('the shifts, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the week, the schedule of a member and its form into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const member = await staffId(api, MIKA)
    await page.goto(`${ADMIN.origin}/salons/${salon}/shifts`)
    await enterCredentials(page, MANAGER, api.seedPassword)

    // Act
    await expect(page.getByRole('link', { name: MIKA })).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.goto(`${ADMIN.origin}/salons/${salon}/shifts/${member}`)
    await expect(
      page.getByRole('table', { name: '日付ごと', exact: true }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: '勤務スケジュールを直す' }).click()
    await expect(page.getByRole('group', { name: '日曜日' })).toBeVisible()

    // Assert
    await expectSoundPage(page)
  })
})
