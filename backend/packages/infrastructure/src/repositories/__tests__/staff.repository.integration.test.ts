import { staff } from '@beauty-salon-backend/database'
import {
  type SalonId,
  type StaffId,
  type StaffListCriteria,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { StaffRepository } from '../staff.repository.impl'
import {
  COMPLETED,
  insertBooking,
  insertBookingLine,
  insertCustomer,
  insertSalon,
  insertService,
  insertStaffMember,
  newStaffMember,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new StaffRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED = { deletedAt: '2026-12-01T00:00:00.000Z' }

/** A salon in the table, as a repository is given its ID. */
const storedSalon = async (): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database())).id)

/** A staff member of the salon in the table, as a repository is given its ID. */
const storedMember = async (
  salonId: SalonId,
  overrides: Parameters<typeof insertStaffMember>[2] = {},
): Promise<StaffId> =>
  staffIdSchema.parse(
    (await insertStaffMember(databases.database(), salonId, overrides)).id,
  )

/** The staff member as the table holds them. */
const memberOf = async (id: StaffId) => {
  const [member] = await databases
    .database()
    .select()
    .from(staff)
    .where(eq(staff.id, id))
  return member
}

/** The staff of the salon, a page of 20. */
const staffOf = (salonId: SalonId): StaffListCriteria => ({
  salonId,
  limit: 20,
  after: null,
})

describe('StaffRepository.create', () => {
  it('should store the staff member in the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const member = newStaffMember({
      staffCode: 'ST-001',
      specialties: ['カット', 'カラー'],
    })

    // Act
    const created = await repository().create(salonId, member)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { ...member, salonId, userId: null, deletedAt: null },
    })
  })

  it.each<[string, (salonId: SalonId) => Promise<unknown>]>([
    [
      'a deleted staff member of the salon',
      (salonId) =>
        storedMember(salonId, { email: 'taro@example.com', ...DELETED }),
    ],
    [
      'a staff member of another salon',
      async () =>
        storedMember(await storedSalon(), { email: 'taro@example.com' }),
    ],
  ])('should store an address that %s has', async (_, arrange) => {
    // Arrange
    const salonId = await storedSalon()
    await arrange(salonId)

    // Act
    const created = await repository().create(
      salonId,
      newStaffMember({ email: 'taro@example.com' }),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { email: 'taro@example.com' },
    })
  })

  it('should refuse the address of another staff member of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedMember(salonId, { email: 'taro@example.com' })

    // Act
    const created = await repository().create(
      salonId,
      newStaffMember({ email: 'taro@example.com' }),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'error',
      error: {
        type: 'alreadyExists',
        field: 'email',
        value: 'taro@example.com',
      },
    })
  })

  it('should refuse the code of a staff member of the salon, also of a deleted one', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedMember(salonId, { staffCode: 'ST-001', ...DELETED })

    // Act
    const created = await repository().create(
      salonId,
      newStaffMember({ staffCode: 'ST-001' }),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'error',
      error: { type: 'alreadyExists', field: 'staffCode', value: 'ST-001' },
    })
  })

  it('should answer another failure of the write as a database error', async () => {
    // Arrange
    const salonId = salonIdSchema.parse(UNKNOWN_ID)

    // Act
    const created = await repository().create(salonId, newStaffMember())

    // Assert
    expect(created).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: 'Failed to create staff member',
        cause: { code: '23503', constraint: 'staff_salon_id_fk' },
      },
    })
  })

  it('should answer a database error when the insert writes no row', async () => {
    // Arrange
    const salonId = await storedSalon()
    await databases.skipWrites('staff', 'INSERT')

    // Act
    const created = await repository().create(salonId, newStaffMember())

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of staff member returned no row',
        cause: null,
      },
    })
  })
})

