import {
  CUSTOMER,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from '../support/applications'
import { HIROSHI, LADIES_CUT, salonId } from '../support/bookings'
import { expectSoundPage } from '../support/checks'
import { expect, type TestApi, test } from '../support/fixtures'
import {
  chooseWithTheKeyboard,
  part,
  pressWithTheKeyboard,
} from '../support/screen'
import { enterCredentials, heading } from '../support/sign-in'

/*
 * The checkout of a visit, as the counter of a salon does it: the sale of a
 * booking whose treatment began, with a service that was done besides, paid
 * in two parts, the second by card, and the receipt that is printed. The
 * tests put the booking into the database: a cut of the first customer
 * with Hiroshi, today, begun at 10:00. The seed data has no sales.
 */

/** Puts the booking of the tests into the database, its treatment begun. */
const arrangeVisit = (api: TestApi): Promise<string> =>
  api.idOf(
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
                               "actualStartTime")
         select 'BK-E2E-0101', "salonId", "customerId", "staffId", day,
                (day + '10:00'::time) at time zone 'Asia/Tokyo',
                (day + '10:00'::time) at time zone 'Asia/Tokyo' + make_interval(mins => duration),
                duration, 'in_progress', price, price,
                (day + '10:00'::time) at time zone 'Asia/Tokyo'
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
    [TOKYO, HIROSHI, LADIES_CUT, CUSTOMER],
  )

const storedSchema = z.tuple([
  z.object({
    totalAmount: z.number(),
    paymentStatus: z.string(),
    lines: z.array(z.string()),
    payments: z.array(
      z.object({
        method: z.string(),
        amount: z.number(),
        cardLastFour: z.string().nullable(),
      }),
    ),
  }),
])

/** The sale of a booking as the database of the API has it: its lines and its payments in their order. */
const storedSale = async (api: TestApi, bookingId: string) =>
  storedSchema.parse(
    await api.query(
      `select sales."totalAmount", sales."paymentStatus"::text,
              (select coalesce(json_agg(sales_details."itemName" order by sales_details."sortOrder"), '[]')
               from sales_details where sales_details."saleId" = sales.id) as lines,
              (select coalesce(json_agg(json_build_object(
                        'method', payment_methods.method,
                        'amount', payment_transactions.amount,
                        'cardLastFour', payment_transactions."cardLastFour")
                      order by payment_transactions."createdAt"), '[]')
               from payment_transactions
               join payment_methods on payment_methods.id = payment_transactions."paymentMethodId"
               where payment_transactions."saleId" = sales.id) as payments
       from sales where sales."bookingId" = $1`,
      [bookingId],
    ),
  )[0]

const amounts = (page: Page): Locator => part(page, '金額')

/** The amount a part of a page gives for a term */
const amountOf = (page: Page, term: string): Locator =>
  amounts(page)
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${term}$`) })
    .locator('xpath=following-sibling::dd[1]')

const opened = async (page: Page, api: TestApi, id: string, email: string) => {
  await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/bookings/${id}`)
  await enterCredentials(page, email, api.seedPassword)
  await expect(heading(page, '予約の内容')).toBeFocused()
}

