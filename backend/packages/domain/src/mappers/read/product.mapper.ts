import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiProductResponse, DbProduct } from '../../models/product'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'

/**
 * A row of `products` → API response. Property names are the column names;
 * what changes is the representation of the `numeric` stock levels, which
 * are read as text and returned as numbers, and of the timestamps, from
 * PostgreSQL's text format to ISO 8601.
 *
 * Every property is named: the time a product was deleted is not shown, and
 * a column added to the table is not shown by itself.
 */

const convertedColumnsSchema = z.object({
  minimumStock: numericSchema,
  maximumStock: numericSchema.nullable(),
  reorderPoint: numericSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const toApiProduct = (
  product: DbProduct,
): Result<ApiProductResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, product, 'Invalid stored product'),
      (converted) => ({
        id: product.id,
        salonId: product.salonId,
        productCode: product.productCode,
        name: product.name,
        description: product.description,
        category: product.category,
        brand: product.brand,
        purchasePrice: product.purchasePrice,
        retailPrice: product.retailPrice,
        salonPrice: product.salonPrice,
        unit: product.unit,
        minimumStock: converted.minimumStock,
        maximumStock: converted.maximumStock,
        reorderPoint: converted.reorderPoint,
        supplier: product.supplier,
        supplierProductCode: product.supplierProductCode,
        leadTimeDays: product.leadTimeDays,
        imageUrl: product.imageUrl,
        barcode: product.barcode,
        isForSale: product.isForSale,
        isForTreatment: product.isForTreatment,
        requiresLotTracking: product.requiresLotTracking,
        expiryMonths: product.expiryMonths,
        storageConditions: product.storageConditions,
        safetyDataSheet: product.safetyDataSheet,
        isActive: product.isActive,
        createdAt: converted.createdAt,
        updatedAt: converted.updatedAt,
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored product ${product.id} does not match the API model`,
        error,
      ),
  )

export const ProductReadMapper = {
  toApiProduct,

  toApiProducts(
    products: DbProduct[],
  ): Result<ApiProductResponse[], DomainError> {
    const apiProducts: ApiProductResponse[] = []
    for (const product of products) {
      const mapped = toApiProduct(product)
      if (mapped.type === 'error') {
        return mapped
      }
      apiProducts.push(mapped.data)
    }
    return Result.success(apiProducts)
  },
}
