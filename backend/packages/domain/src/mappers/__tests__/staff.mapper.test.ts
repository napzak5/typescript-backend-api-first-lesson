import { describe, expect, it } from 'vitest'
import { USER_ID } from '../../__tests__/fixtures/auth-fixtures'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  apiStaff,
  dbStaff,
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
  staffCreateRequest,
} from '../../__tests__/fixtures/staff-fixtures'
import { salonIdSchema } from '../../models/salon'
import { staffIdSchema } from '../../models/staff'
import { staffSearchRequestSchema } from '../../schemas/staff.schema'
import { StaffReadMapper } from '../read/staff.mapper'
import { StaffWriteMapper } from '../write/staff.mapper'

/** The properties of StaffResponse: the columns of `staff` without `awards` and `deletedAt`. */
const RESPONSE_PROPERTIES = [
  'alternativePhone',
  'baseSalary',
  'bio',
  'bufferTimeAfter',
  'bufferTimeBefore',
  'canReceiveBookings',
  'certifications',
  'commissionRate',
  'createdAt',
  'displayName',
  'email',
  'employmentType',
  'firstName',
  'firstNameKana',
  'hireDate',
  'id',
  'imageUrl',
  'isActive',
  'lastName',
  'lastNameKana',
  'level',
  'maxConcurrentBookings',
  'phoneNumber',
  'position',
  'salonId',
  'specialties',
  'staffCode',
  'updatedAt',
  'userId',
  'yearsOfExperience',
]

describe('StaffWriteMapper.fromCreateRequest', () => {
  it('keeps every property under its own name, with the commission rate as the text of a numeric column', () => {
    const row = StaffWriteMapper.fromCreateRequest(staffCreateRequest())

    expect(row).toEqual({ ...staffCreateRequest(), commissionRate: '12.5' })
  })

  it('keeps a commission rate of null as null', () => {
    const row = StaffWriteMapper.fromCreateRequest({
      ...staffCreateRequest(),
      commissionRate: null,
    })

    expect(row.commissionRate).toBeNull()
  })

  it.each([
    [0, '0'],
    [100, '100'],
    [0.07, '0.07'],
    [33.33, '33.33'],
  ])('writes a commission rate of %d as %s', (commissionRate, expected) => {
    const row = StaffWriteMapper.fromCreateRequest({
      ...staffCreateRequest(),
      commissionRate,
    })

    expect(row.commissionRate).toBe(expected)
  })

  it('keeps null, false, zero, empty lists and the order of the lists as they are', () => {
    const request = {
      ...staffCreateRequest(),
      staffCode: null,
      specialties: ['perm', 'cut', 'color'],
      certifications: [],
      yearsOfExperience: 0,
      bufferTimeBefore: 0,
      canReceiveBookings: false,
      isActive: false,
    }

    expect(StaffWriteMapper.fromCreateRequest(request)).toEqual({
      ...request,
      commissionRate: '12.5',
    })
  })

  it('writes no column that a request does not write', () => {
    const row = StaffWriteMapper.fromCreateRequest(staffCreateRequest())

    expect(Object.keys(row).toSorted()).toEqual(
      Object.keys(staffCreateRequest()).toSorted(),
    )
  })
})

describe('StaffWriteMapper.fromUpdateRequest', () => {
  it('changes only the properties that are present', () => {
    const changes = StaffWriteMapper.fromUpdateRequest({
      position: 'Director',
      isActive: false,
    })

    expect(changes).toEqual({ position: 'Director', isActive: false })
  })

  it('does not name the commission rate when the request does not', () => {
    const changes = StaffWriteMapper.fromUpdateRequest({ position: null })

    expect(Object.keys(changes)).toEqual(['position'])
  })

  it('writes a commission rate as the text of a numeric column', () => {
    const changes = StaffWriteMapper.fromUpdateRequest({ commissionRate: 7.25 })

    expect(changes).toEqual({ commissionRate: '7.25' })
  })

  it('clears the commission rate when the property is null', () => {
    const changes = StaffWriteMapper.fromUpdateRequest({ commissionRate: null })

    expect(changes).toEqual({ commissionRate: null })
  })

  it('keeps a commission rate of 0, which is not "unset"', () => {
    const changes = StaffWriteMapper.fromUpdateRequest({ commissionRate: 0 })

    expect(changes).toEqual({ commissionRate: '0' })
  })

  it('replaces a list with none when the request has an empty list', () => {
    const changes = StaffWriteMapper.fromUpdateRequest({ specialties: [] })

    expect(changes).toEqual({ specialties: [] })
  })

  it('changes every column when the request names every property', () => {
    const changes = StaffWriteMapper.fromUpdateRequest(staffCreateRequest())

    expect(changes).toEqual({ ...staffCreateRequest(), commissionRate: '12.5' })
  })
})

