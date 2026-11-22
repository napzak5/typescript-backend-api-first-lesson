import { describe, expect, it } from 'vitest'
import { USER_ID } from '../../__tests__/fixtures/auth-fixtures'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  dbStaff,
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../__tests__/fixtures/staff-fixtures'
import {
  apiStaffProfile,
  dbStaffProfile,
} from '../../__tests__/fixtures/staff-profile-fixtures'
import { staffIdSchema } from '../../models/staff'
import type { DbStaffProfile } from '../../models/staff-profile'
import { staffProfileSearchRequestSchema } from '../../schemas/staff-profile.schema'
import { StaffProfileReadMapper } from '../read/staff-profile.mapper'
import { StaffProfileWriteMapper } from '../write/staff-profile.mapper'

/** The properties of StaffProfileResponse: what customers are shown of a row of `staff`. */
const PROFILE_PROPERTIES = [
  'bio',
  'canReceiveBookings',
  'certifications',
  'displayName',
  'id',
  'imageUrl',
  'level',
  'position',
  'salonId',
  'specialties',
  'yearsOfExperience',
]

/** The columns of `staff` that customers are not shown. */
const PRIVATE_COLUMNS = [
  'userId',
  'firstName',
  'lastName',
  'firstNameKana',
  'lastNameKana',
  'email',
  'phoneNumber',
  'alternativePhone',
  'staffCode',
  'hireDate',
  'employmentType',
  'baseSalary',
  'commissionRate',
  'maxConcurrentBookings',
  'bufferTimeBefore',
  'bufferTimeAfter',
  'isActive',
  'deletedAt',
  'createdAt',
  'updatedAt',
]

describe('StaffProfileReadMapper.toApiStaffProfile', () => {
  it('returns every property of the profile under its own name, with its value', () => {
    expect(StaffProfileReadMapper.toApiStaffProfile(dbStaffProfile())).toEqual(
      apiStaffProfile(),
    )
  })

  it('returns the 11 properties of the profile and no other', () => {
    const profile = StaffProfileReadMapper.toApiStaffProfile(dbStaffProfile())

    expect(Object.keys(profile).toSorted()).toEqual(PROFILE_PROPERTIES)
  })

  it('leaves behind everything else a row of the ledger carries', () => {
    const row = dbStaff({ userId: USER_ID })

    const profile = StaffProfileReadMapper.toApiStaffProfile(row)

    expect(Object.keys(profile).toSorted()).toEqual(PROFILE_PROPERTIES)
    expect(profile).toEqual(apiStaffProfile())
  })

  it('names, together with what it leaves behind, every column of the table', () => {
    expect([...PROFILE_PROPERTIES, ...PRIVATE_COLUMNS].toSorted()).toEqual(
      Object.keys(dbStaff()).toSorted(),
    )
  })

  it.each(['position', 'bio', 'imageUrl', 'yearsOfExperience'])(
    'keeps null for %s',
    (property) => {
      const profile = StaffProfileReadMapper.toApiStaffProfile(
        dbStaffProfile({ [property]: null }),
      )

      expect(profile).toMatchObject({ [property]: null })
    },
  )

  it('keeps empty lists as empty lists', () => {
    const profile = StaffProfileReadMapper.toApiStaffProfile(
      dbStaffProfile({ specialties: [], certifications: [] }),
    )

    expect(profile).toMatchObject({ specialties: [], certifications: [] })
  })

  it('keeps the order of the lists', () => {
    const profile = StaffProfileReadMapper.toApiStaffProfile(
      dbStaffProfile({
        specialties: ['perm', 'cut', 'color'],
        certifications: ['b', 'a'],
      }),
    )

    expect(profile.specialties).toEqual(['perm', 'cut', 'color'])
    expect(profile.certifications).toEqual(['b', 'a'])
  })

  it('shows a staff member who takes no bookings as one', () => {
    const profile = StaffProfileReadMapper.toApiStaffProfile(
      dbStaffProfile({ canReceiveBookings: false }),
    )

    expect(profile.canReceiveBookings).toBe(false)
  })

  it.each<DbStaffProfile['level']>([
    'junior',
    'stylist',
    'senior',
    'expert',
    'director',
  ])('keeps the level %s', (level) => {
    const profile = StaffProfileReadMapper.toApiStaffProfile(
      dbStaffProfile({ level }),
    )

    expect(profile.level).toBe(level)
  })
})

describe('StaffProfileReadMapper.toApiStaffProfilePage', () => {
  it('answers with the profiles of the list and where the list goes on', () => {
    const page = StaffProfileReadMapper.toApiStaffProfilePage(
      {
        profiles: [
          dbStaffProfile(),
          dbStaffProfile({ id: OTHER_STAFF_MEMBER_ID, displayName: 'Taro' }),
        ],
        total: 8,
        hasMore: true,
      },
      { limit: 2, after: staffIdSchema.parse(STAFF_MEMBER_ID) },
    )

    expect(page).toStrictEqual({
      data: [
        apiStaffProfile(),
        apiStaffProfile({ id: OTHER_STAFF_MEMBER_ID, displayName: 'Taro' }),
      ],
      meta: {
        total: 8,
        limit: 2,
        hasMore: true,
        cursor: STAFF_MEMBER_ID,
        nextCursor: OTHER_STAFF_MEMBER_ID,
        prevCursor: null,
      },
    })
  })

  it('answers with a page without profiles for a list that has none', () => {
    expect(
      StaffProfileReadMapper.toApiStaffProfilePage(
        { profiles: [], total: 0, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toStrictEqual({
      data: [],
      meta: {
        total: 0,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      },
    })
  })
})

describe('StaffProfileWriteMapper.fromUpdateRequest', () => {
  it('changes only the properties that are present, as they are', () => {
    expect(
      StaffProfileWriteMapper.fromUpdateRequest({
        specialties: ['perm'],
        yearsOfExperience: 11,
      }),
    ).toStrictEqual({ specialties: ['perm'], yearsOfExperience: 11 })
  })

  it('clears a nullable column when the property is null', () => {
    expect(
      StaffProfileWriteMapper.fromUpdateRequest({ bio: null, imageUrl: null }),
    ).toStrictEqual({ bio: null, imageUrl: null })
  })
})

describe('StaffProfileWriteMapper.fromSearchRequest', () => {
  it('asks for the first 20 profiles, with no filter, when the request names nothing', () => {
    expect(StaffProfileWriteMapper.fromSearchRequest({})).toEqual({
      limit: 20,
      after: null,
      salonId: null,
      specialty: null,
      city: null,
    })
  })

  it('takes the place and every filter the request names, as they are', () => {
    const request = staffProfileSearchRequestSchema.parse({
      limit: 3,
      cursor: STAFF_MEMBER_ID,
      salonId: SALON_ID,
      specialty: 'color',
      city: '港区',
    })

    expect(StaffProfileWriteMapper.fromSearchRequest(request)).toEqual({
      limit: 3,
      after: STAFF_MEMBER_ID,
      salonId: SALON_ID,
      specialty: 'color',
      city: '港区',
    })
  })
})
