import { inventory, products } from '@beauty-salon-backend/database'
import {
  brokenOrders,
  type DbNewProduct,
  type DbProduct,
  type DbProductChanges,
  type DomainError,
  DomainErrors,
  type IProductRepository,
  type ProductId,
  type ProductList,
  type ProductListCriteria,
  type ProductRemoval,
  type ProductUpdate,
  type SalonId,
  stockLevelsAfter,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { and, asc, count, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { match, P } from 'ts-pattern'
import { CLOCK } from '../database/clock'
import { totalOf } from '../database/count'
import { describeDatabaseError } from '../database/failure'
import type { Database } from '../database/index'
import { containing } from '../database/like'
import { rowWritten } from '../database/written'
import { uniqueViolation } from './_shared/unique-violation'

const codeUniqueViolation = uniqueViolation('products_code_salon_unique')

/**
 * Turns a failed write into a domain error. The unique index on the product
 * code, which covers the products of a salon that are not deleted, is the
 * only expected failure, and only of a write that names a code. Anything
 * else is unexpected and keeps a description that is safe to log.
 */
const toDomainError =
  (message: string, productCode: string | undefined) =>
  (cause: unknown): DomainError =>
    match({ cause, productCode })
      .with(
        {
          productCode: P.string,
          cause: codeUniqueViolation,
        },
        (violation) =>
          DomainErrors.alreadyExists(
            entityMessages.product,
            'productCode',
            violation.productCode,
          ),
      )
      .otherwise(() =>
        DomainErrors.database(message, describeDatabaseError(cause)),
      )

const attempt = async <T>(
  message: string,
  productCode: string | undefined,
  run: () => Promise<T>,
): Promise<Result<T, DomainError>> =>
  Result.mapError(
    await Result.fromPromise(run()),
    toDomainError(message, productCode),
  )

/** A product of the salon that is not deleted. */
const ofSalon = (salonId: SalonId, id: ProductId) =>
  and(
    eq(products.id, id),
    eq(products.salonId, salonId),
    isNull(products.deletedAt),
  )

/** A stock level as the driver reads and writes `numeric`: as text. */
const toLevel = (value: string): number => Number(value)

const toNullableLevel = (value: string | null): number | null =>
  value === null ? null : toLevel(value)

export class ProductRepository implements IProductRepository {
  constructor(private readonly db: Database) {}

  async create(
    salonId: SalonId,
    product: DbNewProduct,
  ): Promise<Result<DbProduct, DomainError>> {
    const created = await attempt(
      'Failed to create product',
      product.productCode,
      () =>
        this.db
          .insert(products)
          .values({ ...product, salonId })
          .returning(),
    )

    return Result.flatMap(created, rowWritten('Insert of product'))
  }

  async findById(
    salonId: SalonId,
    id: ProductId,
  ): Promise<Result<DbProduct | null, DomainError>> {
    return attempt('Failed to find product', undefined, async () => {
      const [product] = await this.db
        .select()
        .from(products)
        .where(ofSalon(salonId, id))
        .limit(1)

      return product ?? null
    })
  }

  async list({
    salonId,
    limit,
    after,
    keyword,
    category,
    barcode,
    isActive,
    isForSale,
    isForTreatment,
  }: ProductListCriteria): Promise<Result<ProductList | null, DomainError>> {
    const filters = and(
      eq(products.salonId, salonId),
      isNull(products.deletedAt),
      keyword === null
        ? undefined
        : or(
            ilike(products.name, containing(keyword)),
            ilike(products.productCode, containing(keyword)),
            ilike(products.brand, containing(keyword)),
          ),
      category === null ? undefined : eq(products.category, category),
      barcode === null ? undefined : eq(products.barcode, barcode),
      isActive === null ? undefined : eq(products.isActive, isActive),
      isForSale === null ? undefined : eq(products.isForSale, isForSale),
      isForTreatment === null
        ? undefined
        : eq(products.isForTreatment, isForTreatment),
    )

    return attempt('Failed to list products', undefined, async () => {
      // Keyset pagination on (productCode, id): the page starts after the
      // product the cursor names, which must still be there to say where.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ productCode: products.productCode, id: products.id })
              .from(products)
              .where(ofSalon(salonId, after))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${products.productCode}, ${products.id}) > (${cursor.productCode}::varchar, ${cursor.id}::uuid)`

      const [page, counted] = await Promise.all([
        this.db
          .select()
          .from(products)
          .where(and(filters, afterCursor))
          .orderBy(asc(products.productCode), asc(products.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(products).where(filters),
      ])

      return {
        products: page.slice(0, limit),
        total: totalOf(counted),
        hasMore: page.length > limit,
      }
    })
  }

  async update(
    salonId: SalonId,
    id: ProductId,
    changes: DbProductChanges,
  ): Promise<Result<ProductUpdate, DomainError>> {
    return attempt('Failed to update product', changes.productCode, () =>
      this.db.transaction(
        async (tx): Promise<ProductUpdate> => {
          // Held, the stock levels are what they are when the change is
          // written: a change of another level at the same moment has been
          // written by the time this statement returns the row.
          const [held] = await tx
            .select({
              minimumStock: products.minimumStock,
              reorderPoint: products.reorderPoint,
              maximumStock: products.maximumStock,
            })
            .from(products)
            .where(ofSalon(salonId, id))
            .for('update')
          if (held === undefined) {
            return { type: 'notFound' }
          }
          const broken = brokenOrders(
            stockLevelsAfter(
              {
                minimumStock: toLevel(held.minimumStock),
                reorderPoint: toNullableLevel(held.reorderPoint),
                maximumStock: toNullableLevel(held.maximumStock),
              },
              {
                ...(changes.minimumStock === undefined
                  ? {}
                  : { minimumStock: toLevel(changes.minimumStock) }),
                ...(changes.reorderPoint === undefined
                  ? {}
                  : { reorderPoint: toNullableLevel(changes.reorderPoint) }),
                ...(changes.maximumStock === undefined
                  ? {}
                  : { maximumStock: toNullableLevel(changes.maximumStock) }),
              },
            ),
          )
          if (broken.length > 0) {
            return { type: 'stockLevelsOutOfOrder', broken }
          }

          const [updated] = await tx
            .update(products)
            .set({ ...changes, updatedAt: CLOCK })
            .where(eq(products.id, id))
            .returning()

          return updated === undefined
            ? { type: 'notFound' }
            : { type: 'updated', product: updated }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async delete(
    salonId: SalonId,
    id: ProductId,
  ): Promise<Result<ProductRemoval, DomainError>> {
    return attempt('Failed to delete product', undefined, () =>
      this.db.transaction(
        async (tx): Promise<ProductRemoval> => {
          // The lock is the one that the foreign key of a stock row waits
          // for: a stock row that is being written for this product is
          // there by the time the next statement looks for one.
          const [held] = await tx
            .select({ id: products.id })
            .from(products)
            .where(ofSalon(salonId, id))
            .for('update')
          if (held === undefined) {
            return { type: 'notFound' }
          }

          const [stock] = await tx
            .select({ id: inventory.id })
            .from(inventory)
            .where(eq(inventory.productId, id))
            .limit(1)
          if (stock !== undefined) {
            return { type: 'inStock' }
          }

          await tx
            .update(products)
            .set({ deletedAt: CLOCK, updatedAt: CLOCK })
            .where(eq(products.id, id))

          return { type: 'deleted' }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }
}
