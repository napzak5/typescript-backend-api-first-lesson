import type { Result } from '@beauty-salon-backend/utility'
import type { StaffOfDay } from '../business-logic/available-slot/_shared/slots'
import type {
  StaffCapacity,
  TakenTime,
} from '../business-logic/booking/_shared/occupancy'
import type {
  CalendarDay,
  SalonOfSlots,
  ServiceOfSlots,
} from '../models/available-slot'
import type { SalonId } from '../models/salon'
import type { DbService, ServiceId } from '../models/service'
import type { StaffId } from '../models/staff'
import type { DomainError } from '../shared'

/** The day of a salon whose slots are asked for. */
export type SlotDayQuery = {
  salonId: SalonId
  serviceId: ServiceId
  /** The staff member whose slots are asked for; null for all of the salon. */
  staffId: StaffId | null
  /** The date in the time zone of the salon (`YYYY-MM-DD`). */
  date: string
}

/** What the slots of a day are worked out from, as it was at one moment. */
export type SlotDay = {
  salon: SalonOfSlots
  /** The row of the salon's calendar for the date, if there is one. */
  calendarDay: CalendarDay | null
  /** Null when the salon has no such service, or has one that is deleted. */
  service: ServiceOfSlots | null
  /**
   * When the lines begin that bookings have of the service around the
   * date; cancelled bookings and no-shows are not among them.
   */
  serviceLineStarts: Date[]
  /**
   * The staff members of the salon that are not deleted: the one that was
   * asked for, or all of them. Each comes with the rows of their schedule
   * that can apply on the date and with the service lines other bookings
   * have for them around it.
   */
  staff: StaffOfDay[]
}

/** A staff member and a time, of which it is asked whether the ledger takes them. */
export type OccupancyQuery = {
  salonId: SalonId
  serviceId: ServiceId
  staffId: StaffId
  startTime: Date
}

/** What says whether a staff member is free for a service at a time. */
export type SlotOccupancy = {
  /** Null when the salon has no such service, or has one that is deleted. */
  service: Pick<DbService, 'duration'> | null
  /** Null when the salon has no such staff member, or has one that is deleted. */
  staff: StaffCapacity | null
  /**
   * The service lines other bookings have for the staff member around the
   * time; empty while the service or the staff member is not there.
   */
  taken: TakenTime[]
}

/**
 * What the available slots of a salon are worked out from. Nothing is
 * written and nothing is locked: each method reads at one moment, and its
 * answer is of that moment.
 */
export interface IAvailableSlotRepository {
  /** Resolves to null when the salon does not exist; a deleted salon does not. */
  findDay(query: SlotDayQuery): Promise<Result<SlotDay | null, DomainError>>

  /** Whether the salon itself exists is not looked at here. */
  findOccupancy(
    query: OccupancyQuery,
  ): Promise<Result<SlotOccupancy, DomainError>>
}
