import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { StaffProfileUseCaseDependencies } from '../business-logic/staff-profile'
import type { StaffId } from '../models/staff'
import type {
  ApiStaffProfileResponse,
  DbStaffProfile,
} from '../models/staff-profile'
import type {
  IStaffProfileRepository,
  StaffProfileChanges,
} from '../repositories/staff-profile.repository'
import { SALON_ID } from './fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

/** The columns of a staff member that customers are shown, as the driver returns them. */
export const dbStaffProfile = (
  overrides: Partial<DbStaffProfile> = {},
): DbStaffProfile => ({
  id: STAFF_MEMBER_ID,
  salonId: SALON_ID,
  displayName: 'Hanako',
  level: 'senior',
  position: 'Top stylist',
  specialties: ['cut', 'color'],
  bio: 'Ten years of cutting.',
  imageUrl: 'https://aoyama.example.com/staff/hanako.jpg',
  yearsOfExperience: 10,
  certifications: ['美容師免許'],
  canReceiveBookings: true,
  ...overrides,
})

/** The row above as the API presents it: the same properties with the same values. */
export const apiStaffProfile = (
  overrides: Partial<ApiStaffProfileResponse> = {},
): ApiStaffProfileResponse => ({ ...dbStaffProfile(), ...overrides })

/**
 * Everything the staff profile use cases need: a repository that shows the
 * one staff member above and returns it with what an update changed; a test
 * overrides what it needs.
 */
export const staffProfileDependencies = (
  overrides: Partial<IStaffProfileRepository> = {},
): StaffProfileUseCaseDependencies => ({
  staffProfileRepository: {
    findById: vi.fn(async () =>
      Result.success<DbStaffProfile | null>(dbStaffProfile()),
    ),
    list: vi.fn(async () =>
      Result.success({
        profiles: [dbStaffProfile()],
        total: 1,
        hasMore: false,
      }),
    ),
    update: vi.fn(async (_id: StaffId, changes: StaffProfileChanges) =>
      Result.success<DbStaffProfile | null>(dbStaffProfile(changes)),
    ),
    ...overrides,
  },
})

/** The methods of the repository that were called, in the order of the calls. */
export const staffProfileRepositoryCalls = ({
  staffProfileRepository,
}: StaffProfileUseCaseDependencies): string[] =>
  [
    ...vi
      .mocked(staffProfileRepository.findById)
      .mock.invocationCallOrder.map((order) => ({ order, name: 'findById' })),
    ...vi
      .mocked(staffProfileRepository.list)
      .mock.invocationCallOrder.map((order) => ({ order, name: 'list' })),
    ...vi
      .mocked(staffProfileRepository.update)
      .mock.invocationCallOrder.map((order) => ({ order, name: 'update' })),
  ]
    .toSorted((a, b) => a.order - b.order)
    .map(({ name }) => name)
