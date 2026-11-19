import type { APIRequestContext, Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { PORTAL } from './applications'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { CUSTOMER, enterCredentials, heading } from './sign-in'

/** The salon the tests book at, what they book and with whom */
const TOKYO = 'Beauty Studio Tokyo'
const LADIES_CUT = 'Ladies Cut'
const HIROSHI = 'Hiroshi Tanaka'
const MIKA = 'Mika Suzuki'

/** Somebody who registers in a test: an account without a profile */
const NEWCOMER = 'newcomer@example.com'
const NEWCOMER_PASSWORD = 'a passphrase that only this test knows'

/**
 * What a customer writes for the salon: two paragraphs, and the name of a
 * file, which a line cannot be broken in (a browser breaks a line after a
 * slash and after a hyphen, and not at an underscore).
 */
const LONG_REQUEST =
  '前回と同じ長さでお願いします。\n\n参考にしたい写真があります: natural_brown_with_soft_highlights_and_long_layers_for_autumn_2026_front_and_side.jpeg'

/** Two weeks from today: the seed data has no booking that far ahead. */
const DAYS_AHEAD = 14

const idSchema = z.tuple([z.object({ id: z.uuid() })])
const dateSchema = z.tuple([z.object({ date: z.iso.date() })])

const salonId = async (api: TestApi): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await api.query('select id::text from salons where name = $1', [TOKYO]),
  )

  return id
}

const serviceId = async (api: TestApi): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await api.query(
      `select services.id::text from services join salons on salons.id = services."salonId"
       where salons.name = $1 and services.name = $2`,
      [TOKYO, LADIES_CUT],
    ),
  )

  return id
}

const staffId = async (api: TestApi, displayName: string): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await api.query('select id::text from staff where "displayName" = $1', [
      displayName,
    ]),
  )

  return id
}

/**
 * Opens the salon on the day the tests book on, from 10:00 until `until`
 * whatever day of the week it is, and says who works then: each member of
 * the staff that is named, from their hour until then, and nobody else.
 * The day is the answer.
 */
const openDay = async (
  api: TestApi,
  working: Record<string, string>,
  until = '13:00',
): Promise<string> => {
  const [{ date }] = dateSchema.parse(
    await api.query(
      `select ((now() at time zone 'Asia/Tokyo')::date + $1::int)::text as date`,
      [DAYS_AHEAD],
    ),
  )
  await api.query(
    `insert into opening_hours ("salonId", "dayOfWeek", date, "openTime", "closeTime")
     select id, trim(to_char($2::date, 'day'))::day_of_week, $2::date, '10:00', $3::time
     from salons where name = $1
     on conflict ("salonId", date) do update
     set "openTime" = excluded."openTime", "closeTime" = excluded."closeTime", "isHoliday" = false`,
    [TOKYO, date, until],
  )
  await api.query(
    `insert into staff_schedules ("staffId", date, "startTime", "endTime", "isRecurring", "isAvailable")
     select staff.id, $2::date, hours.value::time,
            case when hours.value is null then null else $4::time end,
            false, hours.value is not null
     from staff
     join salons on salons.id = staff."salonId"
     left join jsonb_each_text($3::jsonb) as hours(name, value) on hours.name = staff."displayName"
     where salons.name = $1`,
    [TOKYO, date, JSON.stringify(working), until],
  )

  return date
}

/** An account whose address is confirmed, and that has not said who its customer is. */
const registerNewcomer = async (
  request: APIRequestContext,
  api: TestApi,
): Promise<void> => {
  const registered = await request.post(`${api.origin}/api/v1/auth/register`, {
    data: { email: NEWCOMER, password: NEWCOMER_PASSWORD },
  })
  expect(registered.status()).toBe(204)
  const token = new URL(await api.mailedLink(NEWCOMER)).hash.replace(
    '#token=',
    '',
  )
  const confirmed = await request.post(
    `${api.origin}/api/v1/auth/verify-email/confirm`,
    { data: { token } },
  )
  expect(confirmed.status()).toBe(204)
}

const part = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('region', { name })

const staffControl = (page: Page): Locator =>
  page.getByRole('combobox', { name: 'スタッフ' })

const dateControl = (page: Page): Locator => page.getByLabel('日付')

const times = (page: Page): Locator =>
  page.getByRole('radiogroup', { name: '開始時刻' }).getByRole('radio')

