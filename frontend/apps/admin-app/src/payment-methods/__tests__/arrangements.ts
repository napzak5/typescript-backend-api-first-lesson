import { idOf, testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the payment methods arrange in the database,
 * and read back from it. Every salon of the seed data has the same seven
 * methods, none of which a payment was received by: the seed data has no
 * sales.
 */

const storedSchema = z.array(
  z.object({
    method: z.string(),
    displayName: z.string(),
    description: z.string().nullable(),
    processorName: z.string().nullable(),
    fee: z.string().nullable(),
    minimumAmount: z.number().nullable(),
    maximumAmount: z.number().nullable(),
    isOnlineEnabled: z.boolean(),
    isOfflineEnabled: z.boolean(),
    sortOrder: z.number(),
    isActive: z.boolean(),
    updatedAt: z.string(),
  }),
)

/** The payment methods of a salon as the database keeps them, in their order. */
export const storedMethodsOf = async (name: string) =>
  storedSchema.parse(
    await testApi().query(
      `select p.method::text, p."displayName", p.description, p."processorName",
              p.fee::text, p."minimumAmount", p."maximumAmount", p."isOnlineEnabled",
              p."isOfflineEnabled", p."sortOrder", p."isActive", p."updatedAt"::text
       from payment_methods p join salons s on s.id = p."salonId"
       where s.name = $1
       order by p."sortOrder", p.id`,
      [name],
    ),
  )

/** The ID of a payment method of a salon, by its name. */
export const methodIdOf = async (
  salon: string,
  displayName: string,
): Promise<string> =>
  idOf(
    `select p.id::text from payment_methods p join salons s on s.id = p."salonId"
       where s.name = $1 and p."displayName" = $2`,
    [salon, displayName],
  )

/**
 * Lets the counter have received a payment by a method of a salon
 * meanwhile: a sale of ￥5,000 to nobody of the ledger, paid in full.
 */
export const paidMeanwhileBy = async (
  salon: string,
  displayName: string,
): Promise<string> =>
  idOf(
    `with method as (
         select p.id, p."salonId" from payment_methods p join salons s on s.id = p."salonId"
         where s.name = $1 and p."displayName" = $2
       ), sold as (
         insert into sales ("saleNumber", "salonId", "saleDate", "saleTime", subtotal,
                            "taxAmount", "totalAmount", "paymentStatus")
         select 'SL-TEST-0901', "salonId", (now() at time zone 'Asia/Tokyo')::date, now(),
                5000, 0, 5000, 'completed'
         from method
         returning id
       )
       insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber",
                                         amount, status, "processedAt")
       select sold.id, method.id, 'PT-TEST-0901', 5000, 'completed', now()
       from sold cross join method
       returning id::text`,
    [salon, displayName],
  )
