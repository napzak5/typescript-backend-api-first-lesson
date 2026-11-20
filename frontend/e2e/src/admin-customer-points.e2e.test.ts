import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { HIROSHI, LADIES_CUT, salonId, TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { CUSTOMER, enterCredentials, heading, STAFF } from './sign-in'

/*
 * What the counter of a salon records of the points of a customer: the
 * points used at a sale, recorded from its page, and points given from the
 * ledger of the customer. The tests put the visit into the database: a
 * cut of the first customer with Hiroshi, today at 10:00, and its sale,
 * entered now and not paid yet. The first customer has 2,500 points from
 * the opening balance of the ledger; the seed data has no sales.
 */

const idsSchema = z.tuple([
  z.object({ saleId: z.uuid(), customerId: z.uuid() }),
])

/** Puts the visit of the tests and its sale into the database. */
const arrangeSale = async (
  api: TestApi,
): Promise<{ saleId: string; customerId: string }> => {
  const [ids] = idsSchema.parse(
    await api.query(
      `with picked as (
         select salons.id as "salonId", customers.id as "customerId", staff.id as "staffId",
                services.id as "serviceId", services.name, services.price, services.duration,
                (now() at time zone 'Asia/Tokyo')::date as day
         from salons
         join staff on staff."salonId" = salons.id and staff."displayName" = $2
         join services on services."salonId" = salons.id and services.name = $3
         cross join customers
         where salons.name = $1 and customers.email = $4
       ), booked as (
         insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate",
                               "startTime", "endTime", duration, status, subtotal, "totalAmount",
                               "actualStartTime", "completedAt")
         select 'BK-E2E-0301', "salonId", "customerId", "staffId", day,
                (day + '10:00'::time) at time zone 'Asia/Tokyo',
                (day + '10:00'::time) at time zone 'Asia/Tokyo' + make_interval(mins => duration),
                duration, 'completed', price, price,
                (day + '10:00'::time) at time zone 'Asia/Tokyo',
                (day + '10:00'::time) at time zone 'Asia/Tokyo' + make_interval(mins => duration)
         from picked
         returning id, "startTime", "endTime", duration, subtotal
       ), lines as (
         insert into booking_services ("bookingId", "serviceId", "staffId", "startTime", "endTime",
                                       duration, price, "finalPrice", "taxIncluded")
         select booked.id, picked."serviceId", picked."staffId", booked."startTime",
                booked."endTime", booked.duration, booked.subtotal, booked.subtotal, true
         from booked cross join picked
       ), sold as (
         insert into sales ("saleNumber", "salonId", "customerId", "staffId", "bookingId",
                            "saleDate", "saleTime", subtotal, "taxAmount", "totalAmount")
         select 'SL-E2E-0301', picked."salonId", picked."customerId", picked."staffId",
                booked.id, picked.day, now(), picked.price, 0, picked.price
         from booked cross join picked
         returning id
       ), sold_lines as (
         insert into sales_details ("saleId", "itemType", "itemId", "itemName", quantity,
                                    "unitPrice", "taxAmount", "totalAmount", "staffId")
         select sold.id, 'service', picked."serviceId", picked.name, 1, picked.price, 0,
                picked.price, picked."staffId"
         from sold cross join picked
       )
       select sold.id::text as "saleId", picked."customerId"::text as "customerId"
       from sold cross join picked`,
      [TOKYO, HIROSHI, LADIES_CUT, CUSTOMER],
    ),
  )

  return ids
}

const daySchema = z.tuple([z.object({ day: z.string() })])

/** The day so many days after today in Tokyo: `2026-12-20`. */
const dayFromToday = async (api: TestApi, days: number): Promise<string> =>
  daySchema.parse(
    await api.query(
      `select to_char((now() at time zone 'Asia/Tokyo')::date + $1::int, 'YYYY-MM-DD') as day`,
      [days],
    ),
  )[0].day

const storedSchema = z.array(
  z.object({
    transactionType: z.string(),
    points: z.number(),
    balance: z.number(),
    referenceId: z.string().nullable(),
    expiryDate: z.string().nullable(),
  }),
)

/** The transactions of the points of the first customer as the database of the API has them, the latest first. */
const storedPoints = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select "transactionType"::text, points, balance, "referenceId"::text,
              to_char("expiryDate", 'YYYY-MM-DD') as "expiryDate"
       from customer_points
       where "customerId" = (select id from customers where email = $1)
       order by "createdAt" desc, id desc`,
      [CUSTOMER],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const part = (page: Page, name: string): Locator =>
  page.getByRole('region', { name })

/** The first row of the history of the points, below its header. */
const latest = (page: Page): Locator =>
  page.getByRole('table', { name: 'ポイントの履歴' }).getByRole('row').nth(1)

test.describe('recording the points of a customer, in a browser', () => {
  test('should record the points used at a sale from its page, and give points from the ledger of the customer, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const { saleId, customerId } = await arrangeSale(api)
    const salon = await salonId(api)
    const expiry = await dayFromToday(api, 90)
    await page.goto(`${ADMIN.origin}/salons/${salon}/sales/${saleId}`)
    await enterCredentials(page, STAFF, api.seedPassword)
    await expect(heading(page, '売上の内容')).toBeFocused()

    // Act: the points used at the sale
    await pressWithTheKeyboard(
      part(page, 'ポイント').getByRole('link', {
        name: '使ったポイントを記録する',
      }),
    )
    await expect(heading(page, 'ポイントを記録する')).toBeFocused()
    await expect(
      page.getByRole('radio', { name: '使ったポイントを記録する' }),
    ).toBeChecked()
    await expect(
      page.getByRole('checkbox', { name: /^売上番号 SL-E2E-0301（/ }),
    ).toBeChecked()
    await page.getByRole('textbox', { name: 'ポイント数' }).fill('300')
    await expectSoundPage(page)
    await pressWithTheKeyboard(page.getByRole('button', { name: '記録する' }))

    // Assert
    await expect(heading(page, 'ポイント')).toBeFocused()
    await expect(
      page.getByText('300 ポイントを使いました。残高は 2,200 ポイントです。'),
    ).toBeVisible()
    await expect(part(page, '残高')).toContainText('2,200 ポイント')
    await expect(
      latest(page).getByRole('link', { name: '売上 SL-E2E-0301' }),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act: the balance on the ledger, and points given from it
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'お客様の台帳へ' }),
    )
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await expect(part(page, '来店とポイント')).toContainText('2,200 ポイント')
    await pressWithTheKeyboard(
      part(page, '来店とポイント').getByRole('link', {
        name: 'ポイントの履歴',
      }),
    )
    await expect(heading(page, 'ポイント')).toBeFocused()
    await pressWithTheKeyboard(
      part(page, '残高').getByRole('link', { name: 'ポイントを記録する' }),
    )
    await expect(heading(page, 'ポイントを記録する')).toBeFocused()
    await expect(
      page.getByRole('radio', { name: 'ポイントを付与する' }),
    ).toBeChecked()
    await page.getByRole('textbox', { name: 'ポイント数' }).fill('500')
    await page.getByLabel('有効期限').fill(expiry)
    await page.getByRole('textbox', { name: '説明' }).fill('誕生月のポイント')
    await pressWithTheKeyboard(page.getByRole('button', { name: '記録する' }))

    // Assert
    await expect(heading(page, 'ポイント')).toBeFocused()
    await expect(
      page.getByText('500 ポイントを付与しました。残高は 2,700 ポイントです。'),
    ).toBeVisible()
    await expect(latest(page)).toContainText('誕生月のポイント')
    expect(page.url()).toBe(
      `${ADMIN.origin}/salons/${salon}/customers/${customerId}/points`,
    )
    expect(await storedPoints(api)).toEqual([
      {
        transactionType: 'earned',
        points: 500,
        balance: 2700,
        referenceId: null,
        expiryDate: expiry,
      },
      {
        transactionType: 'used',
        points: -300,
        balance: 2200,
        referenceId: saleId,
        expiryDate: null,
      },
      {
        transactionType: 'adjusted',
        points: 2500,
        balance: 2500,
        referenceId: null,
        expiryDate: null,
      },
    ])
  })
})

test.describe('the points of a customer, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the points and the form that records them into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const { customerId } = await arrangeSale(api)
    const salon = await salonId(api)
    await page.goto(
      `${ADMIN.origin}/salons/${salon}/customers/${customerId}/points`,
    )
    await enterCredentials(page, STAFF, api.seedPassword)
    await expect(heading(page, 'ポイント')).toBeFocused()
    await expect(
      page.getByRole('table', { name: 'ポイントの履歴' }),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act: the form, sent without a count
    await part(page, '残高')
      .getByRole('link', { name: 'ポイントを記録する' })
      .click()
    await expect(heading(page, 'ポイントを記録する')).toBeFocused()
    await expectSoundPage(page)
    await page.getByRole('button', { name: '記録する' }).click()

    // Assert
    await expect(
      page.getByRole('textbox', { name: 'ポイント数' }),
    ).toBeFocused()
    await expectSoundPage(page)
  })
})
