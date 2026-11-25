import {
  customers,
  treatmentMaterials,
  treatmentPhotos,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import {
  customerIdSchema,
  type DbBooking,
  type DbNewTreatmentMaterial,
  type DbNewTreatmentPhoto,
  type DbNewTreatmentRecord,
  type LedgerReach,
  type ProductId,
  productIdSchema,
  type SalonId,
  type ServiceId,
  salonIdSchema,
  serviceIdSchema,
  staffIdSchema,
  type TreatmentRecordId,
  type TreatmentRecordListCriteria,
  treatmentPhotoIdSchema,
  treatmentRecordIdSchema,
} from '@beauty-salon-backend/domain'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import {
  type HeldStatement,
  useTestDatabase,
} from '../../__tests__/_shared/database'
import { TreatmentRecordRepository } from '../treatment-record.repository.impl'
import {
  CANCELLED,
  COMPLETED,
  insertBooking,
  insertCategory,
  insertCustomer,
  insertProduct,
  insertSalon,
  insertService,
  insertStaffMember,
  insertTreatmentMaterial,
  insertTreatmentPhoto,
  insertTreatmentRecord,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new TreatmentRecordRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const reachOf = (salonId: SalonId): LedgerReach => ({ type: 'salon', salonId })

/** A fixed ID, so that a test decides which of two rows comes first. */
const idOf = (place: number): string =>
  `00000000-0000-4000-8000-${String(place).padStart(12, '0')}`

/** The columns of a row that was deleted on 9 December 2026. */
const DELETED = { deletedAt: '2026-12-09T05:00:00Z' }

const serviceIdOf = (row: { id: string }): ServiceId =>
  serviceIdSchema.parse(row.id)

const productIdOf = (row: { id: string }): ProductId =>
  productIdSchema.parse(row.id)

const recordIdOf = (row: { id: string }): TreatmentRecordId =>
  treatmentRecordIdSchema.parse(row.id)

/** A salon with a customer, a member of the staff and a service of its own. */
const storedSalon = async (
  overrides: Parameters<typeof insertSalon>[1] = {},
) => {
  const db = databases.database()
  const salonId = salonIdSchema.parse((await insertSalon(db, overrides)).id)
  return {
    salonId,
    customerId: (await insertCustomer(db)).id,
    staffId: (await insertStaffMember(db, salonId)).id,
    serviceId: serviceIdOf(await insertService(db, salonId)),
  }
}

type Salon = Awaited<ReturnType<typeof storedSalon>>

type BookingColumns = Parameters<typeof insertBooking>[2]

/** The columns of a booking whose treatment has begun. */
const IN_PROGRESS: BookingColumns = {
  status: 'in_progress',
  actualStartTime: '2026-12-07T01:00:00Z',
}

/** A booking of the salon on 7 December 2026, in progress unless the test says otherwise. */
const storedBooking = (salon: Salon, overrides: BookingColumns = IN_PROGRESS) =>
  insertBooking(databases.database(), salon, overrides)

/** A record of a booking of its own at the salon. */
const storedRecord = async (
  salon: Salon,
  overrides: Parameters<typeof insertTreatmentRecord>[2] = {},
) =>
  insertTreatmentRecord(
    databases.database(),
    {
      bookingId: (await storedBooking(salon, COMPLETED)).id,
      customerId: salon.customerId,
      staffId: salon.staffId,
      serviceId: salon.serviceId,
    },
    overrides,
  )

/** The record of a new booking of the salon as a request would have it written. */
const newRecord = (
  salon: Salon,
  bookingId: string,
  overrides: Partial<DbNewTreatmentRecord> = {},
): DbNewTreatmentRecord => ({
  bookingId,
  customerId: salon.customerId,
  staffId: salon.staffId,
  services: [salon.serviceId],
  techniques: ['ローライト'],
  consultationNotes: '前回より明るく',
  scalpCondition: null,
  hairCondition: '毛先が傷んでいる',
  colorFormula: '8 レベル ベージュ',
  processingTime: 90,
  resultNotes: null,
  nextRecommendedDate: '2027-01-07',
  nextRecommendedServices: [salon.serviceId],
  homeCareSuggestions: null,
  customerSatisfaction: 5,
  staffEvaluation: null,
  ...overrides,
})

const materialOf = (
  productId: ProductId,
  overrides: Partial<DbNewTreatmentMaterial> = {},
): DbNewTreatmentMaterial => ({
  productId,
  quantity: '30.00',
  unit: 'g',
  lotNumber: null,
  notes: null,
  ...overrides,
})

const photoOf = (
  photoUrl: string,
  overrides: Partial<DbNewTreatmentPhoto> = {},
): DbNewTreatmentPhoto => ({
  photoType: 'after',
  photoUrl,
  thumbnailUrl: null,
  angle: null,
  description: null,
  isPublic: false,
  customerConsent: false,
  sortOrder: 0,
  ...overrides,
})

/** The row of the record in the table, or undefined when there is none. */
const recordRowOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(treatmentRecords)
    .where(eq(treatmentRecords.id, id))
  return row
}

const materialsOf = (recordId: string) =>
  databases
    .database()
    .select()
    .from(treatmentMaterials)
    .where(eq(treatmentMaterials.treatmentRecordId, recordId))
    .orderBy(asc(treatmentMaterials.sortOrder))

const photosOf = (recordId: string) =>
  databases
    .database()
    .select()
    .from(treatmentPhotos)
    .where(eq(treatmentPhotos.treatmentRecordId, recordId))
    .orderBy(
      asc(treatmentPhotos.sortOrder),
      asc(treatmentPhotos.createdAt),
      asc(treatmentPhotos.id),
    )

/** The record as the repository answers with it, read from the tables. */
const detailedOf = async (id: string) => ({
  record: await recordRowOf(id),
  materials: await materialsOf(id),
  photos: await photosOf(id),
})

describe('TreatmentRecordRepository', () => {
  describe('create', () => {
    it('should write the record and its materials in their order, stamped once at the moment, and answer with them', async () => {
      // Arrange
      const db = databases.database()
      const salon = await storedSalon()
      const booking = await storedBooking(salon)
      const lots = await insertProduct(db, salon.salonId, {
        requiresLotTracking: true,
      })
      const plain = await insertProduct(db, salon.salonId)
      // A service of the salon that only the next visit names.
      const next = serviceIdOf(await insertService(db, salon.salonId))
      const record = newRecord(salon, booking.id, {
        nextRecommendedServices: [next],
      })
      const materials = [
        materialOf(productIdOf(plain), { quantity: '12.50' }),
        materialOf(productIdOf(lots), { lotNumber: 'L-2026-11', unit: 'ml' }),
      ]

      // Act
      const created = await repository().create({
        reach: reachOf(salon.salonId),
        record,
        materials,
      })

      // Assert
      const [row] = await databases
        .database()
        .select()
        .from(treatmentRecords)
        .where(eq(treatmentRecords.bookingId, booking.id))
      const stored = await detailedOf(row?.id ?? UNKNOWN_ID)
      expect(created).toEqual({
        type: 'success',
        data: { type: 'created', record: stored },
      })
      expect(stored.record).toMatchObject(record)
      expect(stored.record?.updatedAt).toBe(stored.record?.createdAt)
      expect(stored.materials).toMatchObject([
        { productId: plain.id, quantity: '12.50', sortOrder: 0 },
        { productId: lots.id, lotNumber: 'L-2026-11', sortOrder: 1 },
      ])
      expect(stored.photos).toEqual([])
    })

    it.each<[string, (salonId: SalonId) => LedgerReach, BookingColumns]>([
      ['the salon of the booking, in progress', reachOf, IN_PROGRESS],
      ['every salon, completed', () => EVERY_SALON, COMPLETED],
    ])(
      'should write the record of a booking of a writer of %s, without materials',
      async (_reach, reach, columns) => {
        // Arrange
        const salon = await storedSalon()
        const booking = await storedBooking(salon, columns)

        // Act
        const created = await repository().create({
          reach: reach(salon.salonId),
          record: newRecord(salon, booking.id),
          materials: [],
        })

        // Assert
        expect(created).toMatchObject({
          type: 'success',
          data: {
            type: 'created',
            record: {
              record: { bookingId: booking.id },
              materials: [],
              photos: [],
            },
          },
        })
      },
    )

    it.each<
      [
        string,
        () => Promise<{ reach: LedgerReach; salon: Salon; bookingId: string }>,
      ]
    >([
      [
        'of a salon the writer does not reach',
        async () => {
          const salon = await storedSalon()
          const booking = await storedBooking(salon)
          return {
            reach: reachOf((await storedSalon()).salonId),
            salon,
            bookingId: booking.id,
          }
        },
      ],
      [
        'of a salon that was deleted',
        async () => {
          const salon = await storedSalon(DELETED)
          const booking = await storedBooking(salon)
          return { reach: EVERY_SALON, salon, bookingId: booking.id }
        },
      ],
      [
        'of an ID that names none',
        async () => ({
          reach: EVERY_SALON,
          salon: await storedSalon(),
          bookingId: UNKNOWN_ID,
        }),
      ],
    ])('should write no record of a booking %s', async (_case, arrange) => {
      // Arrange
      const { reach, salon, bookingId } = await arrange()

      // Act
      const created = await repository().create({
        reach,
        record: newRecord(salon, bookingId),
        materials: [],
      })

      // Assert
      expect(created).toEqual({
        type: 'success',
        data: { type: 'bookingNotFound' },
      })
      expect(
        await databases.database().select().from(treatmentRecords),
      ).toEqual([])
    })

    it('should refuse what does not fit the booking, in the order of the request, before the status of the booking', async () => {
      // Arrange
      const salon = await storedSalon()
      const other = await storedSalon()
      const booking = await storedBooking(salon, { status: 'pending' })
      const db = databases.database()
      const deletedService = await insertService(db, salon.salonId, DELETED)
      const lots = await insertProduct(db, salon.salonId, {
        requiresLotTracking: true,
      })
      const plain = await insertProduct(db, salon.salonId)
      const deletedProduct = await insertProduct(db, salon.salonId, DELETED)

      // Act
      const created = await repository().create({
        reach: EVERY_SALON,
        record: newRecord(salon, booking.id, {
          customerId: other.customerId,
          staffId: other.staffId,
          services: [salon.serviceId, serviceIdOf(deletedService)],
          nextRecommendedDate: '2026-12-06',
          nextRecommendedServices: [other.serviceId],
        }),
        materials: [
          materialOf(productIdOf(lots)),
          materialOf(productIdOf(plain), { lotNumber: 'L-1' }),
          materialOf(productIdOf(deletedProduct)),
          materialOf(productIdOf(await insertProduct(db, other.salonId))),
        ],
      })

      // Assert
      expect(created).toMatchObject({
        type: 'success',
        data: {
          type: 'refused',
          issues: [
            { field: 'customerId' },
            { field: 'staffId' },
            { field: 'services.1' },
            { field: 'nextRecommendedDate' },
            { field: 'nextRecommendedServices.0' },
            { field: 'materials.0.lotNumber' },
            { field: 'materials.1.lotNumber' },
            { field: 'materials.2.productId' },
            { field: 'materials.3.productId' },
          ],
        },
      })
      expect(await db.select().from(treatmentRecords)).toEqual([])
    })

    it.each<
      [string, (salon: Salon) => Promise<Partial<DbNewTreatmentRecord>>, string]
    >([
      [
        'the customer of the booking, who was deleted',
        async (salon) => {
          await databases
            .database()
            .update(customers)
            .set(DELETED)
            .where(eq(customers.id, salon.customerId))
          return {}
        },
        'customerId',
      ],
      [
        'a member of the staff who was deleted',
        async (salon) => ({
          staffId: (
            await insertStaffMember(
              databases.database(),
              salon.salonId,
              DELETED,
            )
          ).id,
        }),
        'staffId',
      ],
      [
        'a service of an ID that names none',
        async () => ({ services: [serviceIdSchema.parse(UNKNOWN_ID)] }),
        'services.0',
      ],
    ])(
      'should refuse a record that names %s',
      async (_case, changesOf, field) => {
        // Arrange
        const salon = await storedSalon()
        const booking = await storedBooking(salon)
        const changes = await changesOf(salon)

        // Act
        const created = await repository().create({
          reach: EVERY_SALON,
          record: newRecord(salon, booking.id, changes),
          materials: [],
        })

        // Assert
        expect(created).toMatchObject({
          type: 'success',
          data: { type: 'refused', issues: [{ field }] },
        })
      },
    )

    it.each<[DbBooking['status'], BookingColumns]>([
      ['draft', { status: 'draft' }],
      ['pending', { status: 'pending' }],
      ['confirmed', { status: 'confirmed' }],
      ['cancelled', CANCELLED],
      ['no_show', { status: 'no_show' }],
    ])(
      'should write no record of a booking that is %s',
      async (status, columns) => {
        // Arrange
        const salon = await storedSalon()
        const booking = await storedBooking(salon, columns)

        // Act
        const created = await repository().create({
          reach: EVERY_SALON,
          record: newRecord(salon, booking.id),
          materials: [],
        })

        // Assert
        expect(created).toEqual({
          type: 'success',
          data: { type: 'bookingNotTreated', status },
        })
      },
    )

    it('should write no second record of a booking, nor its materials', async () => {
      // Arrange
      const salon = await storedSalon()
      const record = await storedRecord(salon)
      const product = await insertProduct(databases.database(), salon.salonId)

      // Act
      const created = await repository().create({
        reach: EVERY_SALON,
        record: newRecord(salon, record.bookingId),
        materials: [materialOf(productIdOf(product))],
      })

      // Assert
      expect(created).toEqual({
        type: 'success',
        data: { type: 'recordExists' },
      })
      expect(
        await databases.database().select().from(treatmentRecords),
      ).toEqual([record])
      expect(
        await databases.database().select().from(treatmentMaterials),
      ).toEqual([])
    })

    it.each<
      [
        string,
        (
          salon: Salon,
          ids: { bookingId: string; productId: string },
        ) => [HeldStatement, HeldStatement],
        unknown,
      ]
    >([
      [
        'the booking, cancelled meanwhile',
        (_salon, { bookingId }) => [
          (held) =>
            held`select id from bookings where id = ${bookingId} for update`,
          (held) =>
            held`update bookings set status = 'cancelled', "cancelledAt" = now() where id = ${bookingId}`,
        ],
        { type: 'bookingNotTreated', status: 'cancelled' },
      ],
      [
        'the salon, deleted meanwhile',
        ({ salonId }) => [
          (held) =>
            held`select id from salons where id = ${salonId} for update`,
          (held) =>
            held`update salons set "deletedAt" = now() where id = ${salonId}`,
        ],
        { type: 'bookingNotFound' },
      ],
      [
        'the customer, deleted meanwhile',
        ({ customerId }) => [
          (held) =>
            held`select id from customers where id = ${customerId} for update`,
          (held) =>
            held`update customers set "deletedAt" = now() where id = ${customerId}`,
        ],
        { type: 'refused', issues: [{ field: 'customerId' }] },
      ],
      [
        'the member of the staff, deleted meanwhile',
        ({ staffId }) => [
          (held) => held`select id from staff where id = ${staffId} for update`,
          (held) =>
            held`update staff set "deletedAt" = now() where id = ${staffId}`,
        ],
        { type: 'refused', issues: [{ field: 'staffId' }] },
      ],
      [
        'the service, deleted meanwhile',
        ({ serviceId }) => [
          (held) =>
            held`select id from services where id = ${serviceId} for update`,
          (held) =>
            held`update services set "deletedAt" = now() where id = ${serviceId}`,
        ],
        {
          type: 'refused',
          issues: [
            { field: 'services.0' },
            { field: 'nextRecommendedServices.0' },
          ],
        },
      ],
      [
        'the product, deleted meanwhile',
        (_salon, { productId }) => [
          (held) =>
            held`select id from products where id = ${productId} for update`,
          (held) =>
            held`update products set "deletedAt" = now() where id = ${productId}`,
        ],
        { type: 'refused', issues: [{ field: 'materials.0.productId' }] },
      ],
    ])(
      'should decide on the record by %s while it waited',
      async (_case, statementsOf, outcome) => {
        // Arrange
        const salon = await storedSalon()
        const booking = await storedBooking(salon)
        const product = await insertProduct(databases.database(), salon.salonId)
        const [hold, change] = statementsOf(salon, {
          bookingId: booking.id,
          productId: product.id,
        })

        // Act
        const created = await databases.whileHeld(hold, change, () =>
          repository().create({
            reach: EVERY_SALON,
            record: newRecord(salon, booking.id),
            materials: [materialOf(productIdOf(product))],
          }),
        )

        // Assert
        expect(created).toMatchObject({ type: 'success', data: outcome })
      },
    )

    it('should answer that the insert of the materials returned no row when a trigger skips it', async () => {
      // Arrange
      const salon = await storedSalon()
      const booking = await storedBooking(salon)
      const product = await insertProduct(databases.database(), salon.salonId)
      await databases.skipWrites('treatment_materials', 'INSERT')

      // Act
      const created = await repository().create({
        reach: EVERY_SALON,
        record: newRecord(salon, booking.id),
        materials: [
          materialOf(productIdOf(product)),
          materialOf(productIdOf(product), { quantity: '5.00' }),
        ],
      })

      // Assert
      expect(created).toEqual({
        type: 'error',
        error: {
          type: 'database',
          message: 'Insert of treatment materials returned no row for 2 of 2',
          cause: null,
        },
      })
    })
  })

  describe('findById', () => {
    /**
     * A record with two materials and four photos, written out of their
     * order; the IDs of the photos follow the place given.
     */
    const storedDetailed = async (salon: Salon, place: number) => {
      const db = databases.database()
      const record = await storedRecord(salon)
      const product = await insertProduct(db, salon.salonId)
      const second = await insertTreatmentMaterial(db, record.id, product.id, {
        sortOrder: 1,
      })
      const first = await insertTreatmentMaterial(db, record.id, product.id)
      const later = await insertTreatmentPhoto(db, record.id, {
        id: idOf(place + 3),
        sortOrder: 1,
      })
      const sameGreater = await insertTreatmentPhoto(db, record.id, {
        id: idOf(place + 2),
        createdAt: '2026-12-07T03:00:00Z',
      })
      const sameLesser = await insertTreatmentPhoto(db, record.id, {
        id: idOf(place + 1),
        createdAt: '2026-12-07T03:00:00Z',
      })
      const earlier = await insertTreatmentPhoto(db, record.id, {
        id: idOf(place + 4),
        createdAt: '2026-12-07T02:00:00Z',
      })
      return {
        record,
        materials: [first, second],
        photos: [earlier, sameLesser, sameGreater, later],
      }
    }

    it.each<[string, (salonId: SalonId) => LedgerReach]>([
      ['the salon of its booking', reachOf],
      ['every salon', () => EVERY_SALON],
    ])(
      'should find the record with its materials and photos in their order, for a reader of %s',
      async (_reach, reach) => {
        // Arrange
        const salon = await storedSalon()
        const detailed = await storedDetailed(salon, 0)
        await storedDetailed(salon, 10)

        // Act
        const found = await repository().findById(
          reach(salon.salonId),
          recordIdOf(detailed.record),
        )

        // Assert
        expect(found).toEqual({ type: 'success', data: detailed })
      },
    )

    it('should find a record that holds no material and no photo', async () => {
      // Arrange
      const record = await storedRecord(await storedSalon())

      // Act
      const found = await repository().findById(EVERY_SALON, recordIdOf(record))

      // Assert
      expect(found).toEqual({
        type: 'success',
        data: { record, materials: [], photos: [] },
      })
    })

    it.each<[string, () => Promise<{ reach: LedgerReach; id: string }>]>([
      [
        'of a salon the reader does not reach',
        async () => ({
          reach: reachOf((await storedSalon()).salonId),
          id: (await storedRecord(await storedSalon())).id,
        }),
      ],
      [
        'of a salon that was deleted',
        async () => ({
          reach: EVERY_SALON,
          id: (await storedRecord(await storedSalon(DELETED))).id,
        }),
      ],
      [
        'of an ID that names none',
        async () => ({ reach: EVERY_SALON, id: UNKNOWN_ID }),
      ],
    ])('should find no record %s', async (_case, arrange) => {
      // Arrange
      const { reach, id } = await arrange()

      // Act
      const found = await repository().findById(
        reach,
        treatmentRecordIdSchema.parse(id),
      )

      // Assert
      expect(found).toEqual({ type: 'success', data: null })
    })
  })

  describe('list', () => {
    /**
     * Two salons and one that was deleted. The salon has four records:
     * one written on 1 December by another member of the staff, two
     * written on 2 December at one moment, a fraction of a millisecond
     * after it, of which the one with the greater ID comes first, and one
     * of another customer written on 3 December, with a material and a
     * photo. The other salon has a record of 4 December, and the deleted
     * one a record of 5 December.
     */
    const storedRecords = async () => {
      const db = databases.database()
      const salon = await storedSalon()
      const other = await storedSalon()
      const gone = await storedSalon(DELETED)
      const member = staffIdSchema.parse(
        (await insertStaffMember(db, salon.salonId)).id,
      )
      const customer = customerIdSchema.parse((await insertCustomer(db)).id)
      const first = await storedRecord(
        { ...salon, staffId: member },
        { id: idOf(4), createdAt: '2026-12-01T03:00:00Z' },
      )
      const sameLesser = await storedRecord(salon, {
        id: idOf(1),
        createdAt: '2026-12-02T03:00:00.000500Z',
      })
      const sameGreater = await storedRecord(salon, {
        id: idOf(2),
        createdAt: '2026-12-02T03:00:00.000500Z',
      })
      const ofCustomer = await storedRecord(
        { ...salon, customerId: customer },
        { id: idOf(3), createdAt: '2026-12-03T03:00:00Z' },
      )
      const product = await insertProduct(db, salon.salonId)
      await insertTreatmentMaterial(db, ofCustomer.id, product.id)
      await insertTreatmentPhoto(db, ofCustomer.id)
      const ofOther = await storedRecord(other, {
        id: idOf(5),
        createdAt: '2026-12-04T03:00:00Z',
      })
      const ofGone = await storedRecord(gone, {
        id: idOf(6),
        createdAt: '2026-12-05T03:00:00Z',
      })
      return {
        salon,
        other,
        member,
        customer,
        records: {
          first,
          sameLesser,
          sameGreater,
          ofCustomer,
          ofOther,
          ofGone,
        },
      }
    }

    type Records = Awaited<ReturnType<typeof storedRecords>>
    type Name = keyof Records['records']

    type Filters = Omit<
      TreatmentRecordListCriteria,
      'reach' | 'limit' | 'after'
    >

    const NO_FILTERS: Filters = {
      salonId: null,
      customerId: null,
      staffId: null,
      startDate: null,
      endDate: null,
    }

    const criteriaOf = (
      reach: LedgerReach,
      filters: Partial<Filters> = {},
    ): TreatmentRecordListCriteria => ({
      reach,
      limit: 20,
      after: null,
      ...NO_FILTERS,
      ...filters,
    })

    const listedOf = async (
      stored: Records,
      names: Name[],
      total = names.length,
    ) => ({
      type: 'success',
      data: {
        type: 'listed',
        records: await Promise.all(
          names.map((name) => detailedOf(stored.records[name].id)),
        ),
        total,
        hasMore: false,
      },
    })

    it.each<
      [string, (stored: Records) => ReturnType<typeof criteriaOf>, Name[]]
    >([
      [
        'of the salon the reader reaches, the latest first and then the greatest ID, with their details',
        ({ salon }) => criteriaOf(reachOf(salon.salonId)),
        ['ofCustomer', 'sameGreater', 'sameLesser', 'first'],
      ],
      [
        'of every salon that is not deleted',
        () => criteriaOf(EVERY_SALON),
        ['ofOther', 'ofCustomer', 'sameGreater', 'sameLesser', 'first'],
      ],
      [
        'of the salon named',
        ({ other }) => criteriaOf(EVERY_SALON, { salonId: other.salonId }),
        ['ofOther'],
      ],
      [
        'of the salon named, which the reader does not reach',
        ({ salon, other }) =>
          criteriaOf(reachOf(salon.salonId), { salonId: other.salonId }),
        [],
      ],
      [
        'of the customer',
        ({ customer }) => criteriaOf(EVERY_SALON, { customerId: customer }),
        ['ofCustomer'],
      ],
      [
        'of the member of the staff',
        ({ member }) => criteriaOf(EVERY_SALON, { staffId: member }),
        ['first'],
      ],
      [
        'from the first moment, to the millisecond a response shows',
        () =>
          criteriaOf(EVERY_SALON, {
            startDate: '2026-12-02T03:00:00.000Z',
            endDate: '2026-12-03T03:00:00.000Z',
          }),
        ['ofCustomer', 'sameGreater', 'sameLesser'],
      ],
      [
        'to the last moment, to the millisecond a response shows',
        () =>
          criteriaOf(EVERY_SALON, {
            startDate: '2026-12-01T03:00:00.001Z',
            endDate: '2026-12-02T03:00:00.000Z',
          }),
        ['sameGreater', 'sameLesser'],
      ],
    ])(
      'should list the records %s, and count them',
      async (_case, criteria, names) => {
        // Arrange
        const stored = await storedRecords()

        // Act
        const listed = await repository().list(criteria(stored))

        // Assert
        expect(listed).toEqual(await listedOf(stored, names))
      },
    )

    it('should list a page at a time, from the record after the cursor, a record the filters leave out among the cursors', async () => {
      // Arrange
      const stored = await storedRecords()
      const reach = reachOf(stored.salon.salonId)

      // Act
      const second = await repository().list({
        ...criteriaOf(reach),
        limit: 1,
        after: recordIdOf(stored.records.sameGreater),
      })
      const ofMember = await repository().list({
        ...criteriaOf(reach, { staffId: stored.member }),
        // The last page is full, and no record follows it.
        limit: 1,
        after: recordIdOf(stored.records.ofCustomer),
      })

      // Assert
      expect(second).toEqual({
        type: 'success',
        data: {
          type: 'listed',
          records: [await detailedOf(stored.records.sameLesser.id)],
          total: 4,
          hasMore: true,
        },
      })
      expect(ofMember).toEqual(await listedOf(stored, ['first']))
    })

    it.each<[string, (stored: Records) => string]>([
      [
        'a record of a salon the reader does not reach',
        ({ records }) => records.ofOther.id,
      ],
      [
        'a record of a salon that was deleted',
        ({ records }) => records.ofGone.id,
      ],
      ['an ID that names no record', () => UNKNOWN_ID],
    ])('should list no page after %s', async (_cursor, cursorOf) => {
      // Arrange
      const stored = await storedRecords()

      // Act
      const listed = await repository().list({
        ...criteriaOf(reachOf(stored.salon.salonId)),
        after: treatmentRecordIdSchema.parse(cursorOf(stored)),
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: { type: 'cursorNotFound' },
      })
    })
  })

  describe('update', () => {
    /** A record with a material and a photo, last written on 8 December. */
    const storedChanging = async (salon: Salon) => {
      const db = databases.database()
      const record = await storedRecord(salon, {
        updatedAt: '2026-12-08T03:00:00Z',
      })
      const product = await insertProduct(db, salon.salonId)
      const material = await insertTreatmentMaterial(db, record.id, product.id)
      const photo = await insertTreatmentPhoto(db, record.id)
      return { record, product, material, photo }
    }

    it("should write the columns the changes name and the materials that replace the record's, with the time, and answer with the record as written", async () => {
      // Arrange
      const salon = await storedSalon()
      const { record, photo } = await storedChanging(salon)
      const other = await storedChanging(salon)
      const lots = await insertProduct(databases.database(), salon.salonId, {
        requiresLotTracking: true,
      })

      // Act
      const changed = await repository().update(
        reachOf(salon.salonId),
        recordIdOf(record),
        {
          changes: { colorFormula: '7 レベル アッシュ', processingTime: null },
          materials: [
            materialOf(productIdOf(lots), { lotNumber: 'L-9' }),
            materialOf(productIdOf(other.product), { quantity: '8.00' }),
          ],
        },
      )

      // Assert
      const stored = await detailedOf(record.id)
      expect(changed).toEqual({
        type: 'success',
        data: { type: 'changed', record: stored },
      })
      expect(stored.record).toEqual({
        ...record,
        colorFormula: '7 レベル アッシュ',
        processingTime: null,
        updatedAt: stored.record?.updatedAt,
      })
      expect(stored.record?.updatedAt).not.toBe(record.updatedAt)
      expect(stored.materials).toMatchObject([
        { productId: lots.id, lotNumber: 'L-9', sortOrder: 0 },
        { productId: other.product.id, quantity: '8.00', sortOrder: 1 },
      ])
      expect(stored.photos).toEqual([photo])
      expect(await detailedOf(other.record.id)).toEqual({
        record: other.record,
        materials: [other.material],
        photos: [other.photo],
      })
    })

    it.each<[string, DbNewTreatmentMaterial[] | null, number]>([
      ['keep the materials when it names none', null, 1],
      ['remove the materials when it names an empty list', [], 0],
    ])('should %s', async (_case, materials, count) => {
      // Arrange
      const salon = await storedSalon()
      const { record, material } = await storedChanging(salon)

      // Act
      const changed = await repository().update(
        EVERY_SALON,
        recordIdOf(record),
        { changes: { resultNotes: '色持ちがよい' }, materials },
      )

      // Assert
      const stored = [material].slice(0, count)
      expect(changed).toMatchObject({
        type: 'success',
        data: {
          type: 'changed',
          record: {
            record: { resultNotes: '色持ちがよい' },
            materials: stored,
          },
        },
      })
      expect(await materialsOf(record.id)).toEqual(stored)
    })

    it('should answer with a record that holds no material and no photo', async () => {
      // Arrange
      const record = await storedRecord(await storedSalon())

      // Act
      const changed = await repository().update(
        EVERY_SALON,
        recordIdOf(record),
        { changes: { resultNotes: '色持ちがよい' }, materials: null },
      )

      // Assert
      expect(changed).toEqual({
        type: 'success',
        data: {
          type: 'changed',
          record: {
            record: await recordRowOf(record.id),
            materials: [],
            photos: [],
          },
        },
      })
    })

    it('should refuse what does not fit the booking, and change nothing', async () => {
      // Arrange
      const salon = await storedSalon()
      const other = await storedSalon()
      const { record, material } = await storedChanging(salon)

      // Act
      const changed = await repository().update(
        EVERY_SALON,
        recordIdOf(record),
        {
          changes: {
            services: [other.serviceId],
            nextRecommendedDate: '2026-12-06',
            nextRecommendedServices: [salon.serviceId],
          },
          materials: [
            materialOf(
              productIdOf(
                await insertProduct(databases.database(), other.salonId),
              ),
            ),
          ],
        },
      )

      // Assert
      expect(changed).toMatchObject({
        type: 'success',
        data: {
          type: 'refused',
          issues: [
            { field: 'services.0' },
            { field: 'nextRecommendedDate' },
            { field: 'materials.0.productId' },
          ],
        },
      })
      expect(await recordRowOf(record.id)).toEqual(record)
      expect(await materialsOf(record.id)).toEqual([material])
    })

    it.each<[string, () => Promise<{ reach: LedgerReach; id: string }>]>([
      [
        'of a salon the writer does not reach',
        async () => ({
          reach: reachOf((await storedSalon()).salonId),
          id: (await storedRecord(await storedSalon())).id,
        }),
      ],
      [
        'of a salon that was deleted',
        async () => ({
          reach: EVERY_SALON,
          id: (await storedRecord(await storedSalon(DELETED))).id,
        }),
      ],
      [
        'of an ID that names none',
        async () => ({ reach: EVERY_SALON, id: UNKNOWN_ID }),
      ],
    ])('should change no record %s', async (_case, arrange) => {
      // Arrange
      const { reach, id } = await arrange()
      const before = await recordRowOf(id)

      // Act
      const changed = await repository().update(
        reach,
        treatmentRecordIdSchema.parse(id),
        { changes: { resultNotes: '変えたメモ' }, materials: null },
      )

      // Assert
      expect(changed).toEqual({ type: 'success', data: { type: 'notFound' } })
      expect(await recordRowOf(id)).toEqual(before)
    })

    it.each<
      [
        string,
        (ids: {
          recordId: string
          serviceId: string
        }) => [HeldStatement, HeldStatement],
        unknown,
      ]
    >([
      [
        'a change of the record, which it writes over',
        ({ recordId }) => [
          (held) =>
            held`select id from treatment_records where id = ${recordId} for update`,
          (held) =>
            held`update treatment_records set "colorFormula" = '6 レベル' where id = ${recordId}`,
        ],
        {
          type: 'changed',
          record: {
            record: { colorFormula: '6 レベル', resultNotes: '色持ちがよい' },
          },
        },
      ],
      [
        'the removal of the record',
        ({ recordId }) => [
          (held) =>
            held`select id from treatment_records where id = ${recordId} for update`,
          (held) => held`delete from treatment_records where id = ${recordId}`,
        ],
        { type: 'notFound' },
      ],
      [
        'the deletion of a service it names',
        ({ serviceId }) => [
          (held) =>
            held`select id from services where id = ${serviceId} for update`,
          (held) =>
            held`update services set "deletedAt" = now() where id = ${serviceId}`,
        ],
        { type: 'refused', issues: [{ field: 'services.0' }] },
      ],
    ])(
      'should decide on the change by %s it waited for',
      async (_case, statementsOf, outcome) => {
        // Arrange
        const salon = await storedSalon()
        const { record } = await storedChanging(salon)
        const [hold, change] = statementsOf({
          recordId: record.id,
          serviceId: salon.serviceId,
        })

        // Act
        const changed = await databases.whileHeld(hold, change, () =>
          repository().update(EVERY_SALON, recordIdOf(record), {
            changes: {
              resultNotes: '色持ちがよい',
              services: [salon.serviceId],
            },
            materials: null,
          }),
        )

        // Assert
        expect(changed).toMatchObject({ type: 'success', data: outcome })
      },
    )

    it.each<
      [
        string,
        'treatment_records' | 'treatment_materials',
        'UPDATE' | 'INSERT',
        string,
      ]
    >([
      [
        'the update of the record',
        'treatment_records',
        'UPDATE',
        'Update of treatment record returned no row',
      ],
      [
        'the insert of the materials',
        'treatment_materials',
        'INSERT',
        'Insert of treatment materials returned no row for 1 of 1',
      ],
    ])(
      'should answer that %s returned no row when a trigger skips it',
      async (_write, table, operation, message) => {
        // Arrange
        const salon = await storedSalon()
        const { record, product } = await storedChanging(salon)
        await databases.skipWrites(table, operation)

        // Act
        const changed = await repository().update(
          EVERY_SALON,
          recordIdOf(record),
          {
            changes: { resultNotes: '色持ちがよい' },
            materials: [materialOf(productIdOf(product))],
          },
        )

        // Assert
        expect(changed).toEqual({
          type: 'error',
          error: { type: 'database', message, cause: null },
        })
      },
    )
  })

  describe('delete', () => {
    it.each<[string, (salonId: SalonId) => LedgerReach]>([
      ['the salon of its booking', reachOf],
      ['every salon', () => EVERY_SALON],
    ])(
      'should remove the record with its materials and photos, for a writer of %s, and leave the others',
      async (_reach, reach) => {
        // Arrange
        const db = databases.database()
        const salon = await storedSalon()
        const record = await storedRecord(salon)
        const product = await insertProduct(db, salon.salonId)
        await insertTreatmentMaterial(db, record.id, product.id)
        await insertTreatmentPhoto(db, record.id)
        const other = await storedRecord(salon)

        // Act
        const removed = await repository().delete(
          reach(salon.salonId),
          recordIdOf(record),
        )

        // Assert
        expect(removed).toEqual({ type: 'success', data: { type: 'removed' } })
        expect(await detailedOf(record.id)).toEqual({
          record: undefined,
          materials: [],
          photos: [],
        })
        expect(await recordRowOf(other.id)).toEqual(other)
      },
    )

    it.each<[string, () => Promise<{ reach: LedgerReach; id: string }>]>([
      [
        'of a salon the writer does not reach',
        async () => ({
          reach: reachOf((await storedSalon()).salonId),
          id: (await storedRecord(await storedSalon())).id,
        }),
      ],
      [
        'of a salon that was deleted',
        async () => ({
          reach: EVERY_SALON,
          id: (await storedRecord(await storedSalon(DELETED))).id,
        }),
      ],
      [
        'of an ID that names none',
        async () => ({ reach: EVERY_SALON, id: UNKNOWN_ID }),
      ],
    ])('should remove no record %s', async (_case, arrange) => {
      // Arrange
      const { reach, id } = await arrange()
      const before = await recordRowOf(id)

      // Act
      const removed = await repository().delete(
        reach,
        treatmentRecordIdSchema.parse(id),
      )

      // Assert
      expect(removed).toEqual({ type: 'success', data: { type: 'notFound' } })
      expect(await recordRowOf(id)).toEqual(before)
    })
  })

  describe('addPhotos', () => {
    const URL_A = 'https://storage.example.com/photos/a.jpg'
    const URL_B = 'https://storage.example.com/photos/b.jpg'

    it('should write the photos at the moment the record changes, and answer with them in the order they were given', async () => {
      // Arrange
      const salon = await storedSalon()
      const record = await storedRecord(salon, {
        updatedAt: '2026-12-08T03:00:00Z',
      })
      const held = await insertTreatmentPhoto(databases.database(), record.id)
      // Another record holds a photo at an address the addition gives.
      const other = await storedRecord(salon)
      const ofOther = await insertTreatmentPhoto(
        databases.database(),
        other.id,
        {
          photoUrl: URL_A,
        },
      )
      const photos = [
        photoOf(URL_B, { photoType: 'before', sortOrder: 2 }),
        photoOf(URL_A, { sortOrder: 1, isPublic: true, customerConsent: true }),
      ]

      // Act
      const added = await repository().addPhotos(
        reachOf(salon.salonId),
        recordIdOf(record),
        photos,
      )

      // Assert
      const stored = await photosOf(record.id)
      const byUrl = (url: string) => stored.find((row) => row.photoUrl === url)
      expect(added).toEqual({
        type: 'success',
        data: {
          type: 'added',
          recordId: record.id,
          photos: [byUrl(URL_B), byUrl(URL_A)],
        },
      })
      expect(stored).toHaveLength(3)
      expect(byUrl(held.photoUrl)).toEqual(held)
      expect(await photosOf(other.id)).toEqual([ofOther])
      expect(await recordRowOf(other.id)).toEqual(other)
      expect(byUrl(URL_A)).toMatchObject({
        ...photos[1],
        treatmentRecordId: record.id,
      })
      const changedAt = (await recordRowOf(record.id))?.updatedAt
      expect(changedAt).not.toBe(record.updatedAt)
      expect(byUrl(URL_A)?.createdAt).toBe(changedAt)
      expect(byUrl(URL_B)?.createdAt).toBe(changedAt)
    })

    it.each<[string, number, string[], unknown]>([
      [
        'a photo at an address the record holds',
        1,
        [URL_A, 'https://storage.example.com/photos/0.jpg'],
        {
          type: 'photoExists',
          photoUrl: 'https://storage.example.com/photos/0.jpg',
        },
      ],
      [
        'more photos than the record may hold',
        19,
        [URL_A, URL_B],
        { type: 'tooManyPhotos', held: 19 },
      ],
    ])(
      'should refuse %s, and write nothing',
      async (_case, holds, urls, refusal) => {
        // Arrange
        const salon = await storedSalon()
        const record = await storedRecord(salon)
        await Promise.all(
          Array.from({ length: holds }, (_, place) =>
            insertTreatmentPhoto(databases.database(), record.id, {
              photoUrl: `https://storage.example.com/photos/${place}.jpg`,
            }),
          ),
        )

        // Act
        const added = await repository().addPhotos(
          EVERY_SALON,
          recordIdOf(record),
          urls.map((url) => photoOf(url)),
        )

        // Assert
        expect(added).toEqual({
          type: 'success',
          data: { type: 'refused', refusal },
        })
        expect(await photosOf(record.id)).toHaveLength(holds)
        expect(await recordRowOf(record.id)).toEqual(record)
      },
    )

    it.each<[string, () => Promise<{ reach: LedgerReach; id: string }>]>([
      [
        'of a salon the writer does not reach',
        async () => ({
          reach: reachOf((await storedSalon()).salonId),
          id: (await storedRecord(await storedSalon())).id,
        }),
      ],
      [
        'of a salon that was deleted',
        async () => ({
          reach: EVERY_SALON,
          id: (await storedRecord(await storedSalon(DELETED))).id,
        }),
      ],
      [
        'of an ID that names none',
        async () => ({ reach: EVERY_SALON, id: UNKNOWN_ID }),
      ],
    ])('should add no photo to a record %s', async (_case, arrange) => {
      // Arrange
      const { reach, id } = await arrange()

      // Act
      const added = await repository().addPhotos(
        reach,
        treatmentRecordIdSchema.parse(id),
        [photoOf(URL_A)],
      )

      // Assert
      expect(added).toEqual({ type: 'success', data: { type: 'notFound' } })
      expect(await photosOf(id)).toEqual([])
    })

    it('should count the photo an addition it waited for wrote', async () => {
      // Arrange
      const salon = await storedSalon()
      const record = await storedRecord(salon)

      // Act
      const added = await databases.whileHeld(
        (held) =>
          held`select id from treatment_records where id = ${record.id} for update`,
        (held) =>
          held`insert into treatment_photos ("treatmentRecordId", "photoType", "photoUrl") values (${record.id}, 'after', ${URL_A})`,
        () =>
          repository().addPhotos(EVERY_SALON, recordIdOf(record), [
            photoOf(URL_A),
          ]),
      )

      // Assert
      expect(added).toEqual({
        type: 'success',
        data: {
          type: 'refused',
          refusal: { type: 'photoExists', photoUrl: URL_A },
        },
      })
      expect(await photosOf(record.id)).toHaveLength(1)
    })

    it.each<
      [
        string,
        'treatment_records' | 'treatment_photos',
        'UPDATE' | 'INSERT',
        string,
      ]
    >([
      [
        'the update of the record',
        'treatment_records',
        'UPDATE',
        'Update of treatment record of added photos returned no row',
      ],
      [
        'the insert of the photos',
        'treatment_photos',
        'INSERT',
        'Insert of treatment photos returned no row for 2 of 2',
      ],
    ])(
      'should answer that %s returned no row when a trigger skips it',
      async (_write, table, operation, message) => {
        // Arrange
        const salon = await storedSalon()
        const record = await storedRecord(salon)
        await databases.skipWrites(table, operation)

        // Act
        const added = await repository().addPhotos(
          EVERY_SALON,
          recordIdOf(record),
          [photoOf(URL_A), photoOf(URL_B)],
        )

        // Assert
        expect(added).toEqual({
          type: 'error',
          error: { type: 'database', message, cause: null },
        })
      },
    )
  })

  describe('removePhoto', () => {
    it('should remove the photo of the record, with the time of the change, and leave the others', async () => {
      // Arrange
      const db = databases.database()
      const salon = await storedSalon()
      const record = await storedRecord(salon, {
        updatedAt: '2026-12-08T03:00:00Z',
      })
      const photo = await insertTreatmentPhoto(db, record.id)
      const kept = await insertTreatmentPhoto(db, record.id)
      const other = await storedRecord(salon)

      // Act
      const removed = await repository().removePhoto(
        reachOf(salon.salonId),
        recordIdOf(record),
        treatmentPhotoIdSchema.parse(photo.id),
      )

      // Assert
      expect(removed).toEqual({ type: 'success', data: { type: 'removed' } })
      expect(await photosOf(record.id)).toEqual([kept])
      expect((await recordRowOf(record.id))?.updatedAt).not.toBe(
        record.updatedAt,
      )
      expect(await recordRowOf(other.id)).toEqual(other)
    })

    it.each<[string, (other: string) => Promise<string>]>([
      [
        'of another record',
        async (other) =>
          (await insertTreatmentPhoto(databases.database(), other)).id,
      ],
      ['of an ID that names none', async () => UNKNOWN_ID],
    ])('should remove no photo %s', async (_case, photoOfOther) => {
      // Arrange
      const salon = await storedSalon()
      const record = await storedRecord(salon)
      const other = await storedRecord(salon)
      const photoId = await photoOfOther(other.id)

      // Act
      const removed = await repository().removePhoto(
        EVERY_SALON,
        recordIdOf(record),
        treatmentPhotoIdSchema.parse(photoId),
      )

      // Assert
      expect(removed).toEqual({
        type: 'success',
        data: { type: 'photoNotFound' },
      })
      expect(await photosOf(other.id)).toHaveLength(
        photoId === UNKNOWN_ID ? 0 : 1,
      )
      expect(await recordRowOf(record.id)).toEqual(record)
    })

    it.each<[string, () => Promise<{ reach: LedgerReach; id: string }>]>([
      [
        'of a salon the writer does not reach',
        async () => ({
          reach: reachOf((await storedSalon()).salonId),
          id: (await storedRecord(await storedSalon())).id,
        }),
      ],
      [
        'of a salon that was deleted',
        async () => ({
          reach: EVERY_SALON,
          id: (await storedRecord(await storedSalon(DELETED))).id,
        }),
      ],
    ])('should remove no photo of a record %s', async (_case, arrange) => {
      // Arrange
      const { reach, id } = await arrange()
      const photo = await insertTreatmentPhoto(databases.database(), id)

      // Act
      const removed = await repository().removePhoto(
        reach,
        treatmentRecordIdSchema.parse(id),
        treatmentPhotoIdSchema.parse(photo.id),
      )

      // Assert
      expect(removed).toEqual({
        type: 'success',
        data: { type: 'recordNotFound' },
      })
      expect(await photosOf(id)).toEqual([photo])
    })

    it('should answer that the update of the record returned no row when a trigger skips it', async () => {
      // Arrange
      const salon = await storedSalon()
      const record = await storedRecord(salon)
      const photo = await insertTreatmentPhoto(databases.database(), record.id)
      await databases.skipWrites('treatment_records', 'UPDATE')

      // Act
      const removed = await repository().removePhoto(
        EVERY_SALON,
        recordIdOf(record),
        treatmentPhotoIdSchema.parse(photo.id),
      )

      // Assert
      expect(removed).toEqual({
        type: 'error',
        error: {
          type: 'database',
          message:
            'Update of treatment record of removed photo returned no row',
          cause: null,
        },
      })
    })
  })

  describe('findFigures', () => {
    /**
     * A salon whose records state services of categories of two kinds, a
     * service without a category and IDs that name no service: two
     * records of a cut, one of which states two cuts, a record of a cut
     * and a colour, one of a service without a category, and one of an
     * ID that names no service, written a fraction of a millisecond after
     * the end of the period and without a processing time. Another salon
     * has a record of its own.
     */
    const storedFigures = async () => {
      const db = databases.database()
      const salon = await storedSalon()
      const colours = await insertCategory(db, salon.salonId, {
        category: 'color',
      })
      const cuts = await insertCategory(db, salon.salonId, { category: 'cut' })
      const cut = serviceIdOf(
        await insertService(db, salon.salonId, {
          id: idOf(11),
          categoryId: cuts.id,
        }),
      )
      const shortCut = serviceIdOf(
        await insertService(db, salon.salonId, {
          id: idOf(12),
          categoryId: cuts.id,
        }),
      )
      const colour = serviceIdOf(
        await insertService(db, salon.salonId, {
          id: idOf(13),
          categoryId: colours.id,
        }),
      )
      const plain = serviceIdOf(
        await insertService(db, salon.salonId, { id: idOf(14) }),
      )
      const during = { createdAt: '2026-12-02T03:00:00Z' }
      await storedRecord(salon, {
        ...during,
        services: [cut, shortCut],
        processingTime: 60,
      })
      await storedRecord(salon, {
        ...during,
        services: [cut],
        processingTime: 45,
      })
      await storedRecord(salon, {
        ...during,
        services: [colour, cut],
        processingTime: 120,
      })
      await storedRecord(salon, {
        ...during,
        services: [plain],
        processingTime: null,
      })
      await storedRecord(salon, {
        createdAt: '2026-12-03T03:00:00.000500Z',
        services: [idOf(99)],
        processingTime: null,
      })
      await storedRecord(await storedSalon(), { ...during, processingTime: 30 })
      return { salon, cut, shortCut, colour, plain }
    }

    it('should count the records of the salon in the period, by the kind of their services and by their services', async () => {
      // Arrange
      const { salon, cut, shortCut, colour, plain } = await storedFigures()

      // Act
      const figures = await repository().findFigures({
        salonId: salon.salonId,
        startDate: '2026-12-01T00:00:00.000Z',
        endDate: '2026-12-03T03:00:00.000Z',
      })

      // Assert
      expect(figures).toEqual({
        type: 'success',
        data: {
          total: 5,
          processingTimeSum: 225,
          processingTimeCount: 3,
          byCategory: [
            { category: 'cut', count: 3 },
            { category: 'other', count: 2 },
            { category: 'color', count: 1 },
          ],
          topServices: [
            { serviceId: cut, count: 3 },
            { serviceId: shortCut, count: 1 },
            { serviceId: colour, count: 1 },
            { serviceId: plain, count: 1 },
            { serviceId: idOf(99), count: 1 },
          ],
        },
      })
    })

    it.each<[string, string | null, string | null, number]>([
      ['from the first moment', '2026-12-03T03:00:00.000Z', null, 1],
      [
        'to the last moment, to the millisecond a response shows',
        null,
        '2026-12-02T03:00:00.000Z',
        4,
      ],
      ['of no period', null, null, 5],
      ['of a period without records', '2026-12-10T00:00:00.000Z', null, 0],
    ])(
      'should count the records %s',
      async (_period, startDate, endDate, total) => {
        // Arrange
        const { salon } = await storedFigures()

        // Act
        const figures = await repository().findFigures({
          salonId: salon.salonId,
          startDate,
          endDate,
        })

        // Assert
        expect(figures).toMatchObject({ type: 'success', data: { total } })
      },
    )

    it('should list the ten services of the most records', async () => {
      // Arrange
      const salon = await storedSalon()
      const services = Array.from({ length: 11 }, (_, index) =>
        idOf(20 + index),
      )
      await storedRecord(salon, { services })
      await storedRecord(salon, { services: [idOf(30)] })

      // Act
      const figures = await repository().findFigures({
        salonId: salon.salonId,
        startDate: null,
        endDate: null,
      })

      // Assert
      expect(figures).toMatchObject({
        type: 'success',
        data: {
          total: 2,
          processingTimeSum: 0,
          processingTimeCount: 0,
          byCategory: [{ category: 'other', count: 2 }],
          topServices: [
            { serviceId: idOf(30), count: 2 },
            ...services
              .slice(0, 9)
              .map((serviceId) => ({ serviceId, count: 1 })),
          ],
        },
      })
    })

    it.each<[string, () => Promise<string>]>([
      ['that was deleted', async () => (await storedSalon(DELETED)).salonId],
      ['of an ID that names none', async () => UNKNOWN_ID],
    ])('should count nothing of a salon %s', async (_case, salonOf) => {
      // Arrange
      const salonId = salonIdSchema.parse(await salonOf())

      // Act
      const figures = await repository().findFigures({
        salonId,
        startDate: null,
        endDate: null,
      })

      // Assert
      expect(figures).toEqual({ type: 'success', data: null })
    })
  })
})

describe('TreatmentRecordRepository when the database is gone', () => {
  const id = treatmentRecordIdSchema.parse(UNKNOWN_ID)
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const record: DbNewTreatmentRecord = {
    bookingId: UNKNOWN_ID,
    customerId: UNKNOWN_ID,
    staffId: UNKNOWN_ID,
    services: [serviceIdSchema.parse(UNKNOWN_ID)],
    techniques: [],
    consultationNotes: null,
    scalpCondition: null,
    hairCondition: null,
    colorFormula: null,
    processingTime: null,
    resultNotes: null,
    nextRecommendedDate: null,
    nextRecommendedServices: [],
    homeCareSuggestions: null,
    customerSatisfaction: null,
    staffEvaluation: null,
  }

  it.each<
    [string, string, (gone: TreatmentRecordRepository) => Promise<unknown>]
  >([
    [
      'a creation',
      'Failed to create treatment record',
      (gone) => gone.create({ reach: EVERY_SALON, record, materials: [] }),
    ],
    [
      'a record',
      'Failed to find treatment record',
      (gone) => gone.findById(EVERY_SALON, id),
    ],
    [
      'the records',
      'Failed to list treatment records',
      (gone) =>
        gone.list({
          reach: EVERY_SALON,
          limit: 20,
          after: null,
          salonId: null,
          customerId: null,
          staffId: null,
          startDate: null,
          endDate: null,
        }),
    ],
    [
      'a change',
      'Failed to update treatment record',
      (gone) =>
        gone.update(EVERY_SALON, id, {
          changes: { resultNotes: null },
          materials: null,
        }),
    ],
    [
      'a removal',
      'Failed to delete treatment record',
      (gone) => gone.delete(EVERY_SALON, id),
    ],
    [
      'an addition of photos',
      'Failed to add treatment photos',
      (gone) =>
        gone.addPhotos(EVERY_SALON, id, [
          photoOf('https://storage.example.com/photos/a.jpg'),
        ]),
    ],
    [
      'a removal of a photo',
      'Failed to remove treatment photo',
      (gone) =>
        gone.removePhoto(
          EVERY_SALON,
          id,
          treatmentPhotoIdSchema.parse(UNKNOWN_ID),
        ),
    ],
    [
      'the figures',
      'Failed to count treatment records',
      (gone) => gone.findFigures({ salonId, startDate: null, endDate: null }),
    ],
  ])('should answer for %s: %s', async (_subject, message, call) => {
    // Arrange
    const gone = new TreatmentRecordRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
