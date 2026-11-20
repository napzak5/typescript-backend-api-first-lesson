import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { HIROSHI, LADIES_CUT, salonId, TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { CUSTOMER, enterCredentials, heading, OWNER } from './sign-in'

/*
 * What the counter of a salon does to a sale after it was paid: who took
 * it and its note put right, its payment given back whole, the sale voided,
 * and the booking billed again. The tests put the visit into the database:
 * a cut of the first customer with Hiroshi, today at 10:00, its sale
 * entered now and paid in cash. The seed data has no sales.
 */

const PAYMENT = 'PT-E2E-0201'

const idsSchema = z.tuple([z.object({ bookingId: z.uuid(), saleId: z.uuid() })])

/** Puts the visit of the tests, its sale and its payment into the database. */
const arrangePaidSale = async (
  api: TestApi,
): Promise<{ bookingId: string; saleId: string }> => {
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
         select 'BK-E2E-0201', "salonId", "customerId", "staffId", day,
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
                            "saleDate", "saleTime", subtotal, "taxAmount", "totalAmount",
                            "paymentStatus")
         select 'SL-E2E-0201', picked."salonId", picked."customerId", picked."staffId",
                booked.id, picked.day, now(), picked.price, 0, picked.price, 'completed'
         from booked cross join picked
         returning id
       ), sold_lines as (
         insert into sales_details ("saleId", "itemType", "itemId", "itemName", quantity,
                                    "unitPrice", "taxAmount", "totalAmount", "staffId")
         select sold.id, 'service', picked."serviceId", picked.name, 1, picked.price, 0,
                picked.price, picked."staffId"
         from sold cross join picked
       ), paid as (
         insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber",
                                           amount, status, "processedAt")
         select sold.id, payment_methods.id, $5, picked.price, 'completed', now()
         from sold
         cross join picked
         join payment_methods on payment_methods."salonId" = picked."salonId"
                             and payment_methods.method = 'cash'
       )
       select booked.id::text as "bookingId", sold.id::text as "saleId"
       from booked cross join sold`,
      [TOKYO, HIROSHI, LADIES_CUT, CUSTOMER, PAYMENT],
    ),
  )

  return ids
}

const storedSchema = z.array(
  z.object({
    isVoid: z.boolean(),
    voidReason: z.string().nullable(),
    staffCode: z.string().nullable(),
    notes: z.string().nullable(),
    paymentStatus: z.string(),
    refunds: z.array(z.number().nullable()),
  }),
)

/** The sales of a booking as the database of the API has them, in the order they were entered. */
const storedSales = async (api: TestApi, bookingId: string) =>
  storedSchema.parse(
    await api.query(
      `select sales."isVoid", sales."voidReason", staff."staffCode", sales.notes,
              sales."paymentStatus"::text,
              (select coalesce(json_agg(payment_transactions."refundAmount"
                                        order by payment_transactions."createdAt"), '[]')
               from payment_transactions
               where payment_transactions."saleId" = sales.id) as refunds
       from sales
       left join staff on staff.id = sales."staffId"
       where sales."bookingId" = $1
       order by sales."createdAt"`,
      [bookingId],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const part = (page: Page, name: string): Locator =>
  page.getByRole('region', { name })

/** What the part of a sale gives for a term */
const recorded = (page: Page, term: string): Locator =>
  part(page, '売上')
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${term}$`) })
    .locator('xpath=following-sibling::dd[1]')

const TO_VOID = '売上を取り消しますか？'

const opened = async (page: Page, api: TestApi, saleId: string) => {
  await page.goto(
    `${ADMIN.origin}/salons/${await salonId(api)}/sales/${saleId}`,
  )
  await enterCredentials(page, OWNER, api.seedPassword)
  await expect(heading(page, '売上の内容')).toBeFocused()
}

