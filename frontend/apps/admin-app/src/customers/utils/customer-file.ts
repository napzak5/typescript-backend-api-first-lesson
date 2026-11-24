import {
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsCustomerBasicPreferences,
  type ModelsCustomerCreateRequest,
  type ModelsCustomerResponse,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import {
  EARLIEST_DAY,
  GENDERS,
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
  SERVICE_CATEGORIES,
} from '@beauty-salon-frontend/fields'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { customerMessages as record } from '@beauty-salon-shared/i18n/messages/ui'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import {
  CANNOT_HANDLE_CUSTOMERS_MESSAGE,
  readCustomerEntry,
} from './customer-form'
import {
  CUSTOMER_STATUSES,
  HAIR_THICKNESSES,
  HAIR_TYPES,
  SCALP_CONDITIONS,
  TIERS,
} from './customer-format'

/*
 * A file of customers to register: CSV, as the ledger exports it. The
 * first row names the columns by the properties of a registration; every
 * other row is a customer.
 */

/** Who are registered at once at most: the API takes 100 */
export const MOST_REGISTERED = 100

type Entry = ModelsCustomerCreateRequest

type Column = keyof Entry

const { file: words, form, items } = adminCustomerMessages
const { how, problems: wrong, registration } = words

/** A column a file may have: its name, what it holds and how it is written */
export type ColumnGuide = {
  column: Column
  label: LocalizedText
  how: LocalizedText
}

/** The columns a file may have: every property of a registration, in the order of the export */
const GUIDES: { [Name in Column]: ColumnGuide & { column: Name } } = {
  firstName: {
    column: 'firstName',
    label: record.firstName,
    how: how.required,
  },
  lastName: { column: 'lastName', label: record.lastName, how: how.required },
  firstNameKana: {
    column: 'firstNameKana',
    label: record.firstNameKana,
    how: how.asTheForm,
  },
  lastNameKana: {
    column: 'lastNameKana',
    label: record.lastNameKana,
    how: how.asTheForm,
  },
  email: { column: 'email', label: record.email, how: how.email },
  phoneNumber: {
    column: 'phoneNumber',
    label: record.phoneNumber,
    how: how.phoneNumber,
  },
  alternativePhone: {
    column: 'alternativePhone',
    label: record.alternativePhone,
    how: how.asTheForm,
  },
  postalCode: {
    column: 'postalCode',
    label: record.postalCode,
    how: how.asTheForm,
  },
  prefecture: {
    column: 'prefecture',
    label: record.prefecture,
    how: how.asTheForm,
  },
  city: { column: 'city', label: record.city, how: how.asTheForm },
  address: { column: 'address', label: record.address, how: how.asTheForm },
  building: { column: 'building', label: record.building, how: how.asTheForm },
  birthDate: {
    column: 'birthDate',
    label: record.birthDate,
    how: how.birthDate,
  },
  gender: {
    column: 'gender',
    label: record.gender,
    how: how.oneOrNone(GENDERS),
  },
  occupation: {
    column: 'occupation',
    label: record.occupation,
    how: how.asTheForm,
  },
  membershipTier: {
    column: 'membershipTier',
    label: record.membershipTier,
    how: how.oneOrElse(TIERS, 'regular'),
  },
  preferences: {
    column: 'preferences',
    label: form.parts.likes,
    how: how.preferences,
  },
  notes: { column: 'notes', label: form.notes, how: how.asTheForm },
  internalNotes: {
    column: 'internalNotes',
    label: form.internalNotes,
    how: how.asTheForm,
  },
  tags: { column: 'tags', label: form.tags, how: how.tags },
  referredBy: {
    column: 'referredBy',
    label: items.referredBy,
    how: how.referredBy,
  },
  referralCode: {
    column: 'referralCode',
    label: record.referralCode,
    how: how.referralCode,
  },
  allowMarketing: {
    column: 'allowMarketing',
    label: record.marketing,
    how: how.switched('false'),
  },
  allowSms: {
    column: 'allowSms',
    label: record.bySms,
    how: how.switched('false'),
  },
  allowEmail: {
    column: 'allowEmail',
    label: record.byEmail,
    how: how.switched('false'),
  },
  isActive: {
    column: 'isActive',
    label: form.active,
    how: how.switched('true'),
  },
  hairType: {
    column: 'hairType',
    label: record.hairType,
    how: how.oneOrNone(HAIR_TYPES),
  },
  hairThickness: {
    column: 'hairThickness',
    label: record.hairThickness,
    how: how.oneOrNone(HAIR_THICKNESSES),
  },
  scalpCondition: {
    column: 'scalpCondition',
    label: record.scalpCondition,
    how: how.oneOrNone(SCALP_CONDITIONS),
  },
  customerStatus: {
    column: 'customerStatus',
    label: form.status,
    how: how.oneOrElse(CUSTOMER_STATUSES, 'active'),
  },
}

/** Every column a file may have, in the order of the export */
export const COLUMN_GUIDES: readonly ColumnGuide[] = Object.values(GUIDES)

/** The columns the export writes and a registration does not take: they are passed over */
const EXPORTED_ONLY: {
  [Name in Exclude<keyof ModelsCustomerResponse, Column>]: Name
} = {
  id: 'id',
  userId: 'userId',
  loyaltyPoints: 'loyaltyPoints',
  firstVisitDate: 'firstVisitDate',
  lastVisitDate: 'lastVisitDate',
  visitCount: 'visitCount',
  noShowCount: 'noShowCount',
  cancellationCount: 'cancellationCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

const PASSED_OVER: readonly string[] = Object.values(EXPORTED_ONLY)

/** The columns every file has */
const NEEDED: readonly Column[] = [
  'lastName',
  'firstName',
  'email',
  'phoneNumber',
]

/** What a column that is not in the file holds: what the form of a registration starts with */
const UNWRITTEN: readonly [Column, string][] = [
  ['membershipTier', 'regular'],
  ['customerStatus', 'active'],
  ['isActive', 'true'],
]

/** The columns whose values are those of an enum, with the values */
const CHOICES: Partial<Record<Column, readonly string[]>> = {
  gender: GENDERS,
  membershipTier: TIERS,
  customerStatus: CUSTOMER_STATUSES,
  hairType: HAIR_TYPES,
  hairThickness: HAIR_THICKNESSES,
  scalpCondition: SCALP_CONDITIONS,
}

/** The columns that are so or not so */
const SWITCHES: readonly Column[] = [
  'allowMarketing',
  'allowSms',
  'allowEmail',
  'isActive',
]

const guideOf = (name: string): ColumnGuide | undefined =>
  COLUMN_GUIDES.find(({ column }) => column === name)

const labelOf = (column: Column): LocalizedText => GUIDES[column].label

/**
 * The text of a file: UTF-8, with or without the mark of its byte order,
 * or Shift_JIS, as spreadsheets in Japan save CSV. Bytes that are no
 * UTF-8 turn into the character that replaces what cannot be read.
 */
export const textOfFile = (bytes: ArrayBuffer): string => {
  const unicode = new TextDecoder('utf-8').decode(bytes)

  return unicode.includes('�')
    ? new TextDecoder('shift_jis').decode(bytes)
    : unicode
}

/** The rows of a CSV text, or the row a quoted value begins in and does not end */
export type CsvRead =
  | { type: 'rows'; rows: string[][] }
  | { type: 'unclosed'; row: number }

/**
 * The rows of a CSV text (RFC 4180), each with its values: a value in
 * double quotes holds commas, line ends and doubled double quotes; a line
 * ends with CRLF, LF or CR. An empty line is a row of one empty value, so
 * that the rows keep the numbers a spreadsheet gives them.
 */
export const rowsOfCsv = (text: string): CsvRead => {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false
  let index = 0
  const endRow = (): void => {
    row.push(value)
    rows.push(row)
    row = []
    value = ''
  }
  while (index < text.length) {
    const character = text.charAt(index)
    const next = text.charAt(index + 1)
    if (quoted && character === '"' && next === '"') {
      value += '"'
      index += 1
    } else if (quoted && character === '"') {
      quoted = false
    } else if (quoted) {
      value += character
    } else if (character === '"' && value === '') {
      quoted = true
    } else if (character === ',') {
      row.push(value)
      value = ''
    } else if (character === '\r' && next === '\n') {
      endRow()
      index += 1
    } else if (character === '\n' || character === '\r') {
      endRow()
    } else {
      value += character
    }
    index += 1
  }
  if (quoted) {
    return { type: 'unclosed', row: rows.length + 1 }
  }
  if (value !== '' || row.length > 0) {
    endRow()
  }

  return { type: 'rows', rows }
}

/** What is wrong with a file */
export type FileProblem = {
  /** The row, as a spreadsheet numbers it (the names of the columns are row 1); `null` for the whole file */
  row: number | null
  /** The label of the column; `null` for the whole row or file */
  column: LocalizedText | null
  message: LocalizedText
}

/** A customer of a file, with the row they are written on */
export type FileCustomer = {
  row: number
  request: Entry
}

export type CustomerFileRead =
  | { type: 'read'; customers: FileCustomer[] }
  | { type: 'invalid'; problems: FileProblem[] }

/** How a problem is said: 「3 行目 メールアドレス: …」. */
export const problemTextOf = ({
  row,
  column,
  message,
}: FileProblem): LocalizedText => words.problemOf(row, column, message)

const invalid = (problems: FileProblem[]): CustomerFileRead => ({
  type: 'invalid',
  problems,
})

const ofFile = (message: LocalizedText): FileProblem => ({
  row: null,
  column: null,
  message,
})

/** The export puts a quote before a value that a spreadsheet would run as a formula */
const QUOTED_FORMULA = /^'[=+\-@\t\r]/

const cellValueOf = (cell: string): string =>
  QUOTED_FORMULA.test(cell) ? cell.slice(1) : cell

const NOT_JSON = Symbol('not JSON')

/** The value a JSON text holds, read without an exception: what is no JSON is `NOT_JSON`. */
const jsonOf = (text: string): Promise<unknown> =>
  new Response(text).json().catch(() => NOT_JSON)

/** A cell of the preferences: the JSON the ledger exports them as */
const preferencesSchema = z.object({
  preferredServices: z.array(z.enum(ModelsServiceCategoryType)),
  notes: z.nullable(z.string()),
}) satisfies z.ZodMiniType<ModelsCustomerBasicPreferences>

/** A cell of the tags, where it is the JSON the ledger exports them as */
const tagsSchema = z.array(z.string()) satisfies z.ZodMiniType<
  ModelsCustomerCreateRequest['tags']
>

const PREFERENCES_MALFORMED = wrong.preferences(SERVICE_CATEGORIES)

const TAGS_MALFORMED = wrong.tags

/** What is said of a value the form of a registration does not take, in a file */
const fileMessageOf = (
  column: Column,
  message: LocalizedText,
): LocalizedText => {
  const choices = CHOICES[column]

  return choices === undefined
    ? message
    : wrong.choice(labelOf(column), choices)
}

/** The names of the columns, or what is wrong with them */
const columnsOf = (
  names: readonly string[],
): { type: 'columns'; columns: (Column | undefined)[] } | CustomerFileRead => {
  const problems: FileProblem[] = []
  const columns = names.map((written, index): Column | undefined => {
    const name = written.trim()
    const guide = guideOf(name)
    if (guide !== undefined) {
      if (names.slice(0, index).some((other) => other.trim() === name)) {
        problems.push({
          row: 1,
          column: null,
          message: wrong.twice(name),
        })
      }
      return guide.column
    }
    if (name === '') {
      problems.push({
        row: 1,
        column: null,
        message: wrong.unnamed(index + 1),
      })
    } else if (!PASSED_OVER.includes(name)) {
      problems.push({
        row: 1,
        column: null,
        message: wrong.unknown(name),
      })
    }
    return undefined
  })
  const missing = NEEDED.filter((needed) => !columns.includes(needed))
  for (const column of missing) {
    problems.push({
      row: 1,
      column: null,
      message: wrong.missing(column, labelOf(column)),
    })
  }

  return problems.length === 0
    ? { type: 'columns', columns }
    : invalid(problems)
}

/**
 * A row of the file as the form of a registration holds it, and what is
 * wrong with the values the form does not read itself: a value that is so
 * or not so, and those in JSON. Such a value is left out of the form.
 */
const valuesOf = async (
  columns: readonly (Column | undefined)[],
  cells: readonly string[],
  row: number,
): Promise<{ values: FormData; problems: FileProblem[] }> => {
  const values = new FormData()
  const problems: FileProblem[] = []
  for (const [column, fallback] of UNWRITTEN) {
    if (!columns.includes(column)) {
      values.set(column, fallback)
    }
  }
  // A row has as many cells as the file has columns
  for (const [index, cell] of cells.entries()) {
    const column = columns[index]
    const value = cellValueOf(cell)
    const text = value.trim()
    if (column === undefined) {
      continue
    }
    if (SWITCHES.includes(column)) {
      if (text === 'true') {
        values.set(column, 'on')
      } else if (text !== 'false') {
        problems.push({
          row,
          column: labelOf(column),
          message: wrong.switched(labelOf(column)),
        })
      }
      continue
    }
    if (column === 'preferences') {
      const preferences =
        text === ''
          ? undefined
          : preferencesSchema.safeParse(await jsonOf(text))
      if (preferences?.success === false) {
        problems.push({
          row,
          column: labelOf(column),
          message: PREFERENCES_MALFORMED,
        })
      } else if (preferences !== undefined) {
        for (const service of preferences.data.preferredServices) {
          values.append(PREFERRED_SERVICES, service)
        }
        values.set(PREFERENCE_NOTES, preferences.data.notes ?? '')
      }
      continue
    }
    if (column === 'tags' && text.startsWith('[')) {
      const tags = tagsSchema.safeParse(await jsonOf(text))
      if (tags.success) {
        values.set(column, tags.data.join(','))
      } else {
        problems.push({ row, column: labelOf(column), message: TAGS_MALFORMED })
      }
      continue
    }
    values.set(column, value)
  }

  return { values, problems }
}

const isBlank = (cells: readonly string[]): boolean =>
  cells.every((cell) => cell.trim() === '')

/**
 * The customers of a CSV text, each read as the form of a registration
 * reads one, or everything that is wrong with the file: its columns, the
 * number of customers, and every value of every row. Today, at the salon,
 * is the last day somebody can have been born on. An address of mail or a
 * referral code that an earlier row has is wrong on the later row.
 */
export const readCustomerFile = async (
  text: string,
  today: string,
): Promise<CustomerFileRead> => {
  const csv = rowsOfCsv(text)
  if (csv.type === 'unclosed') {
    return invalid([
      {
        row: csv.row,
        column: null,
        message: wrong.unclosed,
      },
    ])
  }
  const [names, ...rest] = csv.rows
  if (names === undefined || isBlank(names)) {
    return invalid([ofFile(wrong.empty)])
  }
  const columns = columnsOf(names)
  if (columns.type !== 'columns') {
    return columns
  }
  const rows = rest
    .map((cells, index) => ({ cells, row: index + 2 }))
    .filter(({ cells }) => !isBlank(cells))
  if (rows.length === 0) {
    return invalid([ofFile(wrong.noCustomers)])
  }
  if (rows.length > MOST_REGISTERED) {
    return invalid([ofFile(wrong.tooMany(rows.length, MOST_REGISTERED))])
  }
  const problems: FileProblem[] = []
  const customers: FileCustomer[] = []
  for (const { cells, row } of rows) {
    if (cells.length !== names.length) {
      problems.push({
        row,
        column: null,
        message: wrong.cells(cells.length, names.length),
      })
      continue
    }
    const { values, problems: unread } = await valuesOf(
      columns.columns,
      cells,
      row,
    )
    problems.push(...unread)
    const entry = readCustomerEntry(values, today)
    if (entry.type === 'invalid') {
      // The form says what is wrong under the names of the columns
      for (const { column } of COLUMN_GUIDES) {
        const message = entry.errors[column]
        if (message !== undefined) {
          problems.push({
            row,
            column: labelOf(column),
            message: fileMessageOf(column, message),
          })
        }
      }
      continue
    }
    if (unread.length > 0) {
      continue
    }
    const { email, referralCode } = entry.value
    const sameEmail = customers.find(
      ({ request }) => request.email.toLowerCase() === email.toLowerCase(),
    )
    const sameCode = customers.find(
      ({ request }) =>
        referralCode !== null && request.referralCode === referralCode,
    )
    if (sameEmail !== undefined) {
      problems.push({
        row,
        column: labelOf('email'),
        message: wrong.sameEmailAs(sameEmail.row),
      })
    }
    if (sameCode !== undefined) {
      problems.push({
        row,
        column: labelOf('referralCode'),
        message: wrong.sameCodeAs(sameCode.row),
      })
    }
    customers.push({ row, request: entry.value })
  }

  return problems.length === 0 ? { type: 'read', customers } : invalid(problems)
}

/** What came of registering the customers of a file */
export type RegistrationAttempt =
  | { type: 'registered'; count: number }
  | { type: 'invalid'; values: RefusedValue[] }
  /** An address of mail or a referral code is another customer's: the API names the value */
  | { type: 'conflict'; detail: string }
  /** The file is larger than the API takes in one request */
  | { type: 'tooLarge' }
  | { type: 'forbidden' }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What the screen says after a registration */
export type RegistrationSays =
  | { type: 'done'; message: LocalizedText }
  | {
      type: 'again'
      message: LocalizedText | undefined
      problems: FileProblem[]
    }

/** `items.3.email` → the customer at 3, and the column of `email`; `items.0.tags.1` → the column of the tags */
const refusedAt = (
  field: string,
): { index: number; column: Column | undefined } | undefined => {
  const [items, index, name] = field.split('.')
  return items === 'items' && index !== undefined && /^\d+$/.test(index)
    ? { index: Number(index), column: guideOf(name ?? '')?.column }
    : undefined
}

const refusedMessageOf = (
  column: Column | undefined,
  rule: string,
): LocalizedText =>
  match([column, rule])
    .returnType<LocalizedText>()
    .with(['referredBy', 'not_found'], () => registration.referrerNotFound)
    .with(['birthDate', P.string], () => registration.birthDate(EARLIEST_DAY))
    .otherwise(() => registration.refusedValue)

/** What the screen says after the API answered a registration of the customers of a file. */
export const afterRegistration = (
  attempt: RegistrationAttempt,
  customers: readonly FileCustomer[],
): RegistrationSays =>
  match(attempt)
    .returnType<RegistrationSays>()
    .with({ type: 'registered' }, ({ count }) => ({
      type: 'done',
      message: registration.registered(count),
    }))
    .with({ type: 'invalid' }, ({ values }) => {
      const problems = values.flatMap(({ field, rule }): FileProblem[] => {
        const at = refusedAt(field)
        const customer = at === undefined ? undefined : customers[at.index]
        return at === undefined || customer === undefined
          ? []
          : [
              {
                row: customer.row,
                column: at.column === undefined ? null : labelOf(at.column),
                message: refusedMessageOf(at.column, rule),
              },
            ]
      })
      return {
        type: 'again',
        message: problems.length === 0 ? registration.checkTheFile : undefined,
        problems,
      }
    })
    .with({ type: 'conflict' }, ({ detail }) => {
      // The value stands between spaces: one that holds another is not it
      const said = ` ${detail.toLowerCase()} `
      const sameEmail = customers.find(({ request }) =>
        said.includes(` ${request.email.toLowerCase()} `),
      )
      const sameCode = customers.find(
        ({ request }) =>
          request.referralCode !== null &&
          ` ${detail} `.includes(` ${request.referralCode} `),
      )
      return match([sameEmail, sameCode])
        .returnType<RegistrationSays>()
        .with([P.nonNullable, P._], ([{ row }]) => ({
          type: 'again',
          message: undefined,
          problems: [
            {
              row,
              column: labelOf('email'),
              message: registration.emailTaken,
            },
          ],
        }))
        .with([undefined, P.nonNullable], ([, { row }]) => ({
          type: 'again',
          message: undefined,
          problems: [
            {
              row,
              column: labelOf('referralCode'),
              message: registration.referralCodeTaken,
            },
          ],
        }))
        .otherwise(() => ({
          type: 'again',
          message: registration.overlap,
          problems: [],
        }))
    })
    .with({ type: 'tooLarge' }, () => ({
      type: 'again',
      message: registration.tooLarge,
      problems: [],
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: CANNOT_HANDLE_CUSTOMERS_MESSAGE,
      problems: [],
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
      problems: [],
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: registration.failed,
      problems: [],
    }))
    .exhaustive()