describe('StaffRepository.findById', () => {
  it('should find the staff member of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedMember(salonId, { displayName: '佐藤 太郎' })

    // Act
    const found = await repository().findById(salonId, id)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { id, salonId, displayName: '佐藤 太郎' },
    })
  })

  it.each<[string, (salonId: SalonId) => Promise<[SalonId, StaffId]>]>([
    [
      'of another salon',
      async (salonId) => [await storedSalon(), await storedMember(salonId)],
    ],
    [
      'who is deleted',
      async (salonId) => [salonId, await storedMember(salonId, DELETED)],
    ],
  ])('should find no staff member %s', async (_, arrange) => {
    // Arrange
    const [salonId, id] = await arrange(await storedSalon())

    // Act
    const found = await repository().findById(salonId, id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('StaffRepository.list', () => {
  it('should list the staff of the salon in the order they were added, a page at a time', async () => {
    // Arrange
    const salonId = await storedSalon()
    const first = await storedMember(salonId, {
      createdAt: '2026-12-01T00:00:00.000Z',
    })
    const second = await storedMember(salonId, {
      createdAt: '2026-12-02T00:00:00.000Z',
    })
    const third = await storedMember(salonId, {
      createdAt: '2026-12-03T00:00:00.000Z',
    })

    // Act
    const firstPage = await repository().list({ ...staffOf(salonId), limit: 2 })
    const nextPage = await repository().list({
      ...staffOf(salonId),
      limit: 2,
      after: second,
    })

    // Assert
    expect(firstPage).toMatchObject({
      type: 'success',
      data: { staff: [{ id: first }, { id: second }], total: 3, hasMore: true },
    })
    expect(nextPage).toMatchObject({
      type: 'success',
      data: { staff: [{ id: third }], total: 3, hasMore: false },
    })
  })

  it('should leave out the deleted staff and the staff of other salons, and go on after a deleted one', async () => {
    // Arrange
    const salonId = await storedSalon()
    const deleted = await storedMember(salonId, {
      createdAt: '2026-12-01T00:00:00.000Z',
      ...DELETED,
    })
    const working = await storedMember(salonId, {
      createdAt: '2026-12-02T00:00:00.000Z',
    })
    await storedMember(await storedSalon())

    // Act
    const listed = await repository().list({
      ...staffOf(salonId),
      after: deleted,
    })

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { staff: [{ id: working }], total: 1, hasMore: false },
    })
  })

  it('should find no page after a staff member of another salon or of no salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedMember(salonId)
    const ofOther = await storedMember(await storedSalon())

    // Act
    const afterOther = await repository().list({
      ...staffOf(salonId),
      after: ofOther,
    })
    const afterNone = await repository().list({
      ...staffOf(salonId),
      after: staffIdSchema.parse(UNKNOWN_ID),
    })

    // Assert
    expect(afterOther).toEqual({ type: 'success', data: null })
    expect(afterNone).toEqual({ type: 'success', data: null })
  })
})

describe('StaffRepository.update', () => {
  it('should write the changes and keep the other columns', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedMember(salonId, {
      displayName: '佐藤 太郎',
      email: 'taro@example.com',
    })

    // Act
    const updated = await repository().update(salonId, id, {
      position: 'トップスタイリスト',
      staffCode: 'ST-009',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        id,
        displayName: '佐藤 太郎',
        email: 'taro@example.com',
        position: 'トップスタイリスト',
        staffCode: 'ST-009',
      },
    })
  })

  it('should refuse the address of another staff member of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedMember(salonId, { email: 'taro@example.com' })
    const id = await storedMember(salonId)

    // Act
    const updated = await repository().update(salonId, id, {
      email: 'taro@example.com',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'error',
      error: {
        type: 'alreadyExists',
        field: 'email',
        value: 'taro@example.com',
      },
    })
  })

  it('should refuse the code of another staff member of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedMember(salonId, { staffCode: 'ST-001' })
    const id = await storedMember(salonId)

    // Act
    const updated = await repository().update(salonId, id, {
      staffCode: 'ST-001',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'error',
      error: { type: 'alreadyExists', field: 'staffCode', value: 'ST-001' },
    })
  })

  it('should answer another failure of the write as a database error', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedMember(salonId)

    // Act
    const updated = await repository().update(salonId, id, {
      maxConcurrentBookings: 0,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: 'Failed to update staff member',
        cause: {
          code: '23514',
          constraint: 'staff_max_concurrent_bookings_positive',
        },
      },
    })
  })

  it.each<[string, (salonId: SalonId) => Promise<[SalonId, StaffId]>]>([
    [
      'of another salon',
      async (salonId) => [await storedSalon(), await storedMember(salonId)],
    ],
    [
      'who is deleted',
      async (salonId) => [salonId, await storedMember(salonId, DELETED)],
    ],
  ])('should change no staff member %s', async (_, arrange) => {
    // Arrange
    const [salonId, id] = await arrange(await storedSalon())

    // Act
    const updated = await repository().update(salonId, id, {
      position: 'トップスタイリスト',
    })

    // Assert
    expect(updated).toEqual({ type: 'success', data: null })
    expect((await memberOf(id))?.position).toBeNull()
  })
})

