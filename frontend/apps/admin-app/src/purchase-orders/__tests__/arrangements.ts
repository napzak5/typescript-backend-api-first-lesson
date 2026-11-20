import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the purchase orders arrange in the database,
 * and read back from it. The salon in Tokyo of the seed data has two
 * orders of Beauty Supply Tokyo, entered by an administrator: PO-SEED-0001,
 * waiting for approval, of 10 bottles of its shampoo and 5 of its
 * conditioner at ￥1,500; and PO-SEED-0002, made just after, placed with
 * the supplier, of 12 jars of its mask at ￥2,000, with ￥800 of shipping,
 * to be delivered in a week. The salon in Osaka has none.
 */

const storedSchema = z.array(
  z.object({
    orderNumber: z.string(),
    supplier: z.string(),
    status: z.string(),
    subtotal: z.number(),
    taxAmount: z.number(),
    shippingCost: z.number().nullable(),
    totalAmount: z.number(),
    expectedDelivery: z.string().nullable(),
    paymentTerms: z.string().nullable(),
    notes: z.string().nullable(),
    createdBy: z.string().nullable(),
  }),
)

/**
 * The orders of a salon as the database keeps them, the first made first:
 * the day of delivery at the salon, and who made each, by the name the
 * salon shows.
 */
export const storedOrdersOf = async (salon: string) =>
  storedSchema.parse(
    await testApi().query(
      `select po."orderNumber", po.supplier, po.status::text, po.subtotal,
              po."taxAmount", po."shippingCost", po."totalAmount",
              (po."expectedDelivery" at time zone s.timezone)::text as "expectedDelivery",
              po."paymentTerms", po.notes, st."displayName" as "createdBy"
       from purchase_orders po
         join salons s on s.id = po."salonId"
         left join staff st on st.id = po."createdBy"
       where s.name = $1
       order by po."orderDate", po.id`,
      [salon],
    ),
  )

const itemsSchema = z.array(
  z.object({
    productCode: z.string(),
    quantity: z.string(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    notes: z.string().nullable(),
    kept: z.boolean(),
  }),
)

/** The items of an order as the database keeps them, in their order; whether each still names a stock row. */
export const storedItemsOf = async (orderNumber: string) =>
  itemsSchema.parse(
    await testApi().query(
      `select i."productCode", i.quantity::text, i."unitPrice", i."totalPrice",
              i.notes, i."inventoryId" is not null as kept
       from purchase_order_items i
         join purchase_orders po on po.id = i."purchaseOrderId"
       where po."orderNumber" = $1
       order by i."sortOrder"`,
      [orderNumber],
    ),
  )

const idsSchema = z.tuple([z.object({ id: z.uuid() })])

/** The ID of an order, by its number. */
export const orderIdOf = async (orderNumber: string): Promise<string> =>
  idsSchema.parse(
    await testApi().query(
      'select id::text from purchase_orders where "orderNumber" = $1',
      [orderNumber],
    ),
  )[0].id

/**
 * Lets a salon have more orders than a page holds: drafts of no items of
 * 「Pad Supply」, of the numbers 「PO-PAD-01」 on, as many as `count`, each
 * made a day before the one before it, the first a day before the seed.
 */
export const padOrdersOf = async (
  salon: string,
  count: number,
): Promise<void> => {
  await testApi().query(
    `insert into purchase_orders ("salonId", "orderNumber", supplier, subtotal, "taxAmount", "totalAmount", "orderDate")
     select s.id, 'PO-PAD-' || lpad(n::text, 2, '0'), 'Pad Supply', 0, 0, 0,
            now() - make_interval(days => n)
     from salons s, generate_series(1, $2::int) n
     where s.name = $1`,
    [salon, count],
  )
}

const daysSchema = z.tuple([
  z.object({ ordered: z.iso.date(), delivery: z.iso.date().nullable() }),
])

/** The days at the salon an order was made on and is to be delivered on: the seed makes its orders when it runs. */
export const daysOf = async (orderNumber: string) =>
  daysSchema.parse(
    await testApi().query(
      `select to_char(po."orderDate" at time zone s.timezone, 'YYYY-MM-DD') as ordered,
              to_char(po."expectedDelivery" at time zone s.timezone, 'YYYY-MM-DD') as delivery
       from purchase_orders po join salons s on s.id = po."salonId"
       where po."orderNumber" = $1`,
      [orderNumber],
    ),
  )[0]
