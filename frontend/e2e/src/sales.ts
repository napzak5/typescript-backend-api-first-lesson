import type { Locator } from '@playwright/test'
import * as z from 'zod'
import { TOKYO } from './bookings'
import type { TestApi } from './fixtures'

/*
 * What the browser tests of the dashboard arrange: the seed data has no
 * sales, so a test enters a cut of today in the salon in Tokyo, paid in
 * cash, as the checkout of the admin application would have.
 */

const daySchema = z.tuple([z.object({ day: z.iso.date() })])

/** The day so many days from today in Tokyo (`2026-11-21`). */
export const dayFromToday = async (
  api: TestApi,
  days: number,
): Promise<string> =>
  daySchema.parse(
    await api.query(
      `select to_char((now() at time zone 'Asia/Tokyo')::date + $1::int, 'YYYY-MM-DD') as day`,
      [days],
    ),
  )[0].day

/** Enters a ladies' cut of today by Hiroshi Tanaka, ￥5,500 with its tax, paid in cash. */
export const sellACutToday = (api: TestApi): Promise<unknown> =>
  api.query(
    `with made as (
       insert into sales ("saleNumber", "salonId", "staffId", "saleDate", "saleTime",
                          subtotal, "taxAmount", "totalAmount", "paymentStatus")
       select 'S-E2E-REPORT', salons.id, staff.id,
              (now() at time zone 'Asia/Tokyo')::date, now(), 5000, 500, 5500, 'completed'
       from salons
       join staff on staff."salonId" = salons.id and staff."staffCode" = 'STF001'
       where salons.name = $1
       returning id, "salonId", "staffId"
     ), line as (
       insert into sales_details ("saleId", "itemType", "itemId", "itemName", quantity,
                                  "unitPrice", "taxAmount", "totalAmount", "staffId")
       select made.id, 'service', services.id, services.name, 1, 5000, 500, 5500, made."staffId"
       from made
       join services on services."salonId" = made."salonId" and services.name = 'Ladies Cut'
     )
     insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber",
                                       amount, status, "processedAt")
     select made.id, payment_methods.id, 'PT-E2E-REPORT', 5500, 'completed', now()
     from made
     join payment_methods on payment_methods."salonId" = made."salonId"
                         and payment_methods.method = 'cash'`,
    [TOKYO],
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
export const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}
