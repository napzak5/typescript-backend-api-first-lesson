import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { HIROSHI, LADIES_CUT, salonId, TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import {
  ADMIN_START,
  CUSTOMER,
  enterCredentials,
  heading,
  OWNER,
  STAFF,
} from './sign-in'

/*
 * The bookings of a salon, as the people who work there see them: the
 * list of a day and a booking, with the operations that move it on. The
 * tests put a booking of today into the database (the seed data has none
 * on the day the tests run), a cut of the first customer with Hiroshi.
 */

const CUSTOMER_NAME = 'Tanaka Yuki'

/** What a salon writes down that no line can be broken in */
const LONG_NOTE =
  '前回の写真: https://photos.example.com/salons/beauty-studio-tokyo/customers/tanaka-yuki/2026-10-02_before_and_after.jpg'

const bookingSchema = z.tuple([z.object({ id: z.uuid() })])

const storedSchema = z.tuple([
  z.object({
    status: z.string(),
    actualStartTime: z.string().nullable(),
    actualEndTime: z.string().nullable(),
    completed: z.boolean(),
    cancellationReason: z.string().nullable(),
  }),
])

/**
 * Puts a booking of today in Tokyo into the database: a cut from `at` until
 * an hour later, in the state `status` (one that needs nothing more written).
 */
const arrangeToday = async (
  api: TestApi,
  at: string,
  status: 'pending' | 'confirmed' = 'pending',
): Promise<string> => {
  const [{ id }] = bookingSchema.parse(
    await api.query(
      `with picked as (
         select salons.id as "salonId", customers.id as "customerId", staff.id as "staffId",
                services.id as "serviceId", services.price, services.duration,
                (now() at time zone 'Asia/Tokyo')::date as day
         from salons
         join staff on staff."salonId" = salons.id and staff."displayName" = $2
         join services on services."salonId" = salons.id and services.name = $3
         cross join customers
         where salons.name = $1 and customers.email = $4
       ), made as (
         insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate",
                               "startTime", "endTime", duration, status, subtotal, "totalAmount",
                               "customerRequest", "internalNotes")
         select 'BK-E2E-0001', "salonId", "customerId", "staffId", day,
                (day + $5::time) at time zone 'Asia/Tokyo',
                (day + $5::time) at time zone 'Asia/Tokyo' + make_interval(mins => duration),
                duration, $6::text::booking_status, price, price, $7, $7
         from picked
         returning id, "staffId", "startTime", "endTime", duration, subtotal
       ), lines as (
         insert into booking_services ("bookingId", "serviceId", "staffId", "startTime", "endTime",
                                       duration, price, "finalPrice", "taxIncluded")
         select made.id, picked."serviceId", made."staffId", made."startTime", made."endTime",
                made.duration, made.subtotal, made.subtotal, true
         from made cross join picked
       )
       select id::text from made`,
      [TOKYO, HIROSHI, LADIES_CUT, CUSTOMER, at, status, LONG_NOTE],
    ),
  )

  return id
}

/** A booking as the database of the API has it. */
const stored = async (api: TestApi, id: string) =>
  storedSchema.parse(
    await api.query(
      `select status::text, "cancellationReason",
              to_char("actualStartTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') as "actualStartTime",
              to_char("actualEndTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') as "actualEndTime",
              "completedAt" is not null as completed
       from bookings where id = $1`,
      [id],
    ),
  )[0]

const todayInTokyo = async (api: TestApi): Promise<string> =>
  z
    .tuple([z.object({ day: z.iso.date() })])
    .parse(
      await api.query(
        `select to_char((now() at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD') as day`,
      ),
    )[0].day

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const statusPart = (page: Page): Locator =>
  page.getByRole('region', { name: '状態' })

const statusHeading = (page: Page): Locator =>
  statusPart(page).getByRole('heading', { name: '状態' })

const statusButton = (page: Page, name: string): Locator =>
  statusPart(page).getByRole('button', { name })

const dialog = (page: Page, name: string): Locator =>
  page.getByRole('dialog', { name })

const dayTable = (page: Page): Locator =>
  page.getByRole('table', { name: /の予約$/ })

test.describe('the bookings of a salon, in a browser', () => {
  test('should lead a member of the staff from the sign-in through the list of today to a booking, and confirm, start and complete it with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const id = await arrangeToday(api, '10:00')
    const tokyo = await salonId(api)
    await page.goto(ADMIN.origin)
    await page.getByRole('textbox', { name: 'メールアドレス' }).focus()
    await page.keyboard.type(STAFF)
    await page.keyboard.press('Tab')
    await page.keyboard.type(api.seedPassword)
    await page.keyboard.press('Enter')

    // Act: the bookings of today at the salon of the member of the staff
    await expect(heading(page, ADMIN_START)).toBeFocused()

    // Assert
    await expect(page).toHaveURL(`${ADMIN.origin}/salons/${tokyo}/bookings`)
    await expect(page).toHaveTitle(`${ADMIN_START} | ${ADMIN.title}`)
    await expect(dayTable(page).getByRole('row').nth(1)).toHaveText(
      `10:00〜11:00${CUSTOMER_NAME}${HIROSHI}${LADIES_CUT}確定待ちBK-E2E-0001`,
    )
    await expectSoundPage(page)

    // Act: to the booking
    await pressWithTheKeyboard(
      dayTable(page).getByRole('link', { name: CUSTOMER_NAME }),
    )

    // Assert
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page).toHaveURL(
      `${ADMIN.origin}/salons/${tokyo}/bookings/${id}`,
    )
    await expect(statusPart(page).getByText('確定待ち')).toBeVisible()
    await expectSoundPage(page)

    // Act: confirm
    await pressWithTheKeyboard(statusButton(page, '予約を確定する'))

    // Assert
    await expect(statusHeading(page)).toBeFocused()
    await expect(page.getByText('予約を確定しました。')).toBeVisible()
    await expect(
      statusPart(page).getByText('確定', { exact: true }),
    ).toBeVisible()
    expect((await stored(api, id)).status).toBe('confirmed')

    // Act: start
    await pressWithTheKeyboard(statusButton(page, '施術を始める'))

    // Assert
    await expect(statusHeading(page)).toBeFocused()
    await expect(page.getByText('施術の開始を記録しました。')).toBeVisible()
    await expect(statusPart(page).getByText('施術中')).toBeVisible()
    const started = await stored(api, id)
    expect(started.status).toBe('in_progress')
    expect(started.actualStartTime).not.toBeNull()

    // Act: complete, leaving the times as they were recorded
    await pressWithTheKeyboard(statusButton(page, '完了にする'))
    const completion = dialog(page, '予約を完了にしますか？')
    await expect(completion).toBeVisible()
    await expect(completion.getByLabel('実際の開始')).toBeFocused()
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      completion.getByRole('button', { name: '完了にする' }),
    )

    // Assert
    await expect(completion).toBeHidden()
    await expect(statusHeading(page)).toBeFocused()
    await expect(page.getByText('予約を完了にしました。')).toBeVisible()
    await expect(
      statusPart(page).getByText('完了', { exact: true }),
    ).toBeVisible()
    await expect(statusPart(page).getByRole('button')).toHaveCount(0)
    expect(await stored(api, id)).toEqual({
      ...started,
      status: 'completed',
      completed: true,
    })

    // Act: back to the day, which shows the state the booking is in now
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'この日の予約へ' }),
    )

    // Assert
    await expect(heading(page, ADMIN_START)).toBeFocused()
    await expect(dayTable(page).getByRole('row').nth(1)).toContainText('完了')
  })

  test('should cancel a booking with its reason after asking, and leave it as it was when the dialog is closed', async ({
    page,
    api,
  }) => {
    // Arrange
    const id = await arrangeToday(api, '15:30', 'confirmed')
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/bookings/${id}`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    const cancel = statusButton(page, '予約をキャンセルする')
    const cancellation = dialog(page, '予約をキャンセルしますか？')

    // Act: asked, and not cancelled
    await pressWithTheKeyboard(cancel)
    await expect(cancellation.getByLabel('キャンセルの理由')).toBeFocused()
    await page.keyboard.press('Escape')

    // Assert
    await expect(cancellation).toBeHidden()
    await expect(cancel).toBeFocused()
    expect((await stored(api, id)).status).toBe('confirmed')

    // Act: asked again, and cancelled
    await pressWithTheKeyboard(cancel)
    await page.keyboard.type('お客様から電話で連絡')
    await pressWithTheKeyboard(
      cancellation.getByRole('button', { name: 'キャンセルを確定する' }),
    )

    // Assert
    await expect(cancellation).toBeHidden()
    await expect(statusHeading(page)).toBeFocused()
    await expect(page.getByText('予約をキャンセルしました。')).toBeVisible()
    expect(await stored(api, id)).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'お客様から電話で連絡',
    })
    await expect(
      page
        .getByRole('region', { name: '予約' })
        .getByText('お客様から電話で連絡'),
    ).toBeVisible()
  })

  test('should close the dialog and bring the focus to the state when the booking was changed elsewhere meanwhile', async ({
    page,
    api,
  }) => {
    // Arrange
    const id = await arrangeToday(api, '18:00', 'confirmed')
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/bookings/${id}`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    await pressWithTheKeyboard(statusButton(page, '予約をキャンセルする'))
    const cancellation = dialog(page, '予約をキャンセルしますか？')
    await expect(cancellation.getByLabel('キャンセルの理由')).toBeFocused()
    // The treatment began at the counter
    await api.query(
      `update bookings set status = 'in_progress', "actualStartTime" = now() where id = $1`,
      [id],
    )

    // Act
    await pressWithTheKeyboard(
      cancellation.getByRole('button', { name: 'キャンセルを確定する' }),
    )

    // Assert
    await expect(cancellation).toBeHidden()
    await expect(page.getByRole('alert')).toHaveText(
      '予約の状態が、ほかの画面か端末で変わっていました。いまの状態を読み込み直しました。',
    )
    await expect(statusHeading(page)).toBeFocused()
    await expect(statusPart(page).getByText('施術中')).toBeVisible()
    expect((await stored(api, id)).status).toBe('in_progress')
  })
})

