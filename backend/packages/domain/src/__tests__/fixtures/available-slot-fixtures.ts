import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type {
  AvailableSlotUseCaseDependencies,
  StaffOfDay,
} from '../../business-logic/available-slot'
import type { ServiceOfSlots } from '../../models/available-slot'
import type { ApiBusinessHours } from '../../models/salon'
import type {
  IAvailableSlotRepository,
  SlotDay,
  SlotOccupancy,
} from '../../repositories/available-slot.repository'
import type { ISalonRepository } from '../../repositories/salon.repository'
import { NOW } from './auth-fixtures'
import { SALON_ID, salonRepositoryWith } from './fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'
import { dbStaffSchedule } from './staff-schedule-fixtures'

/** The day the slots of the tests are of: a Monday, after `NOW`. */
export const DATE = '2026-11-16'

/** The moment at which the clocks of Tokyo show a time (HH:mm) on a date. */
export const jst = (time: string, date: string = DATE): Date =>
  new Date(`${date}T${time}:00+09:00`)

/** The weekly hours of a Monday: open from 10:00 to 19:00. */
export const weeklyHours = (
  overrides: Partial<ApiBusinessHours> = {},
): ApiBusinessHours => ({
  dayOfWeek: 'monday',
  operatingSlots: [{ startTime: '10:00', endTime: '19:00' }],
  breakSlots: null,
  isClosed: false,
  effectivePeriod: null,
  ...overrides,
})

/** A service of an hour that every staff member takes on every day. */
export const serviceOfSlots = (
  overrides: Partial<ServiceOfSlots> = {},
): ServiceOfSlots => ({
  duration: 60,
  isActive: true,
  serviceStatus: 'active',
  allowOnlineBooking: true,
  availability: 'always',
  bookingRequirements: [],
  maxBookingsPerDay: null,
  requiredStaffLevel: null,
  ...overrides,
})

/**
 * A staff member who takes one booking at a time and keeps no time free
 * around it, with the weekly row of the schedule fixtures: on Mondays from
 * 09:00 to 18:00, with a break from 12:00 to 13:00. Nothing is booked.
 */
export const staffOfDay = (
  overrides: Partial<StaffOfDay> = {},
): StaffOfDay => ({
  id: STAFF_MEMBER_ID,
  level: 'stylist',
  isActive: true,
  canReceiveBookings: true,
  bufferTimeBefore: 0,
  bufferTimeAfter: 0,
  maxConcurrentBookings: 1,
  schedules: [dbStaffSchedule()],
  taken: [],
  ...overrides,
})

/**
 * What the repository reads for `DATE`: a salon in Tokyo with the weekly
 * hours above and no calendar, the service above, and the staff member
 * above. They can begin the service at 10:00, 10:30 and 11:00, and every
 * half hour from 13:00 to 17:00.
 */
export const slotDay = (overrides: Partial<SlotDay> = {}): SlotDay => ({
  salon: {
    id: SALON_ID,
    isActive: true,
    timezone: 'Asia/Tokyo',
    businessHours: [weeklyHours()],
  },
  calendarDay: null,
  service: serviceOfSlots(),
  serviceLineStarts: [],
  staff: [staffOfDay()],
  ...overrides,
})

/** The times (HH:mm in Tokyo) at which the staff member above can begin the service above. */
export const STARTS_OF_DAY = [
  '10:00',
  '10:30',
  '11:00',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
]

/** What the repository reads for a check: a service of an hour and a staff member nothing is booked for. */
export const slotOccupancy = (
  overrides: Partial<SlotOccupancy> = {},
): SlotOccupancy => ({
  service: { duration: 60 },
  staff: { bufferTimeBefore: 0, bufferTimeAfter: 0, maxConcurrentBookings: 1 },
  taken: [],
  ...overrides,
})

/**
 * Everything the use cases of the available slots need: a repository that
 * reads the day and the occupancy above, a salon repository in which the
 * salon exists, and a clock that shows `NOW`, two days before `DATE`.
 */
export const availableSlotDependencies = (
  slots: Partial<IAvailableSlotRepository> = {},
  salons: Partial<ISalonRepository> = {},
  now: Date = NOW,
): AvailableSlotUseCaseDependencies => ({
  availableSlotRepository: {
    findDay: vi.fn(async () => Result.success<SlotDay | null>(slotDay())),
    findOccupancy: vi.fn(async () => Result.success(slotOccupancy())),
    ...slots,
  },
  salonRepository: salonRepositoryWith(salons),
  clock: () => now,
})
