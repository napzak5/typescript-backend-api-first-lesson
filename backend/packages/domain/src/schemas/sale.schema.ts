import { PaymentStatusTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import { bookingIdSchema } from '../models/booking'
import { customerIdSchema } from '../models/customer'
import {
  type ApiSaleCalculateRequest,
  type ApiSaleCreateRequest,
  type ApiSaleSearchRequest,
  type ApiSalesDetail,
  type ApiSaleUpdateRequest,
  type ApiSaleVoidRequest,
  saleIdSchema,
} from '../models/sale'
import { salonIdSchema } from '../models/salon'
import { serviceIdSchema } from '../models/service'
import { staffIdSchema } from '../models/staff'
import { uuidSchema } from '../shared'
import {
  atLeastOneProperty,
  MAX_INTEGER,
  momentInUtc,
  nonBlankText,
} from './rules'

/**
 * Validation of sale requests. The shapes are checked against the generated
 * API types, the length limits are those of the database columns, and the
 * remaining rules are business rules. The rules that need what a sale
 * refers to (the salon, the customer, the staff members, the booking and
 * what was sold) are the repository's, which reads them while it writes.
 */

/** A sale has no more lines than this. */
export const MAX_SALE_DETAILS = 100

/** A line that sells a service: its `itemId` is a service of the salon. */
export const SERVICE_ITEM = 'service'

/** A line that sells a product: its `itemId` is a product of the salon. */
export const PRODUCT_ITEM = 'product'

/** An amount of money or of points: a whole number an `integer` column holds. */
const amount = z.number().int().min(0).max(MAX_INTEGER)

const salesDetailShape = z.strictObject({
  itemType: nonBlankText.max(50),
  itemId: uuidSchema.nullable(),
  itemName: nonBlankText.max(255),
  quantity: z.number().int().min(1).max(MAX_INTEGER),
  unitPrice: amount,
  discountAmount: amount,
  taxAmount: amount,
  totalAmount: amount,
  staffId: staffIdSchema.nullable(),
  // The column keeps two decimal places.
  commissionRate: z.number().min(0).max(100).multipleOf(0.01).nullable(),
  commissionAmount: amount.nullable(),
  notes: nonBlankText.nullable(),
  sortOrder: amount,
})

/**
 * A line of a sale as a request states it. The till works the amounts out
 * and the line has to agree with itself: the product of two integers need
 * not be one a number holds exactly, so it is worked out as a bigint.
 *
 * Only a line of a service or of a product names a record: nothing says
 * which table the ID of another line would be of.
 *
 * What is wrong with a line is reported with `continue`: the rules of the
 * lines taken together and of the sale are looked at all the same, and a
 * request learns everything that is wrong with it at once.
 */
const salesDetailSchema = salesDetailShape.check((context) => {
  const { itemType, itemId, quantity, unitPrice } = context.value
  const { discountAmount, taxAmount, totalAmount } = context.value

  // An amount out of its range has been reported as that, and a line is
  // only worked out from amounts.
  if (
    [quantity, unitPrice, discountAmount, taxAmount, totalAmount].every(
      (value) => value >= 0 && value <= MAX_INTEGER,
    )
  ) {
    const price = BigInt(quantity) * BigInt(unitPrice)
    if (BigInt(discountAmount) > price) {
      context.issues.push({
        code: 'custom',
        path: ['discountAmount'],
        message: 'Must not be more than quantity times unitPrice',
        input: discountAmount,
        continue: true,
      })
    }
    if (
      BigInt(totalAmount) !==
      price - BigInt(discountAmount) + BigInt(taxAmount)
    ) {
      context.issues.push({
        code: 'custom',
        path: ['totalAmount'],
        message:
          'Must be quantity times unitPrice, less discountAmount, plus taxAmount',
        input: totalAmount,
        continue: true,
      })
    }
  }
  if (
    itemId !== null &&
    itemType !== SERVICE_ITEM &&
    itemType !== PRODUCT_ITEM
  ) {
    context.issues.push({
      code: 'custom',
      path: ['itemId'],
      message: `Must be null unless itemType is ${SERVICE_ITEM} or ${PRODUCT_ITEM}`,
      input: itemId,
      continue: true,
    })
  }
}) satisfies z.ZodType<ApiSalesDetail>

/** A line of a sale that passed the rules of its own. */
export type SalesDetailRequest = z.infer<typeof salesDetailSchema>

/**
 * The lines of a sale have an order, which is how a receipt lists them: a
 * line that has the `sortOrder` of an earlier one is reported.
 */
const salesDetailListSchema = z
  .array(salesDetailSchema)
  .min(1)
  .max(MAX_SALE_DETAILS)
  .check((context) => {
    const seen = new Set<number>()
    context.value.forEach(({ sortOrder }, index) => {
      if (seen.has(sortOrder)) {
        context.issues.push({
          code: 'custom',
          path: [index, 'sortOrder'],
          message: 'Must not repeat the sortOrder of an earlier line',
          input: sortOrder,
          continue: true,
        })
      }
      seen.add(sortOrder)
    })
  })

export const POINTS_OF_A_CUSTOMER: readonly ('pointsUsed' | 'pointsEarned')[] =
  ['pointsUsed', 'pointsEarned']

/** What points are told that a sale without a customer states. */
export const NO_POINTS_FOR_NOBODY = 'Must be null for a sale without a customer'

/** What a request states of a sale, to enter it or to correct it. */
const statedOfSale = {
  customerId: customerIdSchema.nullable(),
  staffId: staffIdSchema.nullable(),
  bookingId: bookingIdSchema.nullable(),
  saleTime: momentInUtc,
  pointsUsed: amount.nullable(),
  pointsEarned: amount.nullable(),
  notes: nonBlankText.nullable(),
  details: salesDetailListSchema,
}

export const saleCreateRequestSchema = z
  .strictObject({ salonId: salonIdSchema, ...statedOfSale })
  // Points are a customer's: a sale to nobody uses and earns none.
  .check((context) => {
    if (context.value.customerId !== null) {
      return
    }
    for (const points of POINTS_OF_A_CUSTOMER) {
      if (context.value[points] !== null) {
        context.issues.push({
          code: 'custom',
          path: [points],
          message: NO_POINTS_FOR_NOBODY,
          input: context.value[points],
        })
      }
    }
  }) satisfies z.ZodType<ApiSaleCreateRequest>

/** A create request that passed the rules of its own. */
export type SaleCreateRequest = z.infer<typeof saleCreateRequestSchema>

/**
 * A correction names what it changes, and the salon is not among it: a
 * sale does not move. The rules that span several properties are held
 * against the sale as it is after the correction, which the request alone
 * does not tell (`planSaleChange`).
 */
export const saleUpdateRequestSchema = z
  .strictObject(statedOfSale)
  .exactPartial()
  .check(atLeastOneProperty) satisfies z.ZodType<ApiSaleUpdateRequest>

/** A correction that passed the rules of its own. */
export type SaleUpdateRequest = z.infer<typeof saleUpdateRequestSchema>

export const saleVoidRequestSchema = z.strictObject({
  voidReason: nonBlankText.nullable(),
}) satisfies z.ZodType<ApiSaleVoidRequest>

/** A request to void a sale that passed the rules of its own. */
export type SaleVoidRequest = z.infer<typeof saleVoidRequestSchema>

/**
 * A calculation names the salon, the booking whose service lines it counts
 * and the services it adds to them, each of which becomes a line of the
 * sale. Whether that comes to a line at all is known once the booking is
 * read (`planCalculation`).
 */
export const saleCalculateRequestSchema = z.strictObject({
  salonId: salonIdSchema,
  bookingId: bookingIdSchema.nullable(),
  services: z.array(serviceIdSchema).max(MAX_SALE_DETAILS),
}) satisfies z.ZodType<ApiSaleCalculateRequest>

/** A calculation that passed the rules of its own. */
export type SaleCalculateRequest = z.infer<typeof saleCalculateRequestSchema>

const saleSearch = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: saleIdSchema.exactOptional(),
  salonId: salonIdSchema.exactOptional(),
  customerId: customerIdSchema.exactOptional(),
  bookingId: bookingIdSchema.exactOptional(),
  paymentStatus: PaymentStatusTypeSchema.exactOptional(),
  startDate: z.iso.date().exactOptional(),
  endDate: z.iso.date().exactOptional(),
})

/** Two dates in the same format compare as text. */
export const saleSearchRequestSchema = saleSearch.refine(
  ({ startDate, endDate }) =>
    startDate === undefined || endDate === undefined || startDate <= endDate,
  { path: ['endDate'], message: 'Must not be earlier than startDate' },
) satisfies z.ZodType<ApiSaleSearchRequest>
