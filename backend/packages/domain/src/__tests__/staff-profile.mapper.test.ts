import { describe, expect, it } from 'vitest'
import { StaffProfileReadMapper } from '../mappers/read/staff-profile.mapper'
import type { DbStaffProfile } from '../models/staff-profile'
import { USER_ID } from './auth-fixtures'
import { dbStaff } from './staff-fixtures'
import { apiStaffProfile, dbStaffProfile } from './staff-profile-fixtures'

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
  'awards',
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