describe('StaffRepository.delete', () => {
  /** A booking with one service line at the salon, in the charge of the member and done by the one of the line. */
  const bookingOf = async (
    salonId: SalonId,
    members: { inCharge: StaffId; ofLine: StaffId },
    overrides: Parameters<typeof insertBooking>[2] = {},
  ) => {
    const db = databases.database()
    const customer = await insertCustomer(db)
    const service = await insertService(db, salonId)
    const booking = await insertBooking(
      db,
      { salonId, customerId: customer.id, staffId: members.inCharge },
      overrides,
    )
    await insertBookingLine(db, booking.id, service.id, {
      staffId: members.ofLine,
    })
  }

  it('should delete a staff member whose bookings are finished, and keep the row', async () => {
    // Arrange
    const salonId = await storedSalon()
    const id = await storedMember(salonId)
    await bookingOf(salonId, { inCharge: id, ofLine: id }, COMPLETED)

    // Act
    const deleted = await repository().delete(salonId, id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    expect((await memberOf(id))?.deletedAt).not.toBeNull()
    expect(await repository().findById(salonId, id)).toEqual({
      type: 'success',
      data: null,
    })
  })

  it.each<
    [
      string,
      (id: StaffId, other: StaffId) => { inCharge: StaffId; ofLine: StaffId },
    ]
  >([
    ['in charge of', (id, other) => ({ inCharge: id, ofLine: other })],
    [
      'doing a service line of',
      (id, other) => ({ inCharge: other, ofLine: id }),
    ],
  ])(
    'should refuse to delete a staff member %s a booking that is not finished',
    async (_, members) => {
      // Arrange
      const salonId = await storedSalon()
      const id = await storedMember(salonId)
      const other = await storedMember(salonId)
      await bookingOf(salonId, members(id, other))

      // Act
      const deleted = await repository().delete(salonId, id)

      // Assert
      expect(deleted).toEqual({
        type: 'success',
        data: { type: 'bookingsUnfinished' },
      })
      expect((await memberOf(id))?.deletedAt).toBeNull()
    },
  )

  it.each<[string, (salonId: SalonId) => Promise<[SalonId, StaffId]>]>([
    [
      'of another salon',
      async (salonId) => [await storedSalon(), await storedMember(salonId)],
    ],
    [
      'who is deleted already',
      async (salonId) => [salonId, await storedMember(salonId, DELETED)],
    ],
  ])('should find no staff member %s to delete', async (_, arrange) => {
    // Arrange
    const [salonId, id] = await arrange(await storedSalon())

    // Act
    const deleted = await repository().delete(salonId, id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'notFound' } })
  })
})

describe('StaffRepository on a database that is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const id = staffIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (repository: StaffRepository) => Promise<unknown>]>([
    [
      'Failed to create staff member',
      (gone) => gone.create(salonId, newStaffMember()),
    ],
    ['Failed to find staff member', (gone) => gone.findById(salonId, id)],
    ['Failed to list staff', (gone) => gone.list(staffOf(salonId))],
    [
      'Failed to update staff member',
      (gone) => gone.update(salonId, id, { position: null }),
    ],
    ['Failed to delete staff member', (gone) => gone.delete(salonId, id)],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new StaffRepository(await databases.gone())

    // Act
    const result = await call(gone)

    // Assert
    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message,
        cause: expect.objectContaining({ code: 'CONNECTION_ENDED' }),
      },
    })
  })
})
