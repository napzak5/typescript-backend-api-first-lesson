import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { StaffScheduleUseCaseDependencies } from '../../business-logic/staff-schedule'
import type {
  ApiStaffSchedule,
  DbStaffSchedule,
} from '../../models/staff-schedule'
import type { ISalonRepository } from '../../repositories/salon.repository'
import type { IStaffScheduleRepository } from '../../repositories/staff-schedule.repository'
import { salonRepositoryWith } from './fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

/** A weekly entry of a working day with a break, as a request states it. */
export const weeklyEntry = (
  overrides: Partial<ApiStaffSchedule> = {},
): ApiStaffSchedule => ({
  dayOfWeek: 'monday',
  date: null,
  startTime: '09:00:00',
  endTime: '18:00:00',
  breakStartTime: '12:00:00',
  breakEndTime: '13:00:00',
  isRecurring: true,
  isAvailable: true,
  notes: null,
  ...overrides,
})

/** An entry of a working day on a single date, without a break. */
export const singleDayEntry = (
  overrides: Partial<ApiStaffSchedule> = {},
): ApiStaffSchedule => ({
  dayOfWeek: null,
  date: '2026-12-31',
  startTime: '10:00:00',
  endTime: '15:00:00',
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: false,
  isAvailable: true,
  notes: '年末の短縮営業',
  ...overrides,
})

/** An entry of a day off on a single date. */
export const dayOffEntry = (
  overrides: Partial<ApiStaffSchedule> = {},
): ApiStaffSchedule => ({
  dayOfWeek: null,
  date: '2026-12-24',
  startTime: null,
  endTime: null,
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: false,
  isAvailable: false,
  notes: '通院',
  ...overrides,
})

/** A row of `staff_schedules` as the driver returns it: the weekly entry above. */
export const dbStaffSchedule = (
  overrides: Partial<DbStaffSchedule> = {},
): DbStaffSchedule => ({
  id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01',
  staffId: STAFF_MEMBER_ID,
  ...weeklyEntry(),
  createdAt: '2026-11-15 21:00:00.123456+09',
  updatedAt: '2026-11-15 12:30:00+00',
  ...overrides,
})

/**
 * A repository that holds the one row above, in which a replacement
 * succeeds and leaves that row; a test overrides what it needs.
 */
const staffScheduleRepositoryWith = (
  overrides: Partial<IStaffScheduleRepository> = {},
): IStaffScheduleRepository => ({
  findByStaff: vi.fn(async () =>
    Result.success<DbStaffSchedule[] | null>([dbStaffSchedule()]),
  ),
  replace: vi.fn(async () =>
    Result.success<DbStaffSchedule[] | null>([dbStaffSchedule()]),
  ),
  ...overrides,
})

/**
 * Everything the use cases of the staff schedules need: the repository
 * above and a salon repository in which the salon exists.
 */
export const staffScheduleDependencies = (
  schedules: Partial<IStaffScheduleRepository> = {},
  salons: Partial<ISalonRepository> = {},
): StaffScheduleUseCaseDependencies => ({
  staffScheduleRepository: staffScheduleRepositoryWith(schedules),
  salonRepository: salonRepositoryWith(salons),
})
