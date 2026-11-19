import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the sales arrange in the database, and read
 * back from it. The bookings they bill are arranged as the tests of the
 * bookings arrange them; the seed data has no sales.
 */

const idsSchema = z.tuple([z.object({ id: z.uuid() })])

/**
 * Puts the sale of a booking into the database, as the ledger would have
 * it: entered today at a time of day in Tokyo, for the customer and the
 * member of the booking, a line for each line of the booking at its price,
 * its tax in the price, nothing paid.
 */
export const arrangeSale = async ({
  saleNumber,
  bookingId,
  at,
}: {
  saleNumber: string
  bookingId: string
  /** The time of day in Tokyo: `10:00` */
  at: string
}): Promise<string> =>
  idsSchema.parse(
    await testApi().query(
      `with booking as (
         select * from bookings where id = $1
       ), made as (
         insert into sales ("saleNumber", "salonId", "customerId", "staffId", "bookingId",
                            "saleDate", "saleTime", subtotal, "taxAmount", "totalAmount")
         select $2, "salonId", "customerId", "staffId", id,
                (now() at time zone 'Asia/Tokyo')::date,
                ((now() at time zone 'Asia/Tokyo')::date + $3::time) at time zone 'Asia/Tokyo',
                "totalAmount", 0, "totalAmount"
         from booking
         returning id
       ), lines as (
         insert into sales_details ("saleId", "itemType", "itemId", "itemName", quantity,
                                    "unitPrice", "taxAmount", "totalAmount", "staffId", "sortOrder")
         select made.id, 'service', booking_services."serviceId", services.name, 1,
                booking_services."finalPrice", 0, booking_services."finalPrice",
                booking_services."staffId", booking_services."sortOrder"
         from made
         cross join booking_services
         join services on services.id = booking_services."serviceId"
         where booking_services."bookingId" = $1
       )
       select id::text from made`,
      [bookingId, saleNumber, at],
    ),
  )[0].id

/** Lets a sale be voided, as the owner would have done it meanwhile. */
export const voidSale = (id: string): Promise<unknown> =>
  testApi().query(
    `update sales set "isVoid" = true, "voidedAt" = now(), "voidReason" = '入れ間違い'
     where id = $1`,
    [id],
  )

/** Lets a sale be paid in full in cash, as the counter would have done it meanwhile. */
export const paySale = (id: string): Promise<unknown> =>
  testApi().query(
    `with paid as (
       insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber",
                                         amount, status, "processedAt")
       select sales.id, payment_methods.id, 'PT-TEST-' || left(sales.id::text, 8),
              sales."totalAmount", 'completed', now()
       from sales
       join payment_methods on payment_methods."salonId" = sales."salonId"
                           and payment_methods.method = 'cash'
       where sales.id = $1
       returning "saleId"
     )
     update sales set "paymentStatus" = 'completed' from paid where sales.id = paid."saleId"`,
    [id],
  )

const storedSaleSchema = z.tuple([
  z.object({
    saleNumber: z.string(),
    staffCode: z.string().nullable(),
    customerEmail: z.string().nullable(),
    bookingId: z.string().nullable(),
    saleDate: z.string(),
    subtotal: z.number(),
    taxAmount: z.number(),
    totalAmount: z.number(),
    paymentStatus: z.string(),
    notes: z.string().nullable(),
    details: z.array(
      z.object({
        itemName: z.string(),
        staffCode: z.string().nullable(),
        unitPrice: z.number(),
        discountAmount: z.number(),
        taxAmount: z.number(),
        totalAmount: z.number(),
      }),
    ),
  }),
])

/** The sale of a booking as it is stored, with its lines in their order. */
export const storedSaleOf = async (bookingId: string) =>
  storedSaleSchema.parse(
    await testApi().query(
      `select sales."saleNumber", staff."staffCode", customers.email as "customerEmail",
              sales."bookingId"::text, to_char(sales."saleDate", 'YYYY-MM-DD') as "saleDate",
              sales.subtotal, sales."taxAmount", sales."totalAmount",
              sales."paymentStatus"::text, sales.notes,
              (select coalesce(json_agg(json_build_object(
                        'itemName', sales_details."itemName",
                        'staffCode', line_staff."staffCode",
                        'unitPrice', sales_details."unitPrice",
                        'discountAmount', sales_details."discountAmount",
                        'taxAmount', sales_details."taxAmount",
                        'totalAmount', sales_details."totalAmount")
                      order by sales_details."sortOrder"), '[]')
               from sales_details
               left join staff as line_staff on line_staff.id = sales_details."staffId"
               where sales_details."saleId" = sales.id) as details
       from sales
       left join staff on staff.id = sales."staffId"
       left join customers on customers.id = sales."customerId"
       where sales."bookingId" = $1 and not sales."isVoid"`,
      [bookingId],
    ),
  )[0]

const storedPaymentsSchema = z.array(
  z.object({
    method: z.string(),
    amount: z.number(),
    status: z.string(),
    cardLastFour: z.string().nullable(),
    cardBrand: z.string().nullable(),
  }),
)

/** The payments of a sale as they are stored, in the order they were recorded. */
export const storedPaymentsOf = async (saleId: string) =>
  storedPaymentsSchema.parse(
    await testApi().query(
      `select payment_methods.method::text, payment_transactions.amount,
              payment_transactions.status::text, payment_transactions."cardLastFour",
              payment_transactions."cardBrand"
       from payment_transactions
       join payment_methods on payment_methods.id = payment_transactions."paymentMethodId"
       where payment_transactions."saleId" = $1
       order by payment_transactions."createdAt", payment_transactions.id`,
      [saleId],
    ),
  )
