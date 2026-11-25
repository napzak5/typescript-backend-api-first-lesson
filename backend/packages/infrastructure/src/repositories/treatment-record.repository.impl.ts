import {
  bookings,
  customers,
  products,
  salons,
  serviceCategories,
  services,
  staff,
  treatmentMaterials,
  treatmentPhotos,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import {
  creationIssues,
  type DbNewTreatmentMaterial,
  type DbNewTreatmentPhoto,
  type DbTreatmentMaterial,
  type DomainError,
  type ITreatmentRecordRepository,
  isTreated,
  type LedgerReach,
  type NamedOfTreatment,
  type ProductId,
  photoAdditionRefusal,
  type ServiceId,
  type TreatmentFigures,
  type TreatmentPhotoAddition,
  type TreatmentPhotoId,
  type TreatmentPhotoRemoval,
  type TreatmentRecordChange,
  type TreatmentRecordCreateCriteria,
  type TreatmentRecordCreation,
  type TreatmentRecordId,
  type TreatmentRecordListCriteria,
  type TreatmentRecordListing,
  type TreatmentRecordRemoval,
  type TreatmentRecordUpdateCriteria,
  type TreatmentRecordWithDetails,
  type TreatmentStatisticsCriteria,
  treatmentIssues,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  asc,
  count,
  countDistinct,
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
import { aggregateOf } from '../database/aggregate'
import { attempt } from '../database/attempt'
import { CLOCK, CLOCK_ONCE, ONE_MOMENT } from '../database/clock'
import { totalOf } from '../database/count'
import type { Database, DatabaseExecutor } from '../database/index'
import { rowWritten, writtenFor } from '../database/written'
import { detailsOf } from './_shared/treatment-details'

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
 * The record, held with the lock of the write of its `updatedAt`, if the
 * writer reaches it: two writes of its photos come one after the other,
 * and the second counts what the first wrote. An update and a removal of
 * the record wait for it, and it for them.
 */
const heldRecordOf = async (
  executor: DatabaseExecutor,
  reach: LedgerReach,
  id: TreatmentRecordId,
): Promise<boolean> => {
  const [held] = await executor
    .select({ id: treatmentRecords.id })
    .from(treatmentRecords)
    .where(and(eq(treatmentRecords.id, id), shownTo(executor, reach, null)))
    .for('no key update')
  return held !== undefined
}

/** The records of the statistics: those of the salon's bookings in the period. */
const ofPeriod = ({
  salonId,
  startDate,
  endDate,
}: TreatmentStatisticsCriteria) =>
  and(
    eq(bookings.salonId, salonId),
    startDate === null
      ? undefined
      : sql`${createdAt} >= ${startDate}::timestamptz`,
    endDate === null ? undefined : sql`${createdAt} <= ${endDate}::timestamptz`,
  )

/** The most services the statistics list. */
const TOP_SERVICES = 10

const figuresOf = async (
  tx: DatabaseExecutor,
  criteria: TreatmentStatisticsCriteria,
): Promise<TreatmentFigures | null> => {
  const [salon] = await tx
    .select({ id: salons.id })
    .from(salons)
    .where(and(eq(salons.id, criteria.salonId), isNull(salons.deletedAt)))
  if (salon === undefined) {
    return null
  }

  const totals = aggregateOf(
    await tx
      .select({
        total: count(),
        processingTimeSum:
          sql<number>`coalesce(sum(${treatmentRecords.processingTime}), 0)`.mapWith(
            Number,
          ),
        processingTimeCount: count(treatmentRecords.processingTime),
      })
      .from(treatmentRecords)
      .innerJoin(bookings, eq(bookings.id, treatmentRecords.bookingId))
      .where(ofPeriod(criteria)),
    { total: 0, processingTimeSum: 0, processingTimeCount: 0 },
  )

  // One row for each service a record of the period states.
  const servicesOfRecords = tx
    .select({
      recordId: sql<string>`${treatmentRecords.id}`.as('recordId'),
      serviceId:
        sql<string>`jsonb_array_elements_text(${treatmentRecords.services})`.as(
          'serviceId',
        ),
    })
    .from(treatmentRecords)
    .innerJoin(bookings, eq(bookings.id, treatmentRecords.bookingId))
    .where(ofPeriod(criteria))
    .as('services_of_records')

  // A service without a category is of the kind other, as a service of a
  // category of that kind; a record counts once for each kind.
  const kind = sql`coalesce(${serviceCategories.category}, 'other')`.mapWith(
    serviceCategories.category,
  )
  const byCategory = await tx
    .select({
      category: kind,
      count: countDistinct(servicesOfRecords.recordId),
    })
    .from(servicesOfRecords)
    .leftJoin(
      services,
      sql`${services.id} = ${servicesOfRecords.serviceId}::uuid`,
    )
    .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .groupBy(kind)
    .orderBy(
      desc(countDistinct(servicesOfRecords.recordId)),
      sql`${kind}::text`,
    )

  const topServices = await tx
    .select({
      serviceId: servicesOfRecords.serviceId,
      count: countDistinct(servicesOfRecords.recordId),
    })
    .from(servicesOfRecords)
    .groupBy(servicesOfRecords.serviceId)
    .orderBy(
      desc(countDistinct(servicesOfRecords.recordId)),
      asc(servicesOfRecords.serviceId),
    )
    .limit(TOP_SERVICES)

  return { ...totals, byCategory, topServices }
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

/**
 * Writes the materials of a record, in the order of the request, at the
 * moment, and answers with the rows written, in that order.
 */
const insertMaterials = async (
  executor: DatabaseExecutor,
  recordId: string,
  materials: DbNewTreatmentMaterial[],
): Promise<Result<DbTreatmentMaterial[], DomainError>> => {
  const rows = materials.map((material, sortOrder) => ({
    ...material,
    treatmentRecordId: recordId,
    sortOrder,
    createdAt: CLOCK,
  }))
  const inserted =
    rows.length === 0
      ? []
      : await executor.insert(treatmentMaterials).values(rows).returning()
  const placeOf = ({ sortOrder }: { sortOrder: number }): string =>
    String(sortOrder)

  return Result.map(
    writtenFor('Insert of treatment materials')(
      rows,
      placeOf,
      inserted,
      placeOf,
    ),
    (pairs) => pairs.map(({ row }) => row),
  )
}

export class TreatmentRecordRepository implements ITreatmentRecordRepository {
  constructor(private readonly db: Database) {}

  async create({
    reach,
    record,
    materials,
  }: TreatmentRecordCreateCriteria): Promise<
    Result<TreatmentRecordCreation, DomainError>
  > {
    const created = await attempt('Failed to create treatment record', () =>
      this.db.transaction(
        async (tx): Promise<Result<TreatmentRecordCreation, DomainError>> => {
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
            return Result.success({ type: 'bookingNotFound' })
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
            return Result.success({ type: 'bookingNotFound' })
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
            return Result.success({ type: 'refused', issues })
          }
          if (!isTreated(booking.status)) {
            return Result.success({
              type: 'bookingNotTreated',
              status: booking.status,
            })
          }

          const [stored] = await tx
            .with(CLOCK_ONCE)
            .insert(treatmentRecords)
            .values({ ...record, createdAt: ONE_MOMENT, updatedAt: ONE_MOMENT })
            .onConflictDoNothing({ target: treatmentRecords.bookingId })
            .returning()
          if (stored === undefined) {
            return Result.success({ type: 'recordExists' })
          }

          return Result.map(
            await insertMaterials(tx, stored.id, materials),
            (storedMaterials): TreatmentRecordCreation => ({
              type: 'created',
              record: {
                record: stored,
                materials: storedMaterials,
                photos: [],
              },
            }),
          )
        },
        // A request that waited for the booking, the salon, the customer,
        // a service, the staff member or a product sees what it waited for.
        { isolationLevel: 'read committed' },
      ),
    )

    return Result.flatMap(created, (outcome) => outcome)
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
                .select({
                  createdAt: treatmentRecords.createdAt,
                  id: treatmentRecords.id,
                })
                .from(treatmentRecords)
                .where(
                  and(eq(treatmentRecords.id, after), shownTo(tx, reach, null)),
                )
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }
        const afterCursor =
          cursor === undefined
            ? undefined
            : sql`(${treatmentRecords.createdAt}, ${treatmentRecords.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`

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
        const counted = await tx
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
          total: totalOf(counted),
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
    const changed = await attempt('Failed to update treatment record', () =>
      this.db.transaction(
        async (tx): Promise<Result<TreatmentRecordChange, DomainError>> => {
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
            return Result.success({ type: 'notFound' })
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
            return Result.success({ type: 'refused', issues })
          }

          const record = rowWritten('Update of treatment record')(
            await tx
              .update(treatmentRecords)
              .set({ ...changes, updatedAt: CLOCK })
              .where(eq(treatmentRecords.id, id))
              .returning(),
          )
          if (record.type === 'error') {
            return record
          }
          if (materials !== null) {
            await tx
              .delete(treatmentMaterials)
              .where(eq(treatmentMaterials.treatmentRecordId, id))
            const replaced = await insertMaterials(tx, id, materials)
            if (replaced.type === 'error') {
              return replaced
            }
          }
          // The record as it was written, with what it holds now.
          const details = await detailsOf(tx, [id])

          return Result.success({
            type: 'changed',
            record: {
              record: record.data,
              materials: details.materials.get(id) ?? [],
              photos: details.photos.get(id) ?? [],
            },
          })
        },
        // A request that waited for the record, a service or a product sees
        // what it waited for.
        { isolationLevel: 'read committed' },
      ),
    )

    return Result.flatMap(changed, (outcome) => outcome)
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

  async addPhotos(
    reach: LedgerReach,
    id: TreatmentRecordId,
    photos: DbNewTreatmentPhoto[],
  ): Promise<Result<TreatmentPhotoAddition, DomainError>> {
    const added = await attempt('Failed to add treatment photos', () =>
      this.db.transaction(
        async (tx): Promise<Result<TreatmentPhotoAddition, DomainError>> => {
          if (!(await heldRecordOf(tx, reach, id))) {
            return Result.success({ type: 'notFound' })
          }
          const held = await tx
            .select({ photoUrl: treatmentPhotos.photoUrl })
            .from(treatmentPhotos)
            .where(eq(treatmentPhotos.treatmentRecordId, id))
          const refusal = photoAdditionRefusal(
            held.map(({ photoUrl }) => photoUrl),
            photos,
          )
          if (refusal !== null) {
            return Result.success({ type: 'refused', refusal })
          }

          // The record changes at the moment the photos are added.
          const changed = rowWritten(
            'Update of treatment record of added photos',
          )(
            await tx
              .update(treatmentRecords)
              .set({ updatedAt: CLOCK })
              .where(eq(treatmentRecords.id, id))
              .returning({ at: treatmentRecords.updatedAt }),
          )
          if (changed.type === 'error') {
            return changed
          }
          const inserted = await tx
            .insert(treatmentPhotos)
            .values(
              photos.map((photo) => ({
                ...photo,
                treatmentRecordId: id,
                createdAt: changed.data.at,
              })),
            )
            .returning()
          // An address is of one photo.
          const addressOf = ({ photoUrl }: { photoUrl: string }): string =>
            photoUrl

          return Result.map(
            writtenFor('Insert of treatment photos')(
              photos,
              addressOf,
              inserted,
              addressOf,
            ),
            (pairs): TreatmentPhotoAddition => ({
              type: 'added',
              recordId: id,
              // In the order they were given.
              photos: pairs.map(({ row }) => row),
            }),
          )
        },
        // An addition that waited for the record counts the photos it
        // waited for.
        { isolationLevel: 'read committed' },
      ),
    )

    return Result.flatMap(added, (outcome) => outcome)
  }

  async removePhoto(
    reach: LedgerReach,
    id: TreatmentRecordId,
    photoId: TreatmentPhotoId,
  ): Promise<Result<TreatmentPhotoRemoval, DomainError>> {
    const removed = await attempt('Failed to remove treatment photo', () =>
      this.db.transaction(
        async (tx): Promise<Result<TreatmentPhotoRemoval, DomainError>> => {
          if (!(await heldRecordOf(tx, reach, id))) {
            return Result.success({ type: 'recordNotFound' })
          }
          const photo = await tx
            .delete(treatmentPhotos)
            .where(
              and(
                eq(treatmentPhotos.id, photoId),
                eq(treatmentPhotos.treatmentRecordId, id),
              ),
            )
            .returning({ id: treatmentPhotos.id })
          if (photo.length === 0) {
            return Result.success({ type: 'photoNotFound' })
          }
          const changed = await tx
            .update(treatmentRecords)
            .set({ updatedAt: CLOCK })
            .where(eq(treatmentRecords.id, id))
            .returning({ id: treatmentRecords.id })

          return Result.map(
            rowWritten('Update of treatment record of removed photo')(changed),
            (): TreatmentPhotoRemoval => ({ type: 'removed' }),
          )
        },
        { isolationLevel: 'read committed' },
      ),
    )

    return Result.flatMap(removed, (outcome) => outcome)
  }

  async findFigures(
    criteria: TreatmentStatisticsCriteria,
  ): Promise<Result<TreatmentFigures | null, DomainError>> {
    return attempt('Failed to count treatment records', () =>
      this.db.transaction((tx) => figuresOf(tx, criteria), AT_ONE_MOMENT),
    )
  }
}