test.describe('the bookings of a salon, in a browser in another time zone', () => {
  // Honolulu is nineteen hours behind Tokyo: most of the time it is
  // another day there
  test.use({ timezoneId: 'Pacific/Honolulu' })

  test('should show the day and the times of the salon, and record the times on the clock of the salon', async ({
    page,
    api,
  }) => {
    // Arrange
    const id = await arrangeToday(api, '10:00', 'confirmed')
    const today = await todayInTokyo(api)
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeFocused()

    // Act
    await expect(page.getByLabel('日付')).toHaveValue(today)
    await dayTable(page).getByRole('link', { name: CUSTOMER_NAME }).click()
    await statusButton(page, '完了にする').click()
    const completion = dialog(page, '予約を完了にしますか？')
    await completion.getByLabel('実際の開始').fill(`${today}T10:05`)
    await completion.getByLabel('実際の終了').fill(`${today}T11:10`)
    await completion.getByRole('button', { name: '完了にする' }).click()

    // Assert
    await expect(statusHeading(page)).toBeFocused()
    expect(await stored(api, id)).toMatchObject({
      status: 'completed',
      // 10:05 and 11:10 in Tokyo
      actualStartTime: `${today}T01:05Z`,
      actualEndTime: `${today}T02:10Z`,
    })
    await expect(
      page.getByRole('region', { name: '予約' }).getByText(/ 10:05$/),
    ).toBeVisible()
  })
})

