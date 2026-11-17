import type { Result } from '@beauty-salon-backend/utility'
import type { DbBooking, LedgerReach } from '../models/booking'
import type { CustomerId } from '../models/customer'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type {
  DbNewTreatmentMaterial,
  DbNewTreatmentRecord,
  DbTreatmentRecordChanges,
  TreatmentRecordId,
  TreatmentRecordWithDetails,
} from '../models/treatment-record'
import type { DomainError, ValidationIssue } from '../shared'

/** A record to be created, with its materials in their order. */
export type TreatmentRecordCreateCriteria = {
  /** The salons whose bookings the writer reaches. */
  reach: LedgerReach
  record: DbNewTreatmentRecord
  materials: DbNewTreatmentMaterial[]
}

/** What became of a record that was to be created. */
export type TreatmentRecordCreation =
  | { type: 'created'; record: TreatmentRecordWithDetails }
  /** No booking within the reach, or one of a salon that was deleted. */
  | { type: 'bookingNotFound' }
  /** What the record names does not fit its booking (`creationIssues`). */
  | { type: 'refused'; issues: ValidationIssue[] }
  /** The treatment of the booking has not begun (`isTreated`). */
  | { type: 'bookingNotTreated'; status: DbBooking['status'] }
  /** The booking has a record already. */
  | { type: 'recordExists' }

/** Which records a list returns. A null filter does not restrict the list. */
export type TreatmentRecordListCriteria = {
  /** The salons whose records the reader reaches. */
  reach: LedgerReach
  limit: number
  /** Return the records that follow this one; null starts from the latest. */
  after: TreatmentRecordId | null
  salonId: SalonId | null
  customerId: CustomerId | null
  staffId: StaffId | null
  /**
   * The first and the last moment of the creation of the records, in the
   * spelling of `toISOString`; both are in. A record is compared at the
   * milliseconds a response shows of its creation.
   */
  startDate: string | null
  endDate: string | null
}

/** What a list of records found. */
export type TreatmentRecordListing =
  | {
      type: 'listed'
      records: TreatmentRecordWithDetails[]
      /** Number of records that match, across all pages. */
      total: number
      hasMore: boolean
    }
  /** The cursor names no record within the reach. */
  | { type: 'cursorNotFound' }

/** What a record's update changes: its columns, and its materials when named. */
export type TreatmentRecordUpdateCriteria = {
  changes: DbTreatmentRecordChanges
  /** The materials that replace those of the record; null keeps them. */
  materials: DbNewTreatmentMaterial[] | null
}

/** What became of a record that was to be changed. */
export type TreatmentRecordChange =
  | { type: 'changed'; record: TreatmentRecordWithDetails }
  | { type: 'notFound' }
  /** What the update names does not fit the booking (`treatmentIssues`). */
  | { type: 'refused'; issues: ValidationIssue[] }

/** What became of a record that was to be removed. */
export type TreatmentRecordRemoval = { type: 'removed' } | { type: 'notFound' }

/**
 * Persistence of the treatment records of the bookings of salons. A record
 * is of the salon of its booking; one outside the reach of the reader, or
 * of a salon that was deleted, is a record that does not exist.
 *
 * A creation holds the booking, so that a change of its status and its
 * removal come before or after it, and reads what the record names of the
 * salon once whatever removes those is done. An update and a removal hold
 * the record first. Times are those of the moment of the write, after the
 * waits.
 */
export interface ITreatmentRecordRepository {
  /**
   * Writes the record and its materials, all or none, unless the booking
   * refuses it: one that is not there, what the record names that does not
   * fit (`creationIssues`), a treatment that has not begun (`isTreated`),
   * and a record the booking has, in that order.
   */
  create(
    criteria: TreatmentRecordCreateCriteria,
  ): Promise<Result<TreatmentRecordCreation, DomainError>>

  findById(
    reach: LedgerReach,
    id: TreatmentRecordId,
  ): Promise<Result<TreatmentRecordWithDetails | null, DomainError>>

  /** The latest records first, by their creation, then by their IDs downwards. */
  list(
    criteria: TreatmentRecordListCriteria,
  ): Promise<Result<TreatmentRecordListing, DomainError>>

  /**
   * Writes the changes, and replaces the materials when the update names
   * them, unless what it names does not fit the booking of the record.
   */
  update(
    reach: LedgerReach,
    id: TreatmentRecordId,
    criteria: TreatmentRecordUpdateCriteria,
  ): Promise<Result<TreatmentRecordChange, DomainError>>

  /** Removes the record with its materials and photos. */
  delete(
    reach: LedgerReach,
    id: TreatmentRecordId,
  ): Promise<Result<TreatmentRecordRemoval, DomainError>>
}
