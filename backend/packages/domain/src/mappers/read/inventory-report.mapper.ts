import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiInventoryStockCountResponse,
  ApiInventoryValueReportResponse,
  DbInventoryTransaction,
} from '../../models/inventory'
import type {
  DbInventoryValueCategory,
  DbStockCountDiscrepancy,
} from '../../repositories/inventory.repository'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema } from './columns'
import { InventoryTransactionReadMapper } from './inventory-transaction.mapper'

/**
 * What a stock count did and what the stock of a salon is worth → API
 * responses. The `numeric` figures are read as text and returned as
 * numbers; the value of the stock is a whole number of yen, returned only
 * while a number holds it exactly.
 */

const discrepancySchema = z.object({
  expected: numericSchema,
  counted: numericSchema,
  difference: numericSchema,
}) satisfies z.ZodType<
  Pick<
    ApiInventoryStockCountResponse['discrepancies'][number],
    'expected' | 'counted' | 'difference'
  >
>

const MOST_EXACT = BigInt(Number.MAX_SAFE_INTEGER)

/** A whole number of yen that a number holds exactly. */
const yenSchema = z
  .string()
  .regex(/^[0-9]+$/)
  .transform((text) => BigInt(text))
  .refine((yen) => yen <= MOST_EXACT, 'Must be held exactly by a number')

type ValueCategory = ApiInventoryValueReportResponse['categories'][number]

/**
 * A category of the value report as the API shows it, but for its value: a
 * whole number of yen, summed exactly before it becomes a number.
 */
const valueCategorySchema = z.object({
  category: z.string().nullable(),
  value: yenSchema,
  itemCount: z.number().int().min(1),
}) satisfies z.ZodType<
  Pick<ValueCategory, 'category' | 'itemCount'> & { value: bigint }
>

export const InventoryReportReadMapper = {
  /** The adjustments of a count and the rows that differed, in the order of the count. */
  toApiStockCount(
    adjustments: DbInventoryTransaction[],
    discrepancies: DbStockCountDiscrepancy[],
  ): Result<ApiInventoryStockCountResponse, DomainError> {
    const differed: ApiInventoryStockCountResponse['discrepancies'] = []
    for (const discrepancy of discrepancies) {
      const figures = parseWith(
        discrepancySchema,
        discrepancy,
        'Invalid stored stock count',
      )
      if (figures.type === 'error') {
        return Result.error(
          DomainErrors.database(
            `The count of stock row ${discrepancy.inventoryId} does not match the API model`,
            figures.error,
          ),
        )
      }
      differed.push({ inventoryId: discrepancy.inventoryId, ...figures.data })
    }
    return Result.map(
      InventoryTransactionReadMapper.toApiInventoryTransactions(adjustments),
      (recorded) => ({ adjustments: recorded, discrepancies: differed }),
    )
  },

  /**
   * The value of the stock of a salon by category. The totals are the sums
   * of the categories, so the parts add up to them.
   */
  toApiValueReport(
    salonId: string,
    categories: DbInventoryValueCategory[],
  ): Result<ApiInventoryValueReportResponse, DomainError> {
    const parsed = parseWith(
      z.array(valueCategorySchema),
      categories,
      'Invalid stored stock value',
    )
    if (parsed.type === 'error') {
      return Result.error(
        DomainErrors.database(
          `The value of the stock of salon ${salonId} does not match the API model`,
          parsed.error,
        ),
      )
    }
    const totalValue = parsed.data.reduce((sum, { value }) => sum + value, 0n)
    if (totalValue > MOST_EXACT) {
      return Result.error(
        DomainErrors.database(
          `The value of the stock of salon ${salonId} is more than a number holds exactly`,
          null,
        ),
      )
    }
    return Result.success({
      totalValue: Number(totalValue),
      totalItems: parsed.data.reduce(
        (sum, { itemCount }) => sum + itemCount,
        0,
      ),
      categories: parsed.data.map(({ category, value, itemCount }) => ({
        category,
        value: Number(value),
        itemCount,
      })),
    })
  },
}
