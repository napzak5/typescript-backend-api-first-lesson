import type { Result } from '@beauty-salon-backend/utility'
import type {
  DbNewOpeningHours,
  DbNewSalon,
  DbSalonChanges,
  OpeningHoursChange,
  SalonId,
  SalonWithOpeningHours,
} from '../models/salon'
import type { DomainError } from '../shared'

/** Which salons a list returns. A null filter does not restrict the list. */
export type SalonListCriteria = {
  limit: number
  /** Return the salons that follow this one; null starts from the newest. */
  after: SalonId | null
  keyword: string | null
  prefecture: string | null
  city: string | null
  isActive: boolean | null
  minRating: number | null
  /** A salon must have every one of these; an empty list does not filter. */
  features: string[]
}

export type SalonList = {
  salons: SalonWithOpeningHours[]
  /** Number of salons that match the filters, across all pages. */
  total: number
  hasMore: boolean
}

/**
 * Persistence of salons. Deleted salons are invisible to every method, and
 * each write is atomic: a salon and its calendar change together or not at
 * all.
 */
export interface ISalonRepository {
  create(
    salon: DbNewSalon,
    openingHours: DbNewOpeningHours[],
  ): Promise<Result<SalonWithOpeningHours, DomainError>>

  findById(
    id: SalonId,
  ): Promise<Result<SalonWithOpeningHours | null, DomainError>>

  /** Newest first. */
  list(criteria: SalonListCriteria): Promise<Result<SalonList, DomainError>>

  /** Resolves to null when the salon does not exist. */
  update(
    id: SalonId,
    changes: DbSalonChanges,
    openingHours: OpeningHoursChange,
  ): Promise<Result<SalonWithOpeningHours | null, DomainError>>

  /** Resolves to false when the salon does not exist. */
  delete(id: SalonId): Promise<Result<boolean, DomainError>>
}
