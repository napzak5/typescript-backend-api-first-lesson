import { CUSTOMER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import { PORTAL } from './applications'
import {
  dateControl,
  details,
  HIROSHI,
  LADIES_CUT,
  MIKA,
  openDay,
  salonId,
  serviceId,
  staffControl,
  staffId,
  time,
  times,
} from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { part } from './screen'
import {
  enterCredentials,
  heading,
  NEWCOMER,
  NEWCOMER_PASSWORD,
  registerNewcomer,
} from './sign-in'

/**
 * What a customer writes for the salon: two paragraphs, and the name of a
 * file, which a line cannot be broken in (a browser breaks a line after a
 * slash and after a hyphen, and not at an underscore).
 */
const LONG_REQUEST =
  '前回と同じ長さでお願いします。\n\n参考にしたい写真があります: natural_brown_with_soft_highlights_and_long_layers_for_autumn_2026_front_and_side.jpeg'

const requestControl = (page: Page): Locator =>
  page.getByRole('textbox', { name: 'ご要望' })

const sendButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'この内容で予約する' })

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
    await expect(details(page).last()).toHaveText('記録なし')
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
    // The form went with the button that sent it: the heading has the focus
    await expect(heading(page, '予約する')).toBeFocused()
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