test.describe('the bookings of a salon, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the list of a day, a booking and its dialogs into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await arrangeToday(api, '10:00')
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Act, Assert: the list of today
    await expect(heading(page, ADMIN_START)).toBeFocused()
    await expect(dayTable(page)).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: the booking, whose notes have a line that cannot be broken
    await dayTable(page).getByRole('link', { name: CUSTOMER_NAME }).click()
    await expect(heading(page, '予約の内容')).toBeFocused()
    await expect(page.getByText(LONG_NOTE).first()).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: the dialogs
    await statusButton(page, '予約をキャンセルする').click()
    await expect(dialog(page, '予約をキャンセルしますか？')).toBeVisible()
    await expectSoundPage(page)
    await page.keyboard.press('Escape')
    await statusButton(page, '予約を確定する').click()
    await statusButton(page, '完了にする').click()
    await expect(dialog(page, '予約を完了にしますか？')).toBeVisible()
    await expectSoundPage(page)
  })

  test('should fit the choice of a salon into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)

    // Act
    await enterCredentials(page, 'admin@beautysalon.jp', api.seedPassword)

    // Assert
    await expect(heading(page, 'サロンを選ぶ')).toBeFocused()
    await expect(page.getByRole('link', { name: TOKYO })).toBeVisible()
    await expectSoundPage(page)
  })
})
