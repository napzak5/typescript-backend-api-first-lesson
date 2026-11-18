import {
  bookingServices,
  serviceCategories,
  serviceOptions,
  services,
} from '@beauty-salon-backend/database'
import {
  type DbNewService,
  type DbNewServiceOption,
  type DbService,
  type DbServiceChanges,
  type DbServiceOption,
  type DomainError,
  DomainErrors,
  type IServiceRepository,
  type SalonId,
  type ServiceBulkUpdate,
  type ServiceCreation,
  type ServiceDeletion,
  type ServiceId,
  type ServiceList,
  type ServiceListCriteria,
  type ServiceOptionsChange,
  type ServiceUpdate,
  type ServiceWithOptions,
  type ServiceWriteRefusal,
  serviceRuleIssues,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  arrayContains,
  arrayOverlaps,
  asc,
  count,
  eq,
  inArray,
  isNull,
  notInArray,
  sql,
} from 'drizzle-orm'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { hasLineOfUnfinishedBooking } from './unfinished-bookings'

const notDeleted = isNull(services.deletedAt)

const ofSalon = (salonId: SalonId, id: string) =>
  and(eq(services.id, id), eq(services.salonId, salonId))

const selectOptions = async (
  executor: DatabaseExecutor,
  serviceIds: string[],
): Promise<DbServiceOption[]> =>
  serviceIds.length === 0
    ? []
    : executor
        .select()
        .from(serviceOptions)
        .where(inArray(serviceOptions.serviceId, serviceIds))
        .orderBy(asc(serviceOptions.sortOrder), asc(serviceOptions.id))

const insertOptions = async (
  executor: DatabaseExecutor,
  serviceIds: string[],
  rows: DbNewServiceOption[],
): Promise<void> => {
  if (serviceIds.length > 0 && rows.length > 0) {
    await executor
      .insert(serviceOptions)
      .values(
        serviceIds.flatMap((serviceId) =>
          rows.map((row) => ({ ...row, serviceId })),
        ),
      )
  }
}

const withOptions = async (
  executor: DatabaseExecutor,
  service: DbService,
): Promise<ServiceWithOptions> => ({
  service,
  options: await selectOptions(executor, [service.id]),
})

/**
 * Whether the salon has the category. The lock keeps the category from
 * being deleted before the service is stored in it.
 *
 * A write takes this lock before it locks services: deleting a category
 * holds the category and then takes its services out of it, in that order.
 */
const lockCategory = async (
  executor: DatabaseExecutor,
  salonId: SalonId,
  categoryId: string,
): Promise<boolean> => {
  const [category] = await executor
    .select({ id: serviceCategories.id })
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.id, categoryId),
        eq(serviceCategories.salonId, salonId),
      ),
    )
    .for('key share')

  return category !== undefined
}

/** What a write has to know of a service it changes or puts into a package. */
type LockedService = Pick<
  DbService,
  'id' | 'price' | 'discountPrice' | 'isPackage' | 'packageServiceIds'
> & { deletedAt: string | null }

/**
 * Locks the named services of the salon, deleted ones included, in the
 * order of their IDs, and returns them by ID. Every write that depends on
 * what several services are takes its locks here, always in this order: two
 * such writes then run one after the other, and neither waits for a row
 * the other holds.
 */
const lockServices = async (
  executor: DatabaseExecutor,
  salonId: SalonId,
  ids: string[],
): Promise<Map<string, LockedService>> => {
  const rows =
    ids.length === 0
      ? []
      : await executor
          .select({
            id: services.id,
            price: services.price,
            discountPrice: services.discountPrice,
            isPackage: services.isPackage,
            packageServiceIds: services.packageServiceIds,
            deletedAt: services.deletedAt,
          })
          .from(services)
          .where(and(eq(services.salonId, salonId), inArray(services.id, ids)))
          .orderBy(asc(services.id))
          .for('update')

  return new Map(rows.map((row) => [row.id, row]))
}

/**
 * Why the named services cannot be the members of a package, or null when
 * they can: each is a service of the salon that is not deleted and is not,
 * and does not become, a package.
 */