test.describe('the checkout of a visit, in a browser', () => {
  test('should enter the sale with a service added, take it in two payments and print the receipt, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const id = await arrangeVisit(api)
    await opened(page, api, id, STYLIST)
    await expect(part(page, '会計')).toContainText('まだ会計を入れていません。')

    // Act: the checkout, with the colour that was done besides
    await pressWithTheKeyboard(
      part(page, '会計').getByRole('link', { name: '会計を入れる' }),
    )
    await expect(heading(page, '会計を入れる')).toBeFocused()
    await expect(amountOf(page, '合計')).toHaveText('￥5,500')
    await page
      .getByRole('combobox', { name: '足す施術' })
      .selectOption({ label: 'Mens Cut（￥4,000）' })
    await pressWithTheKeyboard(page.getByRole('button', { name: '施術を足す' }))

    // Assert
    await expect(page.getByText('Mens Cutを足しました。')).toBeVisible()
    await expect(amountOf(page, '合計')).toHaveText('￥9,500')
    await expectSoundPage(page)

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '会計を入れる' }),
    )

    // Assert
    await expect(heading(page, '売上の内容')).toBeFocused()
    await expect(page.getByText('会計を入れました。')).toBeVisible()
    await expect(amountOf(page, '未払い残額')).toHaveText('￥9,500')
    await expectSoundPage(page)

    // Act: a part in cash
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '支払いを記録する' }),
    )
    await expect(heading(page, '支払いを記録する')).toBeFocused()
    await chooseWithTheKeyboard(page.getByRole('radio', { name: 'Cash' }))
    await page.getByRole('textbox', { name: '金額' }).fill('5000')
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '支払いを記録する' }),
    )

    // Assert
    await expect(heading(page, '売上の内容')).toBeFocused()
    await expect(page.getByText('支払いを記録しました。')).toBeVisible()
    await expect(amountOf(page, '未払い残額')).toHaveText('￥4,500')

    // Act: the rest by card
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '支払いを記録する' }),
    )
    await expect(heading(page, '支払いを記録する')).toBeFocused()
    await chooseWithTheKeyboard(
      page.getByRole('radio', { name: 'Credit Card（￥1,000から）' }),
    )
    await expect(page.getByRole('textbox', { name: '金額' })).toHaveValue(
      '4500',
    )
    await page.getByRole('textbox', { name: 'カードの下 4 桁' }).fill('4242')
    await page.getByRole('textbox', { name: 'カードのブランド' }).fill('VISA')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '支払いを記録する' }),
    )

    // Assert
    await expect(heading(page, '売上の内容')).toBeFocused()
    await expect(
      page.getByText(
        '支払いを記録しました。合計を受け取ったので、レシートを出せます。',
      ),
    ).toBeVisible()
    await expect(amountOf(page, '未払い残額')).toHaveText('￥0')

    // Act: the receipt
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'レシートを出す' }),
    )

    // Assert
    await expect(heading(page, 'レシート')).toBeFocused()
    const receipt = page.getByRole('article', { name: TOKYO })
    await expect(receipt).toContainText('Mens Cut')
    await expect(receipt).toContainText(
      'お支払い（Credit Card VISA 下 4 桁 4242）',
    )
    await expectSoundPage(page)
    expect(await storedSale(api, id)).toEqual({
      totalAmount: 9500,
      paymentStatus: 'completed',
      lines: ['Ladies Cut', 'Mens Cut'],
      payments: [
        { method: 'cash', amount: 5000, cardLastFour: null },
        { method: 'credit_card', amount: 4500, cardLastFour: '4242' },
      ],
    })

    // Act: on paper
    const said = page.getByText(
      '支払いを記録しました。合計を受け取ったので、レシートを出せます。',
    )
    await expect(said).toBeVisible()
    await page.emulateMedia({ media: 'print' })

    // Assert: the receipt alone, without the frame of the screen nor what the application said
    await expect(receipt).toBeVisible()
    await expect(heading(page, 'レシート')).toBeHidden()
    await expect(page.getByRole('banner')).toBeHidden()
    await expect(page.getByRole('navigation')).toBeHidden()
    await expect(said).toBeHidden()
    await expect(page.getByRole('button', { name: '印刷する' })).toBeHidden()
    await expect(page.getByRole('link', { name: '売上の内容へ' })).toBeHidden()
    await expect(receipt).toContainText('〒150-0002 Tokyo Shibuya-ku 1-2-3')
  })

  test('should list the sale of the day in the ledger and lead to it', async ({
    page,
    api,
  }) => {
    // Arrange
    const id = await arrangeVisit(api)
    await opened(page, api, id, OWNER)
    await part(page, '会計').getByRole('link', { name: '会計を入れる' }).click()
    await expect(amountOf(page, '合計')).toHaveText('￥5,500')
    await page.getByRole('button', { name: '会計を入れる' }).click()
    await expect(heading(page, '売上の内容')).toBeFocused()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('navigation').getByRole('link', { name: '売上' }),
    )

    // Assert
    await expect(heading(page, '売上台帳')).toBeFocused()
    const sales = page.getByRole('table', { name: /の売上$/ })
    await expect(sales.getByRole('row')).toHaveCount(2)
    await expect(sales).toContainText('￥5,500')
    await expect(sales).toContainText('未払い')
    await expectSoundPage(page)
  })
})

test.describe('the checkout of a visit, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the checkout, the sale, the payment, the receipt and the ledger into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const id = await arrangeVisit(api)
    await opened(page, api, id, OWNER)

    // Act, Assert: the checkout, with a service added
    await part(page, '会計').getByRole('link', { name: '会計を入れる' }).click()
    await expect(heading(page, '会計を入れる')).toBeFocused()
    await page
      .getByRole('combobox', { name: '足す施術' })
      .selectOption({ label: 'Mens Cut（￥4,000）' })
    await page.getByRole('button', { name: '施術を足す' }).click()
    await expect(amountOf(page, '合計')).toHaveText('￥9,500')
    await expectSoundPage(page)

    // Act, Assert: the sale
    await page.getByRole('button', { name: '会計を入れる' }).click()
    await expect(heading(page, '売上の内容')).toBeFocused()
    await expectSoundPage(page)

    // Act, Assert: the payment by card, refused below what the method takes
    await page.getByRole('link', { name: '支払いを記録する' }).click()
    await page
      .getByRole('radio', { name: 'Credit Card（￥1,000から）' })
      .check()
    await page.getByRole('textbox', { name: '金額' }).fill('500')
    await page.getByRole('button', { name: '支払いを記録する' }).click()
    await expect(
      page.getByText('Credit Cardは、1 回 ￥1,000から受け付けます。'),
    ).toBeVisible()
    await expectSoundPage(page)
    await page.getByRole('textbox', { name: '金額' }).fill('9500')
    await page.getByRole('button', { name: '支払いを記録する' }).click()
    await expect(heading(page, '売上の内容')).toBeFocused()
    await expect(page.getByRole('table', { name: '支払い' })).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: the receipt
    await page.getByRole('link', { name: 'レシートを出す' }).click()
    await expect(heading(page, 'レシート')).toBeFocused()
    await expect(page.getByRole('article', { name: TOKYO })).toBeVisible()
    await expectSoundPage(page)

    // Act, Assert: the ledger
    await page.getByRole('link', { name: '売上の内容へ' }).click()
    await page.getByRole('link', { name: 'この日の売上へ' }).click()
    await expect(heading(page, '売上台帳')).toBeFocused()
    await expect(page.getByRole('table', { name: /の売上$/ })).toBeVisible()
    await expectSoundPage(page)
  })
})