const time = (page: Page, name: string): Locator =>
  page.getByRole('radio', { name, exact: true })

const requestControl = (page: Page): Locator =>
  page.getByRole('textbox', { name: 'ご要望' })

const sendButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'この内容で予約する' })

/** The values of the booking that is shown, in the order of the page. */
const details = (page: Page): Locator =>
  part(page, /^予約番号 BK-/).getByRole('definition')

/** What the database has of the bookings of the day. */
const bookingsOn = (api: TestApi, date: string) =>
  api.query(
    `select customers.email as customer, staff."displayName" as staff, bookings.status::text,
            to_char(bookings."startTime" at time zone 'Asia/Tokyo', 'HH24:MI') as time
     from bookings
     join customers on customers.id = bookings."customerId"
     join staff on staff.id = bookings."staffId"
     where bookings."bookingDate" = $1::date`,
    [date],
  )

test.describe('a booking, in a browser', () => {
  test('should book a service from the page of a salon: sign in on the way, choose the day and the time, and show the booking', async ({
    page,
    api,
  }) => {
    // Arrange: a day on which one member of the staff works in the morning
    const date = await openDay(api, { [HIROSHI]: '10:00' })
    await page.goto(`${PORTAL.origin}/salons/${await salonId(api)}`)

    // Act: the service on the menu, and the sign-in that stands in the way
    await part(page, 'メニュー')
      .getByRole('link', { name: `${LADIES_CUT}を予約する` })
      .click()
    await expect(
      page.getByText('予約するには、サインインしてください。'),
    ).toBeVisible()
    await expectSoundPage(page)
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert: the screen of the address that was asked for
    await expect(heading(page, '予約する')).toBeFocused()
    await expect(part(page, 'ご予約の内容').getByRole('definition')).toHaveText(
      [TOKYO, LADIES_CUT, '1 時間', /5,500（税込）$/],
    )

    // Act: the day, a time of it, and a word for the salon
    await dateControl(page).fill(date)
    await expect(times(page)).toHaveCount(5)
    await expect(page).toHaveURL(new RegExp(`/booking\\?date=${date}$`))
    await expectSoundPage(page)
    await time(page, '10:30').check()
    await requestControl(page).fill('前髪は短めにお願いします')
    await sendButton(page).click()

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page.getByText('予約を受け付けました。')).toBeVisible()
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/)
    await expect(details(page)).toHaveText([
      '確定待ちサロンが内容を確認すると、予約が確定します。',
      TOKYO,
      LADIES_CUT,
      HIROSHI,
      /日 10:30〜11:30（1 時間）$/,
      /5,500$/,
      '前髪は短めにお願いします',
    ])
    await expectSoundPage(page)
    expect(await bookingsOn(api, date)).toEqual([
      { customer: CUSTOMER, staff: HIROSHI, status: 'pending', time: '10:30' },
    ])

    // Act: the page is loaded again, and the booking read from the API
    await page.reload()

    // Assert
    await expect(heading(page, '予約の内容')).toBeVisible()
    await expect(details(page).nth(3)).toHaveText(HIROSHI)
  })

  test('should keep the member of the staff and the day through a reload and on the way back, and book with the keyboard alone', async ({
    page,
    api,
  }) => {
    // Arrange
    const date = await openDay(api, { [HIROSHI]: '10:00', [MIKA]: '11:00' })
    const mika = await staffId(api, MIKA)
    await page.goto(`${PORTAL.origin}/salons/${await salonId(api)}`)
    await part(page, 'メニュー')
      .getByRole('link', { name: `${LADIES_CUT}を予約する` })
      .click()
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(heading(page, '予約する')).toBeFocused()

    // Act: with whom, and on which day
    await staffControl(page).selectOption(MIKA)
    await dateControl(page).fill(date)

    // Assert: the times of that member of the staff, at an address that says so
    await expect(times(page)).toHaveCount(3)
    await expect(page).toHaveURL(
      new RegExp(`/booking\\?staffId=${mika}&date=${date}$`),
    )

    // Act
    await page.reload()

    // Assert: the same choice, read from the address
    await expect(staffControl(page)).toHaveValue(mika)
    await expect(dateControl(page)).toHaveValue(date)
    await expect(times(page)).toHaveCount(3)

    // Act: one step back leads out of the screen, not through every choice
    await page.goBack()
    await expect(heading(page, TOKYO)).toBeVisible()
    await page.goForward()

    // Assert
    await expect(staffControl(page)).toHaveValue(mika)
    await expect(times(page)).toHaveCount(3)

    // Act: from the days to the times, the request and the button, by keyboard
    await page.getByRole('button', { name: '次の日' }).focus()
    await page.keyboard.press('Tab')
    await expect(time(page, '11:00')).toBeFocused()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowDown')
    await expect(time(page, '11:30')).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(requestControl(page)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(sendButton(page)).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(details(page).nth(3)).toHaveText(MIKA)
    await expect(details(page).last()).toHaveText('なし')
    expect(await bookingsOn(api, date)).toEqual([
      { customer: CUSTOMER, staff: MIKA, status: 'pending', time: '11:30' },
    ])
  })

  test('should ask an account that is new who the customer is, say what is missing, and go on to the times of the address', async ({
    page,
    api,
    request,
  }) => {
    // Arrange
    await registerNewcomer(request, api)
    const date = await openDay(api, { [HIROSHI]: '10:00' })
    await page.goto(
      `${PORTAL.origin}/salons/${await salonId(api)}/services/${await serviceId(api)}/booking?date=${date}`,
    )
    await enterCredentials(page, NEWCOMER, NEWCOMER_PASSWORD)
    const profile = part(page, 'お客様の情報')
    const proceed = profile.getByRole('button', {
      name: '登録して、日時の選択へ進む',
    })
    await expect(profile).toBeVisible()
    await expectSoundPage(page)

    // Act: nothing is filled in
    await proceed.click()

    // Assert
    await expect(profile.getByRole('textbox', { name: '姓' })).toBeFocused()
    await expect(
      profile.getByText('電話番号を入力してください。'),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act
    await profile.getByRole('textbox', { name: '姓' }).fill('山田')
    await profile.getByRole('textbox', { name: '名' }).fill('花子')
    await profile
      .getByRole('textbox', { name: '電話番号' })
      .fill('090-5550-0199')
    await profile
      .getByRole('checkbox', { name: 'メールでの連絡を受け取る' })
      .check()
    await proceed.click()

    // Assert: the day of the address, with its times
    await expect(times(page)).toHaveCount(5)
    await expect(dateControl(page)).toHaveValue(date)
    await expect(profile).toBeHidden()
    expect(
      await api.query(
        `select "lastName", "firstName", "phoneNumber", "allowEmail", "allowSms" from customers where email = $1`,
        [NEWCOMER],
      ),
    ).toEqual([
      {
        lastName: '山田',
        firstName: '花子',
        phoneNumber: '090-5550-0199',
        allowEmail: true,
        allowSms: false,
      },
    ])
  })
})

