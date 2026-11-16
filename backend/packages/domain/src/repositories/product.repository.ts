import type { Result } from '@beauty-salon-backend/utility'
import type { StockLevelOrder } from '../business-logic/product/_shared/stock-levels'
import type {
  DbNewProduct,
  DbProduct,
  DbProductChanges,
  ProductId,
} from '../models/product'
import type { SalonId } from '../models/salon'
import type { DomainError } from '../shared'

/** Which products of a salon a list returns. A null filter does not restrict the list. */
export type ProductListCriteria = {
  salonId: SalonId
  limit: number
  /** Return the products that follow this one; null starts from the first. */
  after: ProductId | null
  /** Part of the name, the product code or the brand, in any case. */
  keyword: string | null
  category: string | null
  barcode: string | null
  isActive: boolean | null
  isForSale: boolean | null
  isForTreatment: boolean | null
}

export type ProductList = {
  products: DbProduct[]
  /** Number of products that match the filters, across all pages. */
  total: number
  hasMore: boolean
}

/** What became of a product that was to be changed. */
export type ProductUpdate =
  | { type: 'updated'; product: DbProduct }
  /** The salon has no such product, or it was deleted. */
  | { type: 'notFound' }
  /** After the change the stock levels would break these orders. */
  | { type: 'stockLevelsOutOfOrder'; broken: StockLevelOrder[] }

/** What became of a product that was to be deleted. */
export type ProductRemoval =
  | { type: 'deleted' }
  /** The salon has no such product, or it was deleted already. */
  | { type: 'notFound' }
  /** The product has stock rows: they are deleted first. */
  | { type: 'inStock' }

/**
 * Persistence of the products of a salon. Every method is given the salon
 * and sees only its products that are not deleted: a product of another
 * salon, and one that was deleted, is one that does not exist. Whether the
 * salon itself exists is not looked at here.
 *
 * A product code is unique among the products of a salon that are not
 * deleted: a create or a change that would repeat one resolves to an
 * `alreadyExists` error, also when another request wrote the code at the
 * same moment.
 *
 * A change and a removal hold the product while they decide: the stock
 * levels stay in order whatever changes at the same moment, and a product
 * whose stock is being recorded is not deleted.
 */
export interface IProductRepository {
  create(
    salonId: SalonId,
    product: DbNewProduct,
  ): Promise<Result<DbProduct, DomainError>>

  findById(
    salonId: SalonId,
    id: ProductId,
  ): Promise<Result<DbProduct | null, DomainError>>

  /**
   * In the order of the product codes, then of the IDs. Resolves to null
   * when the cursor (`after`) names no product of the salon: a deleted one
   * is gone, and nothing says where the page would begin.
   */
  list(
    criteria: ProductListCriteria,
  ): Promise<Result<ProductList | null, DomainError>>

  /**
   * Writes the changes and the time of the change, also when no value
   * differs from what is stored.
   */
  update(
    salonId: SalonId,
    id: ProductId,
    changes: DbProductChanges,
  ): Promise<Result<ProductUpdate, DomainError>>

  /** Marks the product deleted, with the time. */
  delete(
    salonId: SalonId,
    id: ProductId,
  ): Promise<Result<ProductRemoval, DomainError>>
}
