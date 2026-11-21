import type { ModelsPaymentMethodType } from '@beauty-salon-frontend/api-client'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as z from 'zod'

/*
 * What the screen tests of the dashboard arrange in the database: the seed
 * data has no sales, so a test enters those its report counts, as the
 * checkout of the admin application would have entered them.
 */

export const TOKYO = 'Beauty Studio Tokyo'
export const OSAKA = 'Hair & Spa Osaka'

/** The accounts of the seed data: the owner and the manager are of the salon in Tokyo */
export const OWNER = 'owner@beautysalon.jp'
export const MANAGER = 'manager@beautysalon.jp'
export const ADMIN = 'admin@beautysalon.jp'

/** Signs in on the screen, as a seeded account. */
export const signInAs = async (email: string): Promise<void> => {
  const user = userEvent.setup()
  await user.type(
    await screen.findByRole('textbox', { name: 'メールアドレス' }),
    email,
  )
  await user.type(screen.getByLabelText('パスワード'), testApi().seedPassword)
  await user.click(screen.getByRole('button', { name: 'サインイン' }))
}

const idsSchema = z.tuple([z.object({ id: z.uuid() })])

export const salonIdOf = async (name: string): Promise<string> =>
  idsSchema.parse(
    await testApi().query('select id::text from salons where name = $1', [
      name,
    ]),
  )[0].id

const daySchema = z.tuple([z.object({ day: z.iso.date() })])

/** The day so many days from today in Tokyo (`2026-11-21`). */
export const dayFromToday = async (days: number): Promise<string> =>
  daySchema.parse(
    await testApi().query(
      `select to_char((now() at time zone 'Asia/Tokyo')::date + $1::int, 'YYYY-MM-DD') as day`,
      [days],
    ),
  )[0].day

/** A line of a sale: a service of the menu of the salon by its name, or a product */
export type Line = {
  itemType: 'service' | 'product'
  itemName: string
  unitPrice: number
  quantity?: number
  discount?: number
  tax: number
  /** The member of the staff who did it; none for one the sale's member did */
  staffCode?: string
}

/**
 * Enters a sale into the salon in Tokyo, as the checkout would have: on a
 * day so many days from today at noon there, by a member of the staff,
 * with its lines, nothing paid. Its sums are those of its lines.
 */
export const arrangeSale = async ({
  saleNumber,
  day,
  staffCode,
  lines,
}: {
  saleNumber: string
  /** Days from today in Tokyo */
  day: number
  staffCode: string
  lines: Line[]
}): Promise<string> => {
  const rows = lines.map((line, position) => ({
    itemType: line.itemType,
    itemName: line.itemName,
    quantity: line.quantity ?? 1,
    unitPrice: line.unitPrice,
    discount: line.discount ?? 0,
    tax: line.tax,
    staffCode: line.staffCode ?? null,
    position,
  }))
  const subtotal = rows.reduce(
    (sum, row) => sum + row.quantity * row.unitPrice,
    0,
  )
  const discount = rows.reduce((sum, row) => sum + row.discount, 0)
  const tax = rows.reduce((sum, row) => sum + row.tax, 0)

  return idsSchema.parse(
    await testApi().query(
      `with salon as (
         select id from salons where name = $1
       ), made as (
         insert into sales ("saleNumber", "salonId", "staffId", "saleDate", "saleTime",
                            subtotal, "discountAmount", "taxAmount", "totalAmount")
         select $2, salon.id, (select id from staff where "staffCode" = $3),
                (now() at time zone 'Asia/Tokyo')::date + $4::int,
                ((now() at time zone 'Asia/Tokyo')::date + $4::int + time '12:00') at time zone 'Asia/Tokyo',
                $5::int, $6::int, $7::int, $5::int - $6::int + $7::int
         from salon
         returning id
       ), lines as (
         insert into sales_details ("saleId", "itemType", "itemId", "itemName", quantity,
                                    "unitPrice", "discountAmount", "taxAmount", "totalAmount",
                                    "staffId", "sortOrder")
         select made.id, line."itemType", services.id, line."itemName", line.quantity,
                line."unitPrice", line.discount, line.tax,
                line.quantity * line."unitPrice" - line.discount + line.tax,
                staff.id, line.position
         from made
         cross join json_to_recordset($8::json) as line(
           "itemType" text, "itemName" text, quantity int, "unitPrice" int,
           discount int, tax int, "staffCode" text, position int)
         left join services on line."itemType" = 'service'
                           and services.name = line."itemName"
                           and services."salonId" = (select id from salon)
         left join staff on staff."staffCode" = line."staffCode"
       )
       select id::text from made`,
      [
        TOKYO,
        saleNumber,
        staffCode,
        day,
        subtotal,
        discount,
        tax,
        JSON.stringify(rows),
      ],
    ),
  )[0].id
}

/**
 * Lets a sale be paid by a method of the salon, as the counter would have,
 * and so much of it be given back.
 */
export const paySale = (
  saleId: string,
  method: ModelsPaymentMethodType,
  amount: number,
  refunded = 0,
): Promise<unknown> =>
  testApi().query(
    `insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber",
                                       amount, status, "processedAt",
                                       "refundAmount", "refundedAt", "refundReason")
     select sales.id, payment_methods.id, 'PT-' || gen_random_uuid(),
            $3::int, $5::payment_status, now(),
            nullif($4::int, 0), case when $4::int = 0 then null else now() end,
            case when $4::int = 0 then null else '返金' end
     from sales
     join payment_methods on payment_methods."salonId" = sales."salonId"
                         and payment_methods.method = $2::payment_method
     where sales.id = $1`,
    [
      saleId,
      method,
      amount,
      refunded,
      refunded === 0
        ? 'completed'
        : refunded === amount
          ? 'refunded'
          : 'partial_refund',
    ],
  )

/** Lets a sale be voided, as the owner would have done it. */
export const voidSale = (saleId: string): Promise<unknown> =>
  testApi().query(
    `update sales set "isVoid" = true, "voidedAt" = now(), "voidReason" = '入れ間違い'
     where id = $1`,
    [saleId],
  )

/** Lets the salon in Tokyo be removed meanwhile, as the operator of the platform would have. */
export const removeTokyo = (): Promise<unknown> =>
  testApi().query(`update salons set "deletedAt" = now() where name = $1`, [
    TOKYO,
  ])