const memberRefusal = (
  locked: ReadonlyMap<string, LockedService>,
  memberIds: string[],
  becomingPackages: ReadonlySet<string>,
): ServiceWriteRefusal | null => {
  for (const memberId of memberIds) {
    const member = locked.get(memberId)
    if (member === undefined || member.deletedAt !== null) {
      return { type: 'packageMemberNotFound' }
    }
    if (member.isPackage || becomingPackages.has(memberId)) {
      return { type: 'packageMemberIsPackage' }
    }
  }
  return null
}

/**
 * Applies the same changes to the named services, to all or to none. The
 * caller's transaction holds the locks until the write is committed.
 */
const applyChanges = async (
  tx: DatabaseExecutor,
  salonId: SalonId,
  ids: ServiceId[],
  changes: DbServiceChanges,
  optionsChange: ServiceOptionsChange,
): Promise<ServiceBulkUpdate> => {
  const { categoryId, packageServiceIds } = changes
  const categoryMissing =
    categoryId !== undefined &&
    categoryId !== null &&
    !(await lockCategory(tx, salonId, categoryId))

  const locked = await lockServices(tx, salonId, [
    ...new Set([...ids, ...(packageServiceIds ?? [])]),
  ])

  const targets: { before: LockedService; after: LockedService }[] = []
  for (const id of ids) {
    const before = locked.get(id)
    if (before === undefined || before.deletedAt !== null) {
      return { type: 'notFound', id }
    }
    targets.push({ before, after: { ...before, ...changes } })
  }
  if (categoryMissing) {
    return { type: 'categoryNotFound' }
  }

  for (const { after } of targets) {
    const issues = serviceRuleIssues(after)
    if (issues.length > 0) {
      return { type: 'invalid', issues }
    }
  }

  const packages = targets.filter(({ after }) => after.isPackage)
  if (packageServiceIds !== undefined && packages.length > 0) {
    const refusal = memberRefusal(
      locked,
      packageServiceIds,
      new Set(packages.map(({ after }) => after.id)),
    )
    if (refusal !== null) {
      return refusal
    }
  }

  // A service becomes a package only together with its members, so the
  // services changed here get the members of the request, and only the
  // packages that are not changed here can still contain one of them.
  const newPackageIds = packages
    .filter(({ before }) => !before.isPackage)
    .map(({ after }) => after.id)
  if (newPackageIds.length > 0) {
    const [container] = await tx
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.salonId, salonId),
          notDeleted,
          eq(services.isPackage, true),
          arrayOverlaps(services.packageServiceIds, newPackageIds),
          notInArray(services.id, ids),
        ),
      )
      .limit(1)
    if (container !== undefined) {
      return { type: 'containedInPackage' }
    }
  }

  await tx
    .update(services)
    .set({ ...changes, updatedAt: CLOCK })
    .where(and(eq(services.salonId, salonId), inArray(services.id, ids)))

  await match(optionsChange)
    .with({ type: 'keep' }, async () => undefined)
    .with({ type: 'replace' }, async ({ options }) => {
      await tx
        .delete(serviceOptions)
        .where(inArray(serviceOptions.serviceId, ids))
      await insertOptions(tx, ids, options)
    })
    .exhaustive()

  return { type: 'updated' }
}

export class ServiceRepository implements IServiceRepository {
  constructor(private readonly db: Database) {}

  async create(
    salonId: SalonId,
    service: DbNewService,
    options: DbNewServiceOption[],
  ): Promise<Result<ServiceCreation, DomainError>> {
    const created = await attempt('Failed to create service', () =>
      this.db.transaction(async (tx): Promise<ServiceCreation | null> => {
        if (
          service.categoryId !== null &&
          !(await lockCategory(tx, salonId, service.categoryId))
        ) {
          return { type: 'categoryNotFound' }
        }

        if (service.isPackage) {
          const refusal = memberRefusal(
            await lockServices(tx, salonId, service.packageServiceIds),
            service.packageServiceIds,
            new Set(),
          )
          if (refusal !== null) {
            return refusal
          }
        }

        const [inserted] = await tx
          .insert(services)
          .values({ ...service, salonId })
          .returning()
        if (inserted === undefined) {
          return null
        }
        await insertOptions(tx, [inserted.id], options)

        return { type: 'created', service: await withOptions(tx, inserted) }
      }),
    )

    return Result.flatMap(created, (data) =>
      data === null
        ? Result.error(
            DomainErrors.database('Insert of service returned no row', null),
          )
        : Result.success(data),
    )
  }

