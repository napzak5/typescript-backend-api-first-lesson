import { match, P } from 'ts-pattern'
import type {
  ApiCustomerDataExportResponse,
  ApiCustomerResponse,
} from '../../../models/customer'

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
