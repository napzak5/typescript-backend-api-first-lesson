import type { inventoryAlertAcknowledgements } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import type { DeepRequired, Omit } from '@beauty-salon-backend/utility'

// API types, generated from TypeSpec
export type ApiInventoryAlertResponse =
  components['schemas']['Models.InventoryAlertResponse']
export type ApiInventoryAlertAcknowledgementResponse =
  components['schemas']['Models.InventoryAlertAcknowledgementResponse']
export type ApiInventoryAlertAcknowledgeRequest =
  components['schemas']['Models.InventoryAlertAcknowledgeRequest']
export type ApiInventoryAlertSummaryResponse =
  components['schemas']['Models.InventoryAlertSummaryResponse']
export type ApiInventoryAlertSearchRequest =
  operations['InventoryAlertCrud_list']['parameters']['query']
export type ApiInventoryAlertSummaryRequest =
  operations['InventoryAlertCrud_getSummary']['parameters']['query']

// Database types, inferred from the Drizzle schema
export type DbInventoryAlertAcknowledgement = DeepRequired<
  typeof inventoryAlertAcknowledgements.$inferSelect
>
/** What an acknowledgement is written with; the database gives its time. */
export type DbNewInventoryAlertAcknowledgement = DeepRequired<
  Omit<
    typeof inventoryAlertAcknowledgements.$inferInsert,
    'id' | 'acknowledgedAt'
  >
>

/** What an alert is about. */
export type InventoryAlertType = DbInventoryAlertAcknowledgement['alert']
/** How soon an alert asks to be seen to. */
export type InventoryAlertSeverity = DbInventoryAlertAcknowledgement['severity']

/**
 * What the database tells of the stock of a salon for its alerts. Stock
 * figures are the text of a `numeric`, dates the text of a `date`. The
 * place of a product is where it stands among every product of the salon,
 * deleted ones included, by product code and then by ID: the order of the
 * alerts, which the database sorts by its collation.
 */

/**
 * An active product of the salon with stock rows there, whose stock is at
 * or below its minimum or above its maximum: the sum of the current stock
 * of its rows at the salon.
 */
export type DbProductStockOfAlert = {
  productId: string
  salonId: string
  productCode: string
  productName: string
  unit: string
  minimumStock: string
  maximumStock: string | null
  stock: string
  place: number
}

/**
 * A stock row of the salon with stock whose expiry date is at most the
 * last day that counts as expiring soon.
 */
export type DbStockRowOfAlert = {
  inventoryId: string
  salonId: string
  productId: string
  productCode: string
  productName: string
  unit: string
  lotNumber: string | null
  expiryDate: string
  currentStock: string
  place: number
}

/**
 * The latest acknowledgement of an alert, with what the stock has been
 * since. For a product: the lowest and the highest sum of its stock at the
 * salon from the time of the acknowledgement on, at that time and after
 * each moment at which a movement of it was recorded since. For a stock
 * row: the lowest stock it was left with by a movement since, null when
 * none was recorded.
 */
export type DbAcknowledgementOfAlert =
  | {
      type: 'product'
      acknowledgement: DbInventoryAlertAcknowledgement
      lowestStock: string
      highestStock: string
    }
  | {
      type: 'stockRow'
      acknowledgement: DbInventoryAlertAcknowledgement
      lowestStock: string | null
    }

/** Everything the alerts of a salon, or of one product or row, come from. */
export type DbInventoryAlertFacts = {
  products: DbProductStockOfAlert[]
  rows: DbStockRowOfAlert[]
  acknowledgements: DbAcknowledgementOfAlert[]
}

/**
 * Where an alert stands in the list: by the place of its product; the alert
 * of a product before those of its stock rows, which go by expiry date and
 * then by ID.
 */
export type InventoryAlertPosition = {
  place: number
  inventoryId: string | null
  expiryDate: string | null
}
