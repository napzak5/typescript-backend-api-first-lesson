import { Result } from '@beauty-salon-backend/utility'
import { match, P } from 'ts-pattern'
import { BookingReadMapper } from '../../../mappers/read/booking.mapper'
import { CustomerReadMapper } from '../../../mappers/read/customer.mapper'
import { CustomerAllergyReadMapper } from '../../../mappers/read/customer-allergy.mapper'
import { CustomerPreferencesReadMapper } from '../../../mappers/read/customer-preferences.mapper'
import { CustomerVersionReadMapper } from '../../../mappers/read/customer-version.mapper'
import { MedicalChartReadMapper } from '../../../mappers/read/medical-chart.mapper'
import { PointReadMapper } from '../../../mappers/read/point.mapper'
import { ReviewReadMapper } from '../../../mappers/read/review.mapper'
import { SaleReadMapper } from '../../../mappers/read/sale.mapper'
import { TreatmentRecordReadMapper } from '../../../mappers/read/treatment-record.mapper'
import { UserReadMapper } from '../../../mappers/read/user.mapper'
import type {
  ApiCustomerDataExportResponse,
  ApiCustomerResponse,
  CustomerId,
} from '../../../models/customer'
import type { CustomerData } from '../../../repositories/customer.repository'
import type { DomainError } from '../../../shared'

/** An export as a file: what it is called and what it says. */
export type CustomerFile = {
  fileName: string
  content: string
}

/**
 * How many customers one CSV export lists at most. The file is made whole
 * before it is sent, so that a failure is told as a problem instead of as
 * a file cut short.
 */
export const MOST_EXPORTED = 10_000

/**
 * Every property of a customer response, in the order of the contract. The
 * type asks for every property, each named by itself.
 */
const COLUMNS: { [Column in keyof ApiCustomerResponse]: Column } = {
  id: 'id',
  userId: 'userId',
  firstName: 'firstName',
  lastName: 'lastName',
  firstNameKana: 'firstNameKana',
  lastNameKana: 'lastNameKana',
  email: 'email',
  phoneNumber: 'phoneNumber',
  alternativePhone: 'alternativePhone',
  postalCode: 'postalCode',
  prefecture: 'prefecture',
  city: 'city',
  address: 'address',
  building: 'building',
  birthDate: 'birthDate',
  gender: 'gender',
  occupation: 'occupation',
  membershipTier: 'membershipTier',
  loyaltyPoints: 'loyaltyPoints',
  preferences: 'preferences',
  notes: 'notes',
  internalNotes: 'internalNotes',
  tags: 'tags',
  referredBy: 'referredBy',
  referralCode: 'referralCode',
  allowMarketing: 'allowMarketing',
  allowSms: 'allowSms',
  allowEmail: 'allowEmail',
  firstVisitDate: 'firstVisitDate',
  lastVisitDate: 'lastVisitDate',
  visitCount: 'visitCount',
  noShowCount: 'noShowCount',
  cancellationCount: 'cancellationCount',
  isActive: 'isActive',
  hairType: 'hairType',
  hairThickness: 'hairThickness',
  scalpCondition: 'scalpCondition',
  customerStatus: 'customerStatus',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

/** The columns of the CSV file, in their order. */
const CUSTOMER_COLUMNS = Object.values(COLUMNS)

/** Every line ends with CRLF, as RFC 4180 has it. */
const LINE_END = '\r\n'

/**
 * The byte order mark: a spreadsheet that opens the file reads it as UTF-8
 * by it, as it does a file it saved as "CSV UTF-8".
 */
const BYTE_ORDER_MARK = '\uFEFF'

/**
 * A text a spreadsheet would take for a formula begins with one of these:
 * `=`, `+`, `-`, `@`, a tab or a carriage return (CSV injection, as OWASP
 * describes it).
 */
const FORMULA = /^[=+\-@\t\r]/

/** A value with a comma, a double quote or a line break is quoted. */
const fielded = (text: string): string =>
  /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text

/**
 * One cell: null is empty, a text that begins as a formula is preceded by
 * `'`, and any other value is written as JSON (`true`, `12`, a list or an
 * object).
 */
const cellOf = (value: ApiCustomerResponse[keyof ApiCustomerResponse]) =>
  match(value)
    .with(null, () => '')
    .with(P.string, (text) => fielded(FORMULA.test(text) ? `'${text}` : text))
    .with(P.nonNullable, (other) => fielded(JSON.stringify(other)))
    .exhaustive()

/**
 * The customers as a CSV file: the names of the columns, then one line for
 * every customer, in the order given. The file is named by the day of the
 * export in UTC.
 */
export const customersFileOf = (
  customers: readonly ApiCustomerResponse[],
  exportedAt: string,
): CustomerFile => ({
  fileName: `customers-${exportedAt.slice(0, 'YYYY-MM-DD'.length)}.csv`,
  content:
    BYTE_ORDER_MARK +
    [
      CUSTOMER_COLUMNS.join(','),
      ...customers.map((customer) =>
        CUSTOMER_COLUMNS.map((column) => cellOf(customer[column])).join(','),
      ),
    ]
      .map((line) => line + LINE_END)
      .join(''),
})

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
export const customerDataExportOf = (
  id: CustomerId,
  data: CustomerData,
  exportedAt: string,
): Result<ApiCustomerDataExportResponse, DomainError> => {
  const customer = CustomerReadMapper.toApiCustomer(data.customer)
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

/**
 * Everything held of a customer as a JSON file, named by the customer and
 * indented to be read by a person.
 */
export const customerDataFileOf = (
  data: ApiCustomerDataExportResponse,
): CustomerFile => ({
  fileName: `customer-${data.customer.id}.json`,
  content: JSON.stringify(data, null, 2),
})
