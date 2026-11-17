import type { Result } from '@beauty-salon-backend/utility'
import type { CustomerId } from '../models/customer'
import type {
  DbMedicalChart,
  DbMedicalChartChanges,
  DbNewMedicalChart,
  MedicalChartId,
} from '../models/medical-chart'
import type { DomainError } from '../shared'

/** What became of a chart that was to be created. */
export type MedicalChartCreation =
  | { type: 'created'; chart: DbMedicalChart }
  /** No customer of that ID, or one that was deleted. */
  | { type: 'customerNotFound' }
  /** The customer has a chart already. */
  | { type: 'chartExists' }

/** What was found of the chart of a customer. */
export type MedicalChartOfCustomer =
  | { type: 'found'; chart: DbMedicalChart }
  /** No customer of that ID, or one that was deleted. */
  | { type: 'customerNotFound' }
  /** The customer has no chart. */
  | { type: 'chartNotFound' }

/** What became of a chart that was to be changed. */
export type MedicalChartChange =
  | { type: 'changed'; chart: DbMedicalChart }
  /** No chart of that ID, or the chart of a customer who was deleted. */
  | { type: 'notFound' }

/**
 * Which charts a list returns: those of the customers who are not deleted.
 * A null filter does not restrict the list.
 */
export type MedicalChartListCriteria = {
  limit: number
  /** Return the charts that follow this one; null starts from the latest. */
  after: MedicalChartId | null
  /**
   * A keyword that the medical conditions, the notes or the name of a
   * product of a chart contains, in any case.
   */
  search: string | null
  /** Whether the customer of a chart has a row of `customer_allergies`. */
  hasAllergies: boolean | null
}

/** What a list of charts found. */
export type MedicalChartListing =
  | {
      type: 'listed'
      charts: DbMedicalChart[]
      /** Number of charts that match, across all pages. */
      total: number
      hasMore: boolean
    }
  /** The cursor names no chart of the list. */
  | { type: 'cursorNotFound' }

export interface IMedicalChartRepository {
  /** Writes the chart of a customer who is there and has none. */
  create(
    chart: DbNewMedicalChart,
  ): Promise<Result<MedicalChartCreation, DomainError>>

  findByCustomer(
    customerId: CustomerId,
  ): Promise<Result<MedicalChartOfCustomer, DomainError>>

  /** Writes the columns the changes name, and the time of the change. */
  update(
    id: MedicalChartId,
    changes: DbMedicalChartChanges,
  ): Promise<Result<MedicalChartChange, DomainError>>

  /** The charts latest first by their creation, then by their IDs. */
  list(
    criteria: MedicalChartListCriteria,
  ): Promise<Result<MedicalChartListing, DomainError>>
}
