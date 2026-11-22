import type {
  ApiProductCreateRequest,
  ApiProductUpdateRequest,
  DbNewProduct,
  DbProductChanges,
} from '../../models/product'
import type { SalonId } from '../../models/salon'
import type { ProductListCriteria } from '../../repositories/product.repository'
import type { ProductSearchRequest } from '../../schemas/product.schema'
import { toPaging } from './page'

/**
 * API request → database row, or the criteria of the list. Property names
 * are the column names, so the only conversion is the representation of
 * the `numeric` stock levels, which the driver reads and writes as strings
 * to keep their precision.
 */

const toNumeric = (value: number): string => String(value)

const toNullableNumeric = (value: number | null): string | null =>
  value === null ? null : toNumeric(value)

export const ProductWriteMapper = {
  fromCreateRequest(request: ApiProductCreateRequest): DbNewProduct {
    const { minimumStock, maximumStock, reorderPoint, ...columns } = request

    return {
      ...columns,
      minimumStock: toNumeric(minimumStock),
      maximumStock: toNullableNumeric(maximumStock),
      reorderPoint: toNullableNumeric(reorderPoint),
    }
  },

  /** Only the properties present in the request become changes. */
  fromUpdateRequest(request: ApiProductUpdateRequest): DbProductChanges {
    const { minimumStock, maximumStock, reorderPoint, ...columns } = request

    return {
      ...columns,
      ...(minimumStock === undefined
        ? {}
        : { minimumStock: toNumeric(minimumStock) }),
      ...(maximumStock === undefined
        ? {}
        : { maximumStock: toNullableNumeric(maximumStock) }),
      ...(reorderPoint === undefined
        ? {}
        : { reorderPoint: toNullableNumeric(reorderPoint) }),
    }
  },

  /**
   * The criteria of the list of the products of a salon: a filter the
   * request does not name is none.
   */
  fromSearchRequest(
    request: ProductSearchRequest,
    salonId: SalonId,
  ): ProductListCriteria {
    return {
      salonId,
      ...toPaging(request),
      keyword: request.keyword ?? null,
      category: request.category ?? null,
      barcode: request.barcode ?? null,
      isActive: request.isActive ?? null,
      isForSale: request.isForSale ?? null,
      isForTreatment: request.isForTreatment ?? null,
    }
  },
}
