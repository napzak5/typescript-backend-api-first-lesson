import { CustomerGenderTypeSchema } from '@beauty-salon-backend/generated'
import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiCustomerBulkCreateResponse,
  ApiCustomerBulkDeleteResponse,
  ApiCustomerBulkUpdateResponse,
  ApiCustomerDataExportResponse,
  ApiCustomerResponse,
  CustomerId,
  DbCustomer,
} from '../../models/customer'
import type { ApiPage, Paging } from '../../models/page'
import type {
  CustomerData,
  CustomerList,
} from '../../repositories/customer.repository'
import { storedCustomerPreferencesSchema } from '../../schemas/customer.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { BookingReadMapper } from './booking.mapper'
import { timestampSchema } from './columns'
import { CustomerAllergyReadMapper } from './customer-allergy.mapper'
import { CustomerPreferencesReadMapper } from './customer-preferences.mapper'
import { CustomerVersionReadMapper } from './customer-version.mapper'
import { MedicalChartReadMapper } from './medical-chart.mapper'
import { toApiPage } from './page'
import { PointReadMapper } from './point.mapper'
import { ReviewReadMapper } from './review.mapper'
import { SaleReadMapper } from './sale.mapper'
import { TreatmentRecordReadMapper } from './treatment-record.mapper'
import { UserReadMapper } from './user.mapper'

/**
 * Database row → API response. Property names are the column names; what
 * changes is the representation of three kinds of column:
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 * - `jsonb` is untyped in the database and is checked against the API model
 * - `gender` is text in the database and one of the values of the API
 */

const convertedColumnsSchema = z.object({
  gender: CustomerGenderTypeSchema.nullable(),
  preferences: storedCustomerPreferencesSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiCustomerResponse,
    'gender' | 'preferences' | 'createdAt' | 'updatedAt'
  >
>

const toApiCustomer = (
  customer: DbCustomer,
): Result<ApiCustomerResponse, DomainError> => {
  const { deletedAt, ...columns } = customer

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, customer, 'Invalid stored customer'),
      (converted) => ({ ...columns, ...converted }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored customer ${customer.id} does not match the API model`,
        error,
      ),
  )
}

/** Each of a list mapped, or the first error. */
const each = <T, U>(
  items: readonly T[],
  toApi: (item: T) => Result<U, DomainError>,
): Result<U[], DomainError> => {
  const mapped: U[] = []
  for (const item of items) {
    const one = toApi(item)
    if (one.type === 'error') {
      return one
    }
    mapped.push(one.data)
  }
  return Result.success(mapped)
}

/**
 * Everything held of a customer as the API shows each part of it. A
 * stored row that does not match its API model is a database error, as it
 * is for each part on its own.
 */
const toApiDataExport = (
  id: CustomerId,
  data: CustomerData,
  exportedAt: string,
): Result<ApiCustomerDataExportResponse, DomainError> => {
  const customer = toApiCustomer(data.customer)
  if (customer.type === 'error') {
    return customer
  }
  const account =
    data.account === null
      ? Result.success(null)
      : UserReadMapper.toApiUser(data.account)
  if (account.type === 'error') {
    return account
  }
  const preferences =
    data.preferences === null
      ? Result.success(null)
      : CustomerPreferencesReadMapper.toApiPreferences(id, data.preferences)
  if (preferences.type === 'error') {
    return preferences
  }
  const medicalChart =
    data.medicalChart === null
      ? Result.success(null)
      : MedicalChartReadMapper.toApiMedicalChart(data.medicalChart)
  if (medicalChart.type === 'error') {
    return medicalChart
  }
  const allergies = CustomerAllergyReadMapper.toApiCustomerAllergies(
    data.allergies,
  )
  if (allergies.type === 'error') {
    return allergies
  }
  const bookings = BookingReadMapper.toApiBookings(data.bookings)
  if (bookings.type === 'error') {
    return bookings
  }
  const sales = SaleReadMapper.toApiSales(data.sales)
  if (sales.type === 'error') {
    return sales
  }
  const pointTransactions = PointReadMapper.toApiPointTransactions(
    data.pointTransactions,
  )
  if (pointTransactions.type === 'error') {
    return pointTransactions
  }
  const reviews = ReviewReadMapper.toApiReviews(data.reviews)
  if (reviews.type === 'error') {
    return reviews
  }
  const treatmentRecords = TreatmentRecordReadMapper.toApiTreatmentRecords(
    data.treatmentRecords,
  )
  if (treatmentRecords.type === 'error') {
    return treatmentRecords
  }
  const versions = each(
    data.versions,
    CustomerVersionReadMapper.toApiCustomerVersion,
  )
  if (versions.type === 'error') {
    return versions
  }

  return Result.success({
    exportedAt,
    customer: customer.data,
    account: account.data,
    preferences: preferences.data,
    medicalChart: medicalChart.data,
    allergies: allergies.data,
    bookings: bookings.data,
    sales: sales.data,
    pointTransactions: pointTransactions.data,
    reviews: reviews.data,
    helpfulReviewIds: data.helpfulReviewIds,
    treatmentRecords: treatmentRecords.data,
    versions: versions.data,
  })
}

export const CustomerReadMapper = {
  toApiCustomer,
  toApiDataExport,

  toApiCustomers(
    customers: DbCustomer[],
  ): Result<ApiCustomerResponse[], DomainError> {
    const apiCustomers: ApiCustomerResponse[] = []
    for (const customer of customers) {
      const mapped = toApiCustomer(customer)
      if (mapped.type === 'error') {
        return mapped
      }
      apiCustomers.push(mapped.data)
    }
    return Result.success(apiCustomers)
  },

  /** The customers of a list as a page of it. */
  toApiCustomerPage(
    { customers, total, hasMore }: CustomerList,
    paging: Paging<CustomerId>,
  ): Result<ApiPage<ApiCustomerResponse>, DomainError> {
    return Result.map(CustomerReadMapper.toApiCustomers(customers), (data) =>
      toApiPage(data, { total, hasMore }, paging),
    )
  },

  /** What a request that added several customers is answered with: who was added. */
  toApiBulkCreate(customers: DbCustomer[]): ApiCustomerBulkCreateResponse {
    return { created: customers.map(({ id }) => id) }
  },

  /** What a request that changed several customers is answered with: who was changed. */
  toApiBulkUpdate(customers: DbCustomer[]): ApiCustomerBulkUpdateResponse {
    return { updated: customers.map(({ id }) => id) }
  },

  /** What a request that deleted several customers is answered with: who was deleted. */
  toApiBulkDelete(ids: CustomerId[]): ApiCustomerBulkDeleteResponse {
    return { deleted: ids }
  },
}
