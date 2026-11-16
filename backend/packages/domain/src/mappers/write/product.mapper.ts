import type {
  ApiProductCreateRequest,
  ApiProductUpdateRequest,
  DbNewProduct,
  DbProductChanges,
} from '../../models/product'

/**
 * API request → database row. Property names are the column names, so the
 * only conversion is the representation of the `numeric` stock levels,
 * which the driver reads and writes as strings to keep their precision.
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
}