describe('StaffReadMapper.toApiStaff', () => {
  it('returns the columns under their own names, the commission rate as a number and the timestamps in ISO 8601 UTC', () => {
    const result = StaffReadMapper.toApiStaff(dbStaff())

    expect(result).toEqual({ type: 'success', data: apiStaff() })
  })

  it('has exactly the properties of StaffResponse: neither the awards nor the time of deletion', () => {
    const result = StaffReadMapper.toApiStaff(
      dbStaff({ deletedAt: '2026-11-15 10:00:00+00' }),
    )

    expect(RESPONSE_PROPERTIES).toHaveLength(30)
    expect(
      Object.keys(result.type === 'success' ? result.data : {}).toSorted(),
    ).toEqual(RESPONSE_PROPERTIES)
  })

  it('names the login account of a staff member who has one', () => {
    const result = StaffReadMapper.toApiStaff(dbStaff({ userId: USER_ID }))

    expect(result).toMatchObject({ type: 'success', data: { userId: USER_ID } })
  })

  it('keeps null as null', () => {
    const unset = {
      firstNameKana: null,
      lastNameKana: null,
      alternativePhone: null,
      staffCode: null,
      position: null,
      bio: null,
      imageUrl: null,
      yearsOfExperience: null,
      hireDate: null,
      employmentType: null,
      baseSalary: null,
      commissionRate: null,
    }

    const result = StaffReadMapper.toApiStaff(dbStaff(unset))

    expect(result).toEqual({ type: 'success', data: apiStaff(unset) })
  })

  it('keeps false, zero, empty lists and the order of the lists as they are stored', () => {
    const stored = {
      specialties: ['perm', 'cut', 'color'],
      certifications: [],
      yearsOfExperience: 0,
      baseSalary: 0,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      canReceiveBookings: false,
      isActive: false,
    }

    const result = StaffReadMapper.toApiStaff(dbStaff(stored))

    expect(result).toEqual({ type: 'success', data: apiStaff(stored) })
  })

  it.each([
    ['0.00', 0],
    ['100.00', 100],
    ['0.07', 0.07],
    ['33.33', 33.33],
  ])(
    'reads a stored commission rate of %s as %d',
    (commissionRate, expected) => {
      const result = StaffReadMapper.toApiStaff(dbStaff({ commissionRate }))

      expect(result).toMatchObject({
        type: 'success',
        data: { commissionRate: expected },
      })
    },
  )

  it.each([
    ['a creation time that is not a time', { createdAt: 'yesterday' }],
    ['an update time that is not a time', { updatedAt: '' }],
    ['a commission rate that is not a number', { commissionRate: 'a lot' }],
  ])(
    'fails with a database error for %s, naming the staff member',
    (_case, stored) => {
      const result = StaffReadMapper.toApiStaff(dbStaff(stored))

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored staff member ${STAFF_MEMBER_ID} does not match the API model`,
        },
      })
    },
  )
})

describe('StaffReadMapper.toApiStaffList', () => {
  it('maps every staff member, in order', () => {
    const result = StaffReadMapper.toApiStaffList([
      dbStaff({ id: OTHER_STAFF_MEMBER_ID }),
      dbStaff(),
    ])

    expect(result).toEqual({
      type: 'success',
      data: [apiStaff({ id: OTHER_STAFF_MEMBER_ID }), apiStaff()],
    })
  })

  it('maps no staff member to an empty list', () => {
    expect(StaffReadMapper.toApiStaffList([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('fails as a whole when one stored staff member is invalid, naming that one', () => {
    const result = StaffReadMapper.toApiStaffList([
      dbStaff(),
      dbStaff({ id: OTHER_STAFF_MEMBER_ID, createdAt: 'yesterday' }),
    ])

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored staff member ${OTHER_STAFF_MEMBER_ID} does not match the API model`,
      },
    })
  })
})

describe('StaffReadMapper.toApiStaffPage', () => {
  it('answers with the staff members of the list and where the list goes on', () => {
    const result = StaffReadMapper.toApiStaffPage(
      {
        staff: [dbStaff(), dbStaff({ id: OTHER_STAFF_MEMBER_ID })],
        total: 6,
        hasMore: true,
      },
      { limit: 2, after: staffIdSchema.parse(STAFF_MEMBER_ID) },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: STAFF_MEMBER_ID }, { id: OTHER_STAFF_MEMBER_ID }],
        meta: {
          total: 6,
          limit: 2,
          hasMore: true,
          cursor: STAFF_MEMBER_ID,
          nextCursor: OTHER_STAFF_MEMBER_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('fails as a whole when one stored staff member is invalid', () => {
    const result = StaffReadMapper.toApiStaffPage(
      {
        staff: [dbStaff({ updatedAt: 'recently' })],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('StaffWriteMapper.fromSearchRequest', () => {
  const salonId = salonIdSchema.parse(SALON_ID)

  it('asks for the first 20 staff members of the salon when the request names nothing', () => {
    expect(StaffWriteMapper.fromSearchRequest({}, salonId)).toEqual({
      salonId: SALON_ID,
      limit: 20,
      after: null,
    })
  })

  it('takes the place the request names', () => {
    const request = staffSearchRequestSchema.parse({
      limit: 3,
      cursor: STAFF_MEMBER_ID,
    })

    expect(StaffWriteMapper.fromSearchRequest(request, salonId)).toEqual({
      salonId: SALON_ID,
      limit: 3,
      after: STAFF_MEMBER_ID,
    })
  })
})
