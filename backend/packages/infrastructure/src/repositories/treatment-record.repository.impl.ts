import {
  bookings,
  customers,
  products,
  salons,
  services,
  staff,
  treatmentMaterials,
  treatmentPhotos,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import {
  creationIssues,
  type DbNewTreatmentMaterial,
  type DbTreatmentMaterial,
  type DbTreatmentPhoto,
  type DomainError,
  type ITreatmentRecordRepository,
  isTreated,
  type LedgerReach,
  type NamedOfTreatment,
  type ProductId,
  type ServiceId,
  type TreatmentRecordChange,
  type TreatmentRecordCreateCriteria,
  type TreatmentRecordCreation,
  type TreatmentRecordId,
  type TreatmentRecordListCriteria,
  type TreatmentRecordListing,
  type TreatmentRecordRemoval,
  type TreatmentRecordUpdateCriteria,
  type TreatmentRecordWithDetails,
  treatmentIssues,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'

/** The bookings of the salons the reach covers. */
const bookingsWithin = (reach: LedgerReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(bookings.salonId, salonId))
    .exhaustive()

/**
 * The records a reader is shown: those of the bookings of the salons the
 * reach covers, of the salon named when one is, and of a salon that is
 * not deleted. A record has no salon of its own; it is of the salon of its
 * booking.
 */
const shownTo = (
  executor: DatabaseExecutor,
  reach: LedgerReach,
  salonId: string | null,
): SQL =>
  exists(
    executor
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(salons, eq(salons.id, bookings.salonId))
      .where(
        and(
          eq(bookings.id, treatmentRecords.bookingId),
          isNull(salons.deletedAt),
          bookingsWithin(reach),
          salonId === null ? undefined : eq(bookings.salonId, salonId),
        ),
      ),
  )

const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

/**
 * The creation of a record as a response shows it, to the millisecond: a
 * filter by the time a client was shown matches the record it was shown.
 */
const createdAt = sql`date_trunc('milliseconds', ${treatmentRecords.createdAt})`

/** The materials and the photos of the records, by the record, each in its order. */
const detailsOf = async (
  executor: DatabaseExecutor,
  recordIds: string[],
): Promise<{
  materials: Map<string, DbTreatmentMaterial[]>
  photos: Map<string, DbTreatmentPhoto[]>
}> => {
  const [materialRows, photoRows] =
    recordIds.length === 0
      ? [[], []]
      : [
          await executor
            .select()
            .from(treatmentMaterials)
            .where(inArray(treatmentMaterials.treatmentRecordId, recordIds))
            .orderBy(
              asc(treatmentMaterials.treatmentRecordId),
              asc(treatmentMaterials.sortOrder),
            ),
          await executor
            .select()
            .from(treatmentPhotos)
            .where(inArray(treatmentPhotos.treatmentRecordId, recordIds))
            .orderBy(
              asc(treatmentPhotos.treatmentRecordId),
              asc(treatmentPhotos.sortOrder),
              asc(treatmentPhotos.createdAt),
              asc(treatmentPhotos.id),
            ),
        ]
  const materials = new Map<string, DbTreatmentMaterial[]>()
  for (const row of materialRows) {
    materials.set(row.treatmentRecordId, [
      ...(materials.get(row.treatmentRecordId) ?? []),
      row,
    ])
  }
  const photos = new Map<string, DbTreatmentPhoto[]>()
  for (const row of photoRows) {
    photos.set(row.treatmentRecordId, [
      ...(photos.get(row.treatmentRecordId) ?? []),
      row,
    ])
  }
  return { materials, photos }
}

/** The record with its materials and photos, if the reader is shown it. */
const recordOf = async (
  executor: DatabaseExecutor,
  id: TreatmentRecordId,
  reach: LedgerReach,
): Promise<TreatmentRecordWithDetails | null> => {
  const [record] = await executor
    .select()
    .from(treatmentRecords)
    .where(and(eq(treatmentRecords.id, id), shownTo(executor, reach, null)))
  if (record === undefined) {
    return null
  }
  const { materials, photos } = await detailsOf(executor, [record.id])

  return {
    record,
    materials: materials.get(record.id) ?? [],
    photos: photos.get(record.id) ?? [],
  }
}

/**
 * Of the services a request names, those that are of the salon and not
 * deleted. They are read with the lock that a removal of a service takes
 * its own after, in the order of their IDs: one that is being removed is
 * read as it is once removed.
 */
const servicesOf = async (
  executor: DatabaseExecutor,
  salonId: string,
  named: NamedOfTreatment,
): Promise<Set<ServiceId>> => {
  const serviceIds = [
    ...new Set([
      ...(named.services ?? []),
      ...(named.nextRecommendedServices ?? []),
    ]),
  ]
  const found =
    serviceIds.length === 0
      ? []
      : await executor
          .select({ id: services.id })
          .from(services)
          .where(
            and(
              inArray(services.id, serviceIds),
              eq(services.salonId, salonId),
              isNull(services.deletedAt),
            ),
          )
          .orderBy(asc(services.id))
          .for('key share')

  return new Set(
    serviceIds.filter((serviceId) => found.some(({ id }) => id === serviceId)),
  )
}

/**
 * Of the products a request names, those that are of the salon and not
 * deleted, with whether each is kept by lots; read as the services are.
 */
const productsOf = async (
  executor: DatabaseExecutor,
  salonId: string,
  named: NamedOfTreatment,
): Promise<Map<ProductId, boolean>> => {
  const productIds = [
    ...new Set((named.materials ?? []).map(({ productId }) => productId)),
  ]
  const found =
    productIds.length === 0
      ? []
      : await executor
          .select({
            id: products.id,
            requiresLotTracking: products.requiresLotTracking,
          })
          .from(products)
          .where(
            and(
              inArray(products.id, productIds),
              eq(products.salonId, salonId),
              isNull(products.deletedAt),
            ),
          )
          .orderBy(asc(products.id))
          .for('key share')

  return new Map(
    productIds.flatMap((productId): [ProductId, boolean][] => {
      const product = found.find(({ id }) => id === productId)
      return product === undefined
        ? []
        : [[productId, product.requiresLotTracking]]
    }),
  )
}

/** The materials of a record, in the order of the request, written at the moment. */
const materialRowsOf = (
  recordId: string,
  materials: DbNewTreatmentMaterial[],
) =>
  materials.map((material, sortOrder) => ({
    ...material,
    treatmentRecordId: recordId,
    sortOrder,
    createdAt: CLOCK,
  }))

export class TreatmentRecordRepository implements ITreatmentRecordRepository {
  constructor(private readonly db: Database) {}

  async create({
    reach,
    record,
    materials,
  }: TreatmentRecordCreateCriteria): Promise<
    Result<TreatmentRecordCreation, DomainError>
  > {
    return attempt('Failed to create treatment record', () =>
      this.db.transaction(
        async (tx): Promise<TreatmentRecordCreation> => {
          // The booking is held, so that a change of its status and its
          // removal, which hold it for an update, come before this or
          // after it: a booking that is being removed is gone once this
          // statement returns, and one whose status is being changed is
          // read as it is once changed.
          const [booking] = await tx
            .select({
              salonId: bookings.salonId,
              customerId: bookings.customerId,
              status: bookings.status,
              bookingDate: bookings.bookingDate,
            })
            .from(bookings)
            .where(
              and(eq(bookings.id, record.bookingId), bookingsWithin(reach)),
            )
            .for('share')
          if (booking === undefined) {
            return { type: 'bookingNotFound' }
          }
          // A salon that is being removed is read as it is once removed.
          const [salon] = await tx
            .select({ id: salons.id })
            .from(salons)
            .where(
              and(eq(salons.id, booking.salonId), isNull(salons.deletedAt)),
            )
            .for('key share')
          if (salon === undefined) {
            return { type: 'bookingNotFound' }
          }

          const [customer] = await tx
            .select({ id: customers.id })
            .from(customers)
            .where(
              and(
                eq(customers.id, record.customerId),
                isNull(customers.deletedAt),
              ),
            )
            .for('key share')
          const named: NamedOfTreatment = { ...record, materials }
          const knownServices = await servicesOf(tx, booking.salonId, named)
          const [member] = await tx
            .select({ id: staff.id })
            .from(staff)
            .where(
              and(
                eq(staff.id, record.staffId),
                eq(staff.salonId, booking.salonId),
                isNull(staff.deletedAt),
              ),
            )
            .for('key share')
          const knownProducts = await productsOf(tx, booking.salonId, named)
          const issues = creationIssues(
            {
              bookingDate: booking.bookingDate,
              services: knownServices,
              products: knownProducts,
              customerOfBooking:
                customer !== undefined &&
                booking.customerId === record.customerId,
              staffOfSalon: member !== undefined,
            },
            named,
          )
          if (issues.length > 0) {
            return { type: 'refused', issues }
          }
          if (!isTreated(booking.status)) {
            return { type: 'bookingNotTreated', status: booking.status }
          }

          const [stored] = await tx
            .insert(treatmentRecords)
            .values({ ...record, createdAt: CLOCK, updatedAt: CLOCK })
            .onConflictDoNothing({ target: treatmentRecords.bookingId })
            .returning()
          if (stored === undefined) {
            return { type: 'recordExists' }
          }
          const storedMaterials =
            materials.length === 0
              ? []
              : await tx
                  .insert(treatmentMaterials)
                  .values(materialRowsOf(stored.id, materials))
                  .returning()

          return {
            type: 'created',
            record: {
              record: stored,
              materials: storedMaterials.toSorted(
                (left, right) => left.sortOrder - right.sortOrder,
              ),
              photos: [],
            },
          }
        },
        // A request that waited for the booking, the salon, the customer,
        // a service, the staff member or a product sees what it waited for.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async findById(
    reach: LedgerReach,
    id: TreatmentRecordId,
  ): Promise<Result<TreatmentRecordWithDetails | null, DomainError>> {
    return attempt('Failed to find treatment record', () =>
      this.db.transaction((tx) => recordOf(tx, id, reach), AT_ONE_MOMENT),
    )
  }

  async list({
    reach,
    limit,
    after,
    salonId,
    customerId,
    staffId,
    startDate,
    endDate,
  }: TreatmentRecordListCriteria): Promise<
    Result<TreatmentRecordListing, DomainError>
  > {
    const filters = and(
      shownTo(this.db, reach, salonId),
      customerId === null
        ? undefined
        : eq(treatmentRecords.customerId, customerId),
      staffId === null ? undefined : eq(treatmentRecords.staffId, staffId),
      startDate === null
        ? undefined
        : sql`${createdAt} >= ${startDate}::timestamptz`,
      endDate === null
        ? undefined
        : sql`${createdAt} <= ${endDate}::timestamptz`,
    )

    return attempt('Failed to list treatment records', () =>
      this.db.transaction(async (tx): Promise<TreatmentRecordListing> => {
        // Keyset pagination on (createdAt, id), downwards: the page starts
        // after the record the cursor names, which has to be one the reader
        // is shown.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({ createdAt: treatmentRecords.createdAt })
                .from(treatmentRecords)
                .where(
                  and(eq(treatmentRecords.id, after), shownTo(tx, reach, null)),
                )
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }
        const afterCursor =
          after === null || cursor === undefined
            ? undefined
            : sql`(${treatmentRecords.createdAt}, ${treatmentRecords.id}) < (${cursor.createdAt}::timestamptz, ${after}::uuid)`

        const found = await tx
          .select()
          .from(treatmentRecords)
          .where(and(filters, afterCursor))
          .orderBy(desc(treatmentRecords.createdAt), desc(treatmentRecords.id))
          // One extra record tells whether another page follows.
          .limit(limit + 1)
        const page = found.slice(0, limit)
        const { materials, photos } = await detailsOf(
          tx,
          page.map(({ id }) => id),
        )
        const [matching] = await tx
          .select({ total: count() })
          .from(treatmentRecords)
          .where(filters)

        return {
          type: 'listed',
          records: page.map((record) => ({
            record,
            materials: materials.get(record.id) ?? [],
            photos: photos.get(record.id) ?? [],
          })),
          total: matching?.total ?? 0,
          hasMore: found.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }

  async update(
    reach: LedgerReach,
    id: TreatmentRecordId,
    { changes, materials }: TreatmentRecordUpdateCriteria,
  ): Promise<Result<TreatmentRecordChange, DomainError>> {
    return attempt('Failed to update treatment record', () =>
      this.db.transaction(
        async (tx): Promise<TreatmentRecordChange> => {
          // The record is held, so that two changes of it, and a change
          // and its removal, come one after the other. Its booking, whose
          // treatment has begun, keeps its salon and its date: a booking
          // is moved only before the visit.
          const [held] = await tx
            .select({
              salonId: bookings.salonId,
              bookingDate: bookings.bookingDate,
            })
            .from(treatmentRecords)
            .innerJoin(bookings, eq(bookings.id, treatmentRecords.bookingId))
            .innerJoin(salons, eq(salons.id, bookings.salonId))
            .where(
              and(
                eq(treatmentRecords.id, id),
                isNull(salons.deletedAt),
                bookingsWithin(reach),
              ),
            )
            .for('update', { of: treatmentRecords })
          if (held === undefined) {
            return { type: 'notFound' }
          }

          const named: NamedOfTreatment = {
            ...changes,
            ...(materials === null ? {} : { materials }),
          }
          const issues = treatmentIssues(
            {
              bookingDate: held.bookingDate,
              services: await servicesOf(tx, held.salonId, named),
              products: await productsOf(tx, held.salonId, named),
            },
            named,
          )
          if (issues.length > 0) {
            return { type: 'refused', issues }
          }

          await tx
            .update(treatmentRecords)
            .set({ ...changes, updatedAt: CLOCK })
            .where(eq(treatmentRecords.id, id))
          if (materials !== null) {
            await tx
              .delete(treatmentMaterials)
              .where(eq(treatmentMaterials.treatmentRecordId, id))
            if (materials.length > 0) {
              await tx
                .insert(treatmentMaterials)
                .values(materialRowsOf(id, materials))
            }
          }
          const record = await recordOf(tx, id, reach)

          return record === null
            ? { type: 'notFound' }
            : { type: 'changed', record }
        },
        // A request that waited for the record, a service or a product sees
        // what it waited for.
        { isolationLevel: 'read committed' },
      ),
    )
  }

  async delete(
    reach: LedgerReach,
    id: TreatmentRecordId,
  ): Promise<Result<TreatmentRecordRemoval, DomainError>> {
    return attempt(
      'Failed to delete treatment record',
      async (): Promise<TreatmentRecordRemoval> => {
        // The materials and the photos go with the record (CASCADE).
        const removed = await this.db
          .delete(treatmentRecords)
          .where(
            and(eq(treatmentRecords.id, id), shownTo(this.db, reach, null)),
          )
          .returning({ id: treatmentRecords.id })

        return removed.length === 0 ? { type: 'notFound' } : { type: 'removed' }
      },
    )
  }
}
