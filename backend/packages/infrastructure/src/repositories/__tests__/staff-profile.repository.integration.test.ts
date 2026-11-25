import { staff } from '@beauty-salon-backend/database'
import {
  type StaffId,
  type StaffProfileListCriteria,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { StaffProfileRepository } from '../staff-profile.repository.impl'
import { insertSalon, insertStaffMember } from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new StaffProfileRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** A staff member in the table, of a new salon unless the test names one. */
const storedMember = async (
  overrides: Parameters<typeof insertStaffMember>[2] = {},
  salonId?: string,
): Promise<StaffId> => {
  const db = databases.database()
  const salon = salonId ?? (await insertSalon(db)).id
  return staffIdSchema.parse((await insertStaffMember(db, salon, overrides)).id)
}

/** The staff members that customers are not shown. */
const hidden: [string, () => Promise<StaffId>][] = [
  ['who does not work at the salon', () => storedMember({ isActive: false })],
  ['who is deleted', () => storedMember({ deletedAt: DELETED_AT })],
  [
    'of a deleted salon',
    async () =>
      storedMember(
        {},
        (await insertSalon(databases.database(), { deletedAt: DELETED_AT })).id,
      ),
  ],
]

/** Every profile, a page of 20. */
const EVERY_PROFILE: StaffProfileListCriteria = {
  limit: 20,
  after: null,
  salonId: null,
  specialty: null,
  city: null,
}

describe('StaffProfileRepository.findById', () => {
  it('should find the profile of the staff member and nothing else of the row', async () => {
    // Arrange
    const salon = await insertSalon(databases.database())
    const id = await storedMember(
      {
        displayName: '佐藤 太郎',
        level: 'senior',
        position: 'トップスタイリスト',
        specialties: ['カット'],
        bio: '髪質改善が得意です。',
        imageUrl: 'https://example.com/taro.jpg',
        yearsOfExperience: 8,
        certifications: ['美容師免許'],
      },
      salon.id,
    )

    // Act
    const found = await repository().findById(id)

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: {
        id,
        salonId: salon.id,
        displayName: '佐藤 太郎',
        level: 'senior',
        position: 'トップスタイリスト',
        specialties: ['カット'],
        bio: '髪質改善が得意です。',
        imageUrl: 'https://example.com/taro.jpg',
        yearsOfExperience: 8,
        certifications: ['美容師免許'],
        canReceiveBookings: true,
      },
    })
  })

  it.each(hidden)(
    'should find no profile of a staff member %s',
    async (_, arrange) => {
      // Arrange
      const id = await arrange()

      // Act
      const found = await repository().findById(id)

      // Assert
      expect(found).toEqual({ type: 'success', data: null })
    },
  )
})

describe('StaffProfileRepository.update', () => {
  it('should write the changes of the profile and answer it', async () => {
    // Arrange
    const id = await storedMember({ bio: null })

    // Act
    const updated = await repository().update(id, {
      bio: '髪質改善が得意です。',
      yearsOfExperience: 8,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { id, bio: '髪質改善が得意です。', yearsOfExperience: 8 },
    })
  })

  it.each(hidden)(
    'should change no profile of a staff member %s',
    async (_, arrange) => {
      // Arrange
      const id = await arrange()

      // Act
      const updated = await repository().update(id, { bio: '書き換え' })

      // Assert
      expect(updated).toEqual({ type: 'success', data: null })
      const [member] = await databases
        .database()
        .select({ bio: staff.bio })
        .from(staff)
        .where(eq(staff.id, id))
      expect(member?.bio).toBeNull()
    },
  )
})

describe('StaffProfileRepository.list', () => {
  it('should list the shown staff of every salon in the order they were added, a page at a time', async () => {
    // Arrange
    const first = await storedMember({ createdAt: '2026-12-01T00:00:00.000Z' })
    const second = await storedMember({ createdAt: '2026-12-02T00:00:00.000Z' })
    const third = await storedMember({ createdAt: '2026-12-03T00:00:00.000Z' })
    for (const [, arrange] of hidden) {
      await arrange()
    }

    // Act
    const firstPage = await repository().list({ ...EVERY_PROFILE, limit: 2 })
    const nextPage = await repository().list({
      ...EVERY_PROFILE,
      limit: 2,
      after: second,
    })

    // Assert
    expect(firstPage).toMatchObject({
      type: 'success',
      data: {
        profiles: [{ id: first }, { id: second }],
        total: 3,
        hasMore: true,
      },
    })
    expect(nextPage).toMatchObject({
      type: 'success',
      data: { profiles: [{ id: third }], total: 3, hasMore: false },
    })
  })

  it('should go on after a staff member that customers are not shown', async () => {
    // Arrange
    const hiddenOne = await storedMember({
      isActive: false,
      createdAt: '2026-12-01T00:00:00.000Z',
    })
    const shown = await storedMember({ createdAt: '2026-12-02T00:00:00.000Z' })

    // Act
    const listed = await repository().list({
      ...EVERY_PROFILE,
      after: hiddenOne,
    })

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { profiles: [{ id: shown }], total: 1 },
    })
  })

  it('should list the staff of the salon only', async () => {
    // Arrange
    const salon = await insertSalon(databases.database())
    const ofSalon = await storedMember({}, salon.id)
    await storedMember()

    // Act
    const listed = await repository().list({
      ...EVERY_PROFILE,
      salonId: salonIdSchema.parse(salon.id),
    })

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { profiles: [{ id: ofSalon }], total: 1 },
    })
  })

  it('should list the staff who name exactly the specialty', async () => {
    // Arrange
    const colourist = await storedMember({ specialties: ['カット', 'カラー'] })
    await storedMember({ specialties: ['カラーリスト'] })
    await storedMember({ specialties: [] })

    // Act
    const listed = await repository().list({
      ...EVERY_PROFILE,
      specialty: 'カラー',
    })

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { profiles: [{ id: colourist }], total: 1 },
    })
  })

  it('should list the staff of the salons in the city', async () => {
    // Arrange
    const db = databases.database()
    const inOsaka = await insertSalon(db, {
      prefecture: '大阪府',
      city: '大阪市',
    })
    const ofOsaka = await storedMember({}, inOsaka.id)
    await storedMember()

    // Act
    const listed = await repository().list({ ...EVERY_PROFILE, city: '大阪市' })

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { profiles: [{ id: ofOsaka }], total: 1 },
    })
  })

  it('should find no page after a staff member who is not there', async () => {
    // Arrange
    await storedMember()

    // Act
    const listed = await repository().list({
      ...EVERY_PROFILE,
      after: staffIdSchema.parse(UNKNOWN_ID),
    })

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

describe('StaffProfileRepository on a database that is gone', () => {
  const id = staffIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (repository: StaffProfileRepository) => Promise<unknown>]>([
    ['Failed to find staff profile', (gone) => gone.findById(id)],
    [
      'Failed to update staff profile',
      (gone) => gone.update(id, { bio: null }),
    ],
    ['Failed to list staff profiles', (gone) => gone.list(EVERY_PROFILE)],
  ])('should answer "%s" with what the driver said', async (message, call) => {
    // Arrange
    const gone = new StaffProfileRepository(await databases.gone())

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