test.describe('a booking, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the times of a long day, what the form says about them, and a booking with a long request into the width', async ({
    page,
    api,
  }) => {
    // Arrange: two members of the staff work from 10:00 to 20:00
    const date = await openDay(
      api,
      { [HIROSHI]: '10:00', [MIKA]: '10:00' },
      '20:00',
    )
    await page.goto(
      `${PORTAL.origin}/salons/${await salonId(api)}/services/${await serviceId(api)}/booking?date=${date}`,
    )
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert: a time every half hour, the last an hour before the salon
    // closes, and more than one of them in a row at this width, too
    await expect(times(page)).toHaveCount(19)
    const first = await time(page, '10:00').boundingBox()
    const second = await time(page, '10:30').boundingBox()
    expect(first).not.toBeNull()
    expect(second?.y).toBe(first?.y)
    await expectSoundPage(page)

    // Act: the form is sent without a time
    await sendButton(page).click()

    // Assert
    await expect(time(page, '10:00')).toBeFocused()
    await expect(page.getByText('開始時刻を選択してください。')).toBeVisible()
    await expectSoundPage(page)

    // Act
    await time(page, '19:00').check()
    await requestControl(page).fill(LONG_REQUEST)
    await sendButton(page).click()

    // Assert: the request with the line breaks it was written with, and
    // nothing of it outside the page
    await expect(heading(page, '予約の内容')).toBeFocused()
    const request = details(page).last().getByRole('paragraph')
    await expect(request).toContainText('参考にしたい写真')
    await expect(request).toHaveCSS('white-space', 'pre-wrap')
    await expectSoundPage(page)
  })
})