  async findById(
    salonId: SalonId,
    id: ServiceId,
  ): Promise<Result<ServiceWithOptions | null, DomainError>> {
    return attempt('Failed to find service', async () => {
      const [service] = await this.db
        .select()
        .from(services)
        .where(and(ofSalon(salonId, id), notDeleted))
        .limit(1)

      return service === undefined ? null : withOptions(this.db, service)
    })
  }

  async list({
    salonId,
    limit,
    after,
    categoryId,
    isActive,
  }: ServiceListCriteria): Promise<Result<ServiceList | null, DomainError>> {
    const filters = and(
      eq(services.salonId, salonId),
      notDeleted,
      categoryId === null ? undefined : eq(services.categoryId, categoryId),
      isActive === null ? undefined : eq(services.isActive, isActive),
    )

    return attempt('Failed to list services', async () => {
      // Keyset pagination on (sortOrder, id): the page starts after the
      // service the cursor names. A deleted service keeps its row, so it
      // still says where.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ sortOrder: services.sortOrder, id: services.id })
              .from(services)
              .where(ofSalon(salonId, after))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        cursor === undefined
          ? undefined
          : sql`(${services.sortOrder}, ${services.id}) > (${cursor.sortOrder}::integer, ${cursor.id}::uuid)`

      const [page, [matching]] = await Promise.all([
        this.db
          .select()
          .from(services)
          .where(and(filters, afterCursor))
          .orderBy(asc(services.sortOrder), asc(services.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(services).where(filters),
      ])

      const pageServices = page.slice(0, limit)
      const optionsOf = Map.groupBy(
        await selectOptions(
          this.db,
          pageServices.map((service) => service.id),
        ),
        (option) => option.serviceId,
      )

      return {
        services: pageServices.map((service) => ({
          service,
          options: optionsOf.get(service.id) ?? [],
        })),
        total: matching?.total ?? 0,
        hasMore: page.length > limit,
      }
    })
  }

  async update(
    salonId: SalonId,
    id: ServiceId,
    changes: DbServiceChanges,
    options: ServiceOptionsChange,
  ): Promise<Result<ServiceUpdate, DomainError>> {
    return attempt('Failed to update service', () =>
      this.db.transaction(async (tx): Promise<ServiceUpdate> => {
        const applied = await applyChanges(tx, salonId, [id], changes, options)
        if (applied.type !== 'updated') {
          return applied
        }

        const [updated] = await tx
          .select()
          .from(services)
          .where(ofSalon(salonId, id))

        return updated === undefined
          ? { type: 'notFound', id }
          : { type: 'updated', service: await withOptions(tx, updated) }
      }),
    )
  }

  async updateMany(
    salonId: SalonId,
    ids: ServiceId[],
    changes: DbServiceChanges,
    options: ServiceOptionsChange,
  ): Promise<Result<ServiceBulkUpdate, DomainError>> {
    return attempt('Failed to update services', () =>
      this.db.transaction((tx) =>
        applyChanges(tx, salonId, ids, changes, options),
      ),
    )
  }

  async delete(
    salonId: SalonId,
    id: ServiceId,
  ): Promise<Result<ServiceDeletion, DomainError>> {
    return attempt('Failed to delete service', () =>
      this.db.transaction(
        async (tx): Promise<ServiceDeletion> => {
          // The lock makes this delete run after a write that puts the
          // service into a package and after an entry of a booking that has
          // it: what the delete looks for next is written by then.
          const locked = await lockServices(tx, salonId, [id])
          if (locked.get(id)?.deletedAt !== null) {
            return { type: 'notFound' }
          }

          const [container] = await tx
            .select({ id: services.id })
            .from(services)
            .where(
              and(
                eq(services.salonId, salonId),
                notDeleted,
                eq(services.isPackage, true),
                arrayContains(services.packageServiceIds, [id]),
              ),
            )
            .limit(1)
          if (container !== undefined) {
            return { type: 'containedInPackage' }
          }
          if (
            await hasLineOfUnfinishedBooking(
              tx,
              eq(bookingServices.serviceId, id),
            )
          ) {
            return { type: 'bookingsUnfinished' }
          }

          await tx
            .update(services)
            .set({ deletedAt: CLOCK, updatedAt: CLOCK })
            .where(ofSalon(salonId, id))

          return { type: 'deleted' }
        },
        { isolationLevel: 'read committed' },
      ),
    )
  }
}
