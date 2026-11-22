import { OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Locator } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading } from './sign-in'

/*
 * The hours of the salon in Tokyo changed by its owner with the keyboard
 * alone: a day off is put into the calendar from the settings, and the
 * settings show it. The form, with what is wrong with it, is shown on a
 * screen as narrow as a phone as well.
 */

const storedSchema = z.array(
  z.object({
    openTime: z.string().nullable(),
    closeTime: z.string().nullable(),
    isHoliday: z.boolean(),
    holidayName: z.string().nullable(),
    notes: z.string().nullable(),
  }),
)

/** The rows of the calendar of the salon in Tokyo on a date, as the database of the API has them. */
const storedDateOf = async (api: TestApi, date: string) =>
  storedSchema.parse(
    await api.query(
      `select o."openTime"::text as "openTime", o."closeTime"::text as "closeTime",
              o."isHoliday", o."holidayName", o.notes
       from opening_hours o join salons s on s.id = o."salonId"
       where s.name = 'Beauty Studio Tokyo' and o.date = $1::date`,
      [date],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Writes into a control after moving the focus to it. */
const writeInto = async (control: Locator, value: string): Promise<void> => {
  await control.focus()
  await control.fill(value)
}

test.describe('the hours of a salon, in a browser', () => {
  test('should let the owner put a day off into the calendar, with the keyboard, and show it in the settings', async ({
    page,
    api,
  }) => {
    // Arrange
    const inspection = await api.dayFromToday(14)
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/settings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'サロンの設定')).toBeVisible()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '営業時間を直す' }),
    )
    await expect(heading(page, '営業時間を直す')).toBeFocused()
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '日付の行を足す' }),
    )
    const added = page.getByRole('group', { name: '8 行目' })
    await expect(added.getByLabel('日付')).toBeFocused()
    await expect(added.getByRole('radio', { name: '終日休業' })).toBeChecked()
    await writeInto(added.getByLabel('日付'), inspection)
    await writeInto(added.getByLabel('祝日・休業日の名前'), '臨時休業')
    await writeInto(added.getByLabel('備考'), '設備の点検')
    await pressWithTheKeyboard(page.getByRole('button', { name: '保存する' }))

    // Assert
    await expect(page.getByText('営業時間を直しました。')).toBeVisible()
    await expect(heading(page, 'サロンの設定')).toBeFocused()
    const dayOff = page
      .getByRole('table', { name: '営業日カレンダー', exact: true })
      .getByRole('row', { name: /臨時休業/ })
    await expect(dayOff).toContainText('終日休業')
    await expect(dayOff).toContainText('設備の点検')
    expect(await storedDateOf(api, inspection)).toEqual([
      {
        openTime: null,
        closeTime: null,
        isHoliday: true,
        holidayName: '臨時休業',
        notes: '設備の点検',
      },
    ])
  })
})

test.describe('the hours of a salon, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the form and what is wrong with it into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/settings/hours`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    const close = page
      .getByRole('group', { name: '月曜日' })
      .getByLabel('閉店', { exact: true })
    await close.fill('09:00')

    // Act
    await page.getByRole('button', { name: '保存する' }).click()

    // Assert
    await expect(close).toHaveAccessibleDescription(
      /閉店は、開店より後の時刻にしてください。/,
    )
    await expectSoundPage(page)
  })
})
