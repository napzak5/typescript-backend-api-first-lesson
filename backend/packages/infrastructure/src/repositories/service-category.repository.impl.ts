import { serviceCategories } from '@beauty-salon-backend/database'
import {
  type CategoryId,
  type DbNewServiceCategory,
  type DbServiceCategory,
  type DbServiceCategoryChanges,
  type DomainError,
  DomainErrors,
  type IServiceCategoryRepository,
  isWithinSubtree,
  type SalonId,
  type ServiceCategoryCreation,
  type ServiceCategoryList,
  type ServiceCategoryListCriteria,
  type ServiceCategoryUpdate,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, asc, count, eq, sql } from 'drizzle-orm'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'

const ofSalon = (salonId: SalonId, id: string) =>
  and(eq(serviceCategories.id, id), eq(serviceCategories.salonId, salonId))

/**
 * Locks every category of the salon, in the order of their IDs, and returns
 * the parent of each. Whoever is about to change the shape of the hierarchy
 * takes these locks first, always in this order: two such writes then run
 * one after the other, and neither waits for a row the other holds.
 */
const lockHierarchy = async (
  executor: DatabaseExecutor,
  salonId: SalonId,
): Promise<Map<string, string | null>> => {
  const rows = await executor
    .select({
      id: serviceCategories.id,
      parentId: serviceCategories.parentId,
    })
    .from(serviceCategories)
    .where(eq(serviceCategories.salonId, salonId))
    .orderBy(asc(serviceCategories.id))
    .for('update')

  return new Map(rows.map((row) => [row.id, row.parentId]))
}

export class ServiceCategoryRepository implements IServiceCategoryRepository {
  constructor(private readonly db: Database) {}

  async create(
    salonId: SalonId,
    category: DbNewServiceCategory,
  ): Promise<Result<ServiceCategoryCreation, DomainError>> {
    const created = await attempt('Failed to create service category', () =>
      this.db.transaction(
        async (tx): Promise<ServiceCategoryCreation | null> => {
          if (category.parentId !== null) {
            // The lock keeps the parent from being deleted before the
            // category is stored below it.
            const [parent] = await tx
              .select({ id: serviceCategories.id })
              .from(serviceCategories)
              .where(ofSalon(salonId, category.parentId))
              .for('key share')
            if (parent === undefined) {
              return { type: 'parentNotFound' }
            }
          }

          const [inserted] = await tx
            .insert(serviceCategories)
            .values({ ...category, salonId })
            .returning()

          return inserted === undefined
            ? null
            : { type: 'created', category: inserted }
        },
      ),
    )

    return Result.flatMap(created, (data) =>
      data === null
        ? Result.error(
            DomainErrors.database(
              'Insert of service category returned no row',
              null,
            ),
          )
        : Result.success(data),
    )
  }

  async findById(
    salonId: SalonId,
    id: CategoryId,
  ): Promise<Result<DbServiceCategory | null, DomainError>> {
    return attempt('Failed to find service category', async () => {
      const [category] = await this.db
        .select()
        .from(serviceCategories)
        .where(ofSalon(salonId, id))
        .limit(1)

      return category ?? null
    })
  }

  async list({
    salonId,
    limit,
    after,
    isActive,
  }: ServiceCategoryListCriteria): Promise<
    Result<ServiceCategoryList | null, DomainError>
  > {
    const filters = and(
      eq(serviceCategories.salonId, salonId),
      isActive === null ? undefined : eq(serviceCategories.isActive, isActive),
    )

    return attempt('Failed to list service categories', async () => {
      // Keyset pagination on (displayOrder, id): the page starts after the
      // category the cursor names, which must still be there to say where.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({
                displayOrder: serviceCategories.displayOrder,
                id: serviceCategories.id,
              })
              .from(serviceCategories)
              .where(ofSalon(salonId, after))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${serviceCategories.displayOrder}, ${serviceCategories.id}) > (${cursor.displayOrder}::integer, ${cursor.id}::uuid)`

      const [page, [matching]] = await Promise.all([
        this.db
          .select()
          .from(serviceCategories)
          .where(and(filters, afterCursor))
          .orderBy(
            asc(serviceCategories.displayOrder),
            asc(serviceCategories.id),
          )
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db
          .select({ total: count() })
          .from(serviceCategories)
          .where(filters),
      ])

      return {
        categories: page.slice(0, limit),
        total: matching?.total ?? 0,
        hasMore: page.length > limit,
      }
    })
  }

  async update(
    salonId: SalonId,
    id: CategoryId,
    changes: DbServiceCategoryChanges,
  ): Promise<Result<ServiceCategoryUpdate, DomainError>> {
    const { parentId } = changes

    return attempt('Failed to update service category', () =>
      this.db.transaction(async (tx): Promise<ServiceCategoryUpdate> => {
        if (parentId !== undefined && parentId !== null) {
          const parentOf = await lockHierarchy(tx, salonId)
          if (!parentOf.has(id)) {
            return { type: 'notFound' }
          }
          if (!parentOf.has(parentId)) {
            return { type: 'parentNotFound' }
          }
          if (isWithinSubtree(parentOf, id, parentId)) {
            return { type: 'parentWithinSubtree' }
          }
        }

        const [updated] = await tx
          .update(serviceCategories)
          .set({ ...changes, updatedAt: CLOCK })
          .where(ofSalon(salonId, id))
          .returning()

        return updated === undefined
          ? { type: 'notFound' }
          : { type: 'updated', category: updated }
      }),
    )
  }

  async delete(
    salonId: SalonId,
    id: CategoryId,
  ): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to delete service category', () =>
      this.db.transaction(async (tx) => {
        // Deleting a category moves its subcategories to the top, which
        // changes the hierarchy: the same locks as for a new parent.
        await lockHierarchy(tx, salonId)

        const deleted = await tx
          .delete(serviceCategories)
          .where(ofSalon(salonId, id))
          .returning({ id: serviceCategories.id })

        return deleted.length > 0
      }),
    )
  }
}