test.describe('changing, giving back and voiding a sale, in a browser', () => {
  test('should put the sale right, give its payment back, void it and bill the booking again, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const { bookingId, saleId } = await arrangePaidSale(api)
    await opened(page, api, saleId)
    await expect(part(page, '取り消し')).toContainText(
      '受け取った支払いがあるため、このままでは取り消せません。',
    )

    // Act: who took it, and the note
    await pressWithTheKeyboard(page.getByRole('link', { name: '売上を直す' }))
    await expect(heading(page, '売上を直す')).toBeFocused()
    await page
      .getByRole('combobox', { name: '会計の担当' })
      .selectOption({ label: 'Mika Suzuki' })
    await page.getByRole('textbox', { name: 'メモ' }).fill('担当の付け違い')
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(heading(page, '売上の内容')).toBeFocused()
    await expect(page.getByText('売上を直しました。')).toBeVisible()
    await expect(recorded(page, '会計の担当')).toHaveText('Mika Suzuki')
    await expect(recorded(page, 'メモ')).toHaveText('担当の付け違い')

    // Act: the payment given back whole
    await pressWithTheKeyboard(
      page.getByRole('link', { name: `${PAYMENT} を返金する` }),
    )
    await expect(heading(page, '返金する')).toBeFocused()
    await expect(
      page.getByRole('textbox', { name: '返金する金額' }),
    ).toHaveValue('5500')
    await page
      .getByRole('textbox', { name: '返金の理由' })
      .fill('施術のやり直しで、払い直す')
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '返金を記録する' }),
    )

    // Assert
    await expect(heading(page, '売上の内容')).toBeFocused()
    await expect(
      page.getByText(
        '返金を記録しました。すべての支払いを全額返金したので、売上を取り消せます。',
      ),
    ).toBeVisible()
    await expect(part(page, '支払い').getByRole('definition')).toHaveText(
      '施術のやり直しで、払い直す',
    )

    // Act: the sale voided
    await pressWithTheKeyboard(
      part(page, '取り消し').getByRole('button', { name: '売上を取り消す' }),
    )
    const dialog = page.getByRole('dialog', { name: TO_VOID })
    await expect(dialog).toBeVisible()
    await dialog
      .getByRole('textbox', { name: '取り消しの理由' })
      .fill('全額返金して、払い直す')
    await expectSoundPage(page)
    await pressWithTheKeyboard(dialog.getByRole('button', { name: '取り消す' }))

    // Assert: the part that voided it is gone, and the focus is on the sale
    await expect(
      part(page, '売上').getByRole('heading', { name: '売上' }),
    ).toBeFocused()
    await expect(dialog).toBeHidden()
    await expect(
      page.getByText('売上を取り消しました。予約の会計を、入れ直せます。'),
    ).toBeVisible()
    await expect(recorded(page, '取り消しの理由')).toHaveText(
      '全額返金して、払い直す',
    )
    await expect(part(page, '取り消し')).toBeHidden()
    await expectSoundPage(page)

    // Act: the booking billed again
    await pressWithTheKeyboard(page.getByRole('link', { name: '予約の内容' }))
    await expect(heading(page, '予約の内容')).toBeFocused()
    await pressWithTheKeyboard(
      part(page, '会計').getByRole('link', { name: '会計を入れる' }),
    )
    await expect(heading(page, '会計を入れる')).toBeFocused()
    await expect(part(page, '金額')).toContainText('￥5,500')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '会計を入れる' }),
    )

    // Assert
    await expect(heading(page, '売上の内容')).toBeFocused()
    await expect(page.getByText('会計を入れました。')).toBeVisible()
    expect(await storedSales(api, bookingId)).toEqual([
      {
        isVoid: true,
        voidReason: '全額返金して、払い直す',
        staffCode: 'STF002',
        notes: '担当の付け違い',
        paymentStatus: 'refunded',
        refunds: [5500],
      },
      {
        isVoid: false,
        voidReason: null,
        staffCode: 'STF001',
        notes: null,
        paymentStatus: 'pending',
        refunds: [],
      },
    ])
  })
})

test.describe('changing, giving back and voiding a sale, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the change, the refund and the voiding into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const { saleId } = await arrangePaidSale(api)
    await opened(page, api, saleId)
    await expectSoundPage(page)

    // Act, Assert: the change, left as it was
    await page.getByRole('link', { name: '売上を直す' }).click()
    await expect(heading(page, '売上を直す')).toBeFocused()
    await expectSoundPage(page)
    await page.getByRole('link', { name: 'やめる' }).click()
    await expect(heading(page, '売上の内容')).toBeFocused()

    // Act, Assert: the refund, refused without a reason
    await page.getByRole('link', { name: `${PAYMENT} を返金する` }).click()
    await expect(heading(page, '返金する')).toBeFocused()
    await page.getByRole('button', { name: '返金を記録する' }).click()
    await expect(
      page.getByRole('textbox', { name: '返金の理由' }),
    ).toBeFocused()
    await expectSoundPage(page)
    await page
      .getByRole('textbox', { name: '返金の理由' })
      .fill('施術のやり直し')
    await page.getByRole('button', { name: '返金を記録する' }).click()
    await expect(heading(page, '売上の内容')).toBeFocused()
    await expectSoundPage(page)

    // Act, Assert: the voiding
    await part(page, '取り消し')
      .getByRole('button', { name: '売上を取り消す' })
      .click()
    const dialog = page.getByRole('dialog', { name: TO_VOID })
    await expect(dialog).toBeVisible()
    await expectSoundPage(page)
    await dialog
      .getByRole('textbox', { name: '取り消しの理由' })
      .fill('入れ間違い')
    await dialog.getByRole('button', { name: '取り消す' }).click()
    await expect(part(page, '取り消し')).toBeHidden()
    await expectSoundPage(page)
  })
})
