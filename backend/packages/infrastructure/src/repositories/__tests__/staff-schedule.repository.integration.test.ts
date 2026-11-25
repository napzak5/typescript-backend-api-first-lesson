import { staffSchedules } from '@beauty-salon-backend/database'
import {
  type SalonId,
  type StaffId,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { StaffScheduleRepository } from '../staff-schedule.repository.impl'
import { insertSalon, insertStaffMember, newSchedule } from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new StaffScheduleRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** A staff member of a new salon, as a repository is given them. */
const storedMember = async (
  overrides: Parameters<typeof insertStaffMember>[2] = {},
): Promise<{ salonId: SalonId; staffId: StaffId }> => {
  const db = databases.database()
  const salon = await insertSalon(db)
  const member = await insertStaffMember(db, salon.id, overrides)
  return {
    salonId: salonIdSchema.parse(salon.id),
    staffId: staffIdSchema.parse(member.id),
  }
}

/** Rows of the schedule of the staff member in the table. */
const storeSchedules = async (
  staffId: StaffId,
  schedules: ReturnType<typeof newSchedule>[],
) => {
  await databases
    .database()
    .insert(staffSchedules)
    .values(schedules.map((schedule) => ({ ...schedule, staffId })))
}

/** What the table holds of the schedule of the staff member, in no order. */
const daysOf = async (staffId: StaffId) =>
  (
    await databases
      .database()
      .select({
        dayOfWeek: staffSchedules.dayOfWeek,
        date: staffSchedules.date,
      })
      .from(staffSchedules)
      .where(eq(staffSchedules.staffId, staffId))
  )
    .map(({ dayOfWeek, date }) => dayOfWeek ?? date)
    .toSorted()

/** A row for a single day, on which the staff member does not work. */
const dayOff = (date: string) =>
  newSchedule({
    isRecurring: false,
    dayOfWeek: null,
    date,
    isAvailable: false,
    startTime: null,
    endTime: null,
  })

describe('StaffScheduleRepository.findByStaff', () => {
  it('should read the weekly rows from Monday to Sunday, then the single days from the earliest on', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()
    await storeSchedules(staffId, [
      dayOff('2026-12-24'),
      newSchedule({ dayOfWeek: 'sunday' }),
      dayOff('2026-12-10'),
      newSchedule({ dayOfWeek: 'monday' }),
      newSchedule({ dayOfWeek: 'wednesday' }),
    ])

    // Act
    const found = await repository().findByStaff(salonId, staffId)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: [
        { dayOfWeek: 'monday', date: null },
        { dayOfWeek: 'wednesday', date: null },
        { dayOfWeek: 'sunday', date: null },
        { dayOfWeek: null, date: '2026-12-10' },
        { dayOfWeek: null, date: '2026-12-24' },
      ],
    })
  })

  it('should read no rows of a staff member who has none', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()

    // Act
    const found = await repository().findByStaff(salonId, staffId)

    // Assert
    expect(found).toEqual({ type: 'success', data: [] })
  })

  it.each<[string, () => Promise<{ salonId: SalonId; staffId: StaffId }>]>([
    [
      'of another salon',
      async () => ({
        salonId: (await storedMember()).salonId,
        staffId: (await storedMember()).staffId,
      }),
    ],
    [
      'who is deleted',
      () => storedMember({ deletedAt: '2026-12-01T00:00:00.000Z' }),
    ],
  ])('should find no staff member %s', async (_, arrange) => {
    // Arrange
    const { salonId, staffId } = await arrange()
    await storeSchedules(staffId, [newSchedule()])

    // Act
    const found = await repository().findByStaff(salonId, staffId)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('StaffScheduleRepository.replace', () => {
  it('should put the new rows in the place of the old ones and answer them in order', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()
    const other = await storedMember()
    await storeSchedules(staffId, [
      newSchedule({ dayOfWeek: 'monday' }),
      dayOff('2026-12-10'),
    ])
    await storeSchedules(other.staffId, [newSchedule({ dayOfWeek: 'friday' })])

    // Act
    const replaced = await repository().replace(salonId, staffId, [
      dayOff('2026-12-31'),
      newSchedule({
        dayOfWeek: 'tuesday',
        breakStartTime: '13:00:00',
        breakEndTime: '14:00:00',
      }),
    ])

    // Assert
    expect(replaced).toMatchObject({
      type: 'success',
      data: [
        {
          staffId,
          dayOfWeek: 'tuesday',
          breakStartTime: '13:00:00',
          breakEndTime: '14:00:00',
        },
        { staffId, date: '2026-12-31', isAvailable: false },
      ],
    })
    expect(await daysOf(staffId)).toEqual(['2026-12-31', 'tuesday'])
    expect(await daysOf(other.staffId)).toEqual(['friday'])
  })

  it('should remove every row when there are no new ones', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()
    await storeSchedules(staffId, [newSchedule()])

    // Act
    const replaced = await repository().replace(salonId, staffId, [])

    // Assert
    expect(replaced).toEqual({ type: 'success', data: [] })
    expect(await daysOf(staffId)).toEqual([])
  })

  it('should replace nothing of a staff member of another salon', async () => {
    // Arrange
    const { salonId } = await storedMember()
    const { staffId } = await storedMember()
    await storeSchedules(staffId, [newSchedule({ dayOfWeek: 'monday' })])

    // Act
    const replaced = await repository().replace(salonId, staffId, [
      newSchedule({ dayOfWeek: 'friday' }),
    ])

    // Assert
    expect(replaced).toEqual({ type: 'success', data: null })
    expect(await daysOf(staffId)).toEqual(['monday'])
  })

  it('should keep the old rows when a new row is refused', async () => {
    // Arrange
    const { salonId, staffId } = await storedMember()
    await storeSchedules(staffId, [newSchedule({ dayOfWeek: 'monday' })])

    // Act
    const replaced = await repository().replace(salonId, staffId, [
      newSchedule({ dayOfWeek: 'friday' }),
      newSchedule({ dayOfWeek: 'friday' }),
    ])

    // Assert
    expect(replaced).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: 'Failed to replace staff schedules',
        cause: { code: '23505', constraint: 'staff_schedules_weekly_unique' },
      },
    })
    expect(await daysOf(staffId)).toEqual(['monday'])
  })
})

describe('StaffScheduleRepository on a database that is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const staffId = staffIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (repository: StaffScheduleRepository) => Promise<unknown>]>([
    [
      'Failed to find staff schedules',
      (gone) => gone.findByStaff(salonId, staffId),
    ],
    [
      'Failed to replace staff schedules',
      (gone) => gone.replace(salonId, staffId, []),
    ],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new StaffScheduleRepository(await databases.gone())

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
