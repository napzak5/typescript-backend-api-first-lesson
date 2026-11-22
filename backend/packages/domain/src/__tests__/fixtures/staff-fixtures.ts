import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { StaffUseCaseDependencies } from '../../business-logic/staff'
import type {
  ApiStaffCreateRequest,
  ApiStaffResponse,
  DbStaff,
} from '../../models/staff'
import type { ISalonRepository } from '../../repositories/salon.repository'
import type {
  IStaffRepository,
  StaffDeletion,
} from '../../repositories/staff.repository'
import { SALON_ID, salonRepositoryWith } from './fixtures'

export const STAFF_MEMBER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'
export const OTHER_STAFF_MEMBER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e02'

/** A request that satisfies every rule and states every property. */
export const staffCreateRequest = (): ApiStaffCreateRequest => ({
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
  displayName: 'Hanako',
  email: 'hanako@aoyama.example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: '03-1234-5678',
  staffCode: 'STF-001',
  level: 'senior',
  position: 'Top stylist',
  specialties: ['cut', 'color'],
  bio: 'Ten years of cutting.',
  imageUrl: 'https://aoyama.example.com/staff/hanako.jpg',
  yearsOfExperience: 10,
  certifications: ['美容師免許'],
  hireDate: '2020-04-01',
  employmentType: 'full-time',
  baseSalary: 300000,
  commissionRate: 12.5,
  canReceiveBookings: true,
  maxConcurrentBookings: 2,
  bufferTimeBefore: 10,
  bufferTimeAfter: 15,
  isActive: true,
})

/** A row of `staff` as the driver returns it: the staff member of the request above. */
export const dbStaff = (overrides: Partial<DbStaff> = {}): DbStaff => ({
  id: STAFF_MEMBER_ID,
  salonId: SALON_ID,
  userId: null,
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
  displayName: 'Hanako',
  email: 'hanako@aoyama.example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: '03-1234-5678',
  staffCode: 'STF-001',
  level: 'senior',
  position: 'Top stylist',
  specialties: ['cut', 'color'],
  bio: 'Ten years of cutting.',
  imageUrl: 'https://aoyama.example.com/staff/hanako.jpg',
  yearsOfExperience: 10,
  certifications: ['美容師免許'],
  hireDate: '2020-04-01',
  employmentType: 'full-time',
  baseSalary: 300000,
  commissionRate: '12.50',
  canReceiveBookings: true,
  maxConcurrentBookings: 2,
  bufferTimeBefore: 10,
  bufferTimeAfter: 15,
  isActive: true,
  deletedAt: null,
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  ...overrides,
})

/** The row above as the API presents it. */
export const apiStaff = (
  overrides: Partial<ApiStaffResponse> = {},
): ApiStaffResponse => ({
  id: STAFF_MEMBER_ID,
  salonId: SALON_ID,
  userId: null,
  ...staffCreateRequest(),
  createdAt: '2026-11-14T09:00:00.123Z',
  updatedAt: '2026-11-14T09:30:00.000Z',
  ...overrides,
})

/**
 * A repository that holds the one staff member above, in which every write
 * succeeds; a test overrides what it needs.
 */
const staffRepositoryWith = (
  overrides: Partial<IStaffRepository> = {},
): IStaffRepository => ({
  create: vi.fn(async () => Result.success(dbStaff())),
  findById: vi.fn(async () => Result.success<DbStaff | null>(dbStaff())),
  list: vi.fn(async () =>
    Result.success({ staff: [dbStaff()], total: 1, hasMore: false }),
  ),
  update: vi.fn(async () => Result.success<DbStaff | null>(dbStaff())),
  delete: vi.fn(async () => Result.success<StaffDeletion>({ type: 'deleted' })),
  ...overrides,
})

/**
 * Everything the staff use cases need: the repository above and a salon
 * repository in which the salon exists.
 */
export const staffDependencies = (
  staff: Partial<IStaffRepository> = {},
  salons: Partial<ISalonRepository> = {},
): StaffUseCaseDependencies => ({
  staffRepository: staffRepositoryWith(staff),
  salonRepository: salonRepositoryWith(salons),
})
