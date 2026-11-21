import {
  type ModelsCustomerBasicPreferences,
  type ModelsCustomerCreateRequest,
  type ModelsCustomerResponse,
  ModelsServiceCategoryType,
} from '@beauty-salon-frontend/api-client'
import type { RefusedValue } from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { TOO_MANY_REQUESTS } from '../bookings/booking-entry'
import {
  CANNOT_HANDLE_CUSTOMERS,
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
  readCustomerEntry,
} from './customer-form'
import {
  CATEGORIES,
  CUSTOMER_STATUSES,
  GENDERS,
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

/** A column a file may have: its name, what it holds and how it is written */
export type ColumnGuide = {
  column: Column
  label: string
  how: string
}

const AS_THE_FORM = '登録の画面と同じ。空なら、なし'

const SWITCHED_OFF = 'true か false。列がなければ false'

const oneOf = (values: readonly string[]): string =>
  `${values.join('、')} のどれか`

/** The columns a file may have: every property of a registration, in the order of the export */
const GUIDES: { [Name in Column]: ColumnGuide & { column: Name } } = {
  firstName: { column: 'firstName', label: '名', how: '必ず書く' },
  lastName: { column: 'lastName', label: '姓', how: '必ず書く' },
  firstNameKana: {
    column: 'firstNameKana',
    label: '名（フリガナ）',
    how: AS_THE_FORM,
  },
  lastNameKana: {
    column: 'lastNameKana',
    label: '姓（フリガナ）',
    how: AS_THE_FORM,
  },
  email: {
    column: 'email',
    label: 'メールアドレス',
    how: '必ず書く。ファイルの中でも台帳でも、ほかのお客様と重ならないもの',
  },
  phoneNumber: {
    column: 'phoneNumber',
    label: '電話番号',
    how: '必ず書く。市外局番から',
  },
  alternativePhone: {
    column: 'alternativePhone',
    label: '予備の電話番号',
    how: AS_THE_FORM,
  },
  postalCode: { column: 'postalCode', label: '郵便番号', how: AS_THE_FORM },
  prefecture: { column: 'prefecture', label: '都道府県', how: AS_THE_FORM },
  city: { column: 'city', label: '市区町村', how: AS_THE_FORM },
  address: { column: 'address', label: '番地', how: AS_THE_FORM },
  building: {
    column: 'building',
    label: '建物名・部屋番号',
    how: AS_THE_FORM,
  },
  birthDate: {
    column: 'birthDate',
    label: '生年月日',
    how: '2001-04-01 の形。空なら、なし',
  },
  gender: {
    column: 'gender',
    label: '性別',
    how: `${oneOf(GENDERS)}。空なら、なし`,
  },
  occupation: { column: 'occupation', label: '職業', how: AS_THE_FORM },
  membershipTier: {
    column: 'membershipTier',
    label: '会員ランク',
    how: `${oneOf(TIERS)}。列がなければ regular`,
  },
  preferences: {
    column: 'preferences',
    label: '好み',
    how: '台帳の出力と同じ JSON（{"preferredServices":["cut"],"notes":null}）。空なら、なし',
  },
  notes: { column: 'notes', label: '備考', how: AS_THE_FORM },
  internalNotes: {
    column: 'internalNotes',
    label: 'スタッフ間の申し送り',
    how: AS_THE_FORM,
  },
  tags: {
    column: 'tags',
    label: 'タグ',
    how: '「、」かカンマで区切るか、台帳の出力と同じ JSON の配列。空なら、なし',
  },
  referredBy: {
    column: 'referredBy',
    label: '紹介元',
    how: '台帳のお客様の ID（台帳の出力の id）。空なら、なし',
  },
  referralCode: {
    column: 'referralCode',
    label: '紹介コード',
    how: `${AS_THE_FORM}。ほかのお客様と重ならないもの`,
  },
  allowMarketing: {
    column: 'allowMarketing',
    label: 'キャンペーンなどのお知らせ',
    how: SWITCHED_OFF,
  },
  allowSms: { column: 'allowSms', label: 'SMS での連絡', how: SWITCHED_OFF },
  allowEmail: {
    column: 'allowEmail',
    label: 'メールでの連絡',
    how: SWITCHED_OFF,
  },
  isActive: {
    column: 'isActive',
    label: '有効なお客様',
    how: 'true か false。列がなければ true',
  },
  hairType: {
    column: 'hairType',
    label: '髪質',
    how: `${oneOf(HAIR_TYPES)}。空なら、なし`,
  },
  hairThickness: {
    column: 'hairThickness',
    label: '髪の太さ',
    how: `${oneOf(HAIR_THICKNESSES)}。空なら、なし`,
  },
  scalpCondition: {
    column: 'scalpCondition',
    label: '頭皮の状態',
    how: `${oneOf(SCALP_CONDITIONS)}。空なら、なし`,
  },
  customerStatus: {
    column: 'customerStatus',
    label: 'ステータス',
    how: `${oneOf(CUSTOMER_STATUSES)}。列がなければ active`,
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

const labelOf = (column: Column): string => GUIDES[column].label

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
  column: string | null
  message: string
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
export const problemTextOf = ({ row, column, message }: FileProblem): string =>
  match([row, column])
    .returnType<string>()
    .with(
      [P.number, P.string],
      ([at, label]) => `${at} 行目 ${label}: ${message}`,
    )
    .with([P.number, null], ([at]) => `${at} 行目: ${message}`)
    .otherwise(() => message)

const invalid = (problems: FileProblem[]): CustomerFileRead => ({
  type: 'invalid',
  problems,
})

const ofFile = (message: string): FileProblem => ({
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

const PREFERENCES_MALFORMED = `好みは、台帳の出力と同じ JSON（{"preferredServices":["cut"],"notes":null}）で書くか、空にしてください。preferredServices は、${oneOf(CATEGORIES)}です。`

const TAGS_MALFORMED =
  'タグは、「、」かカンマで区切るか、台帳の出力と同じ JSON の文字列の配列で書いてください。'

/** The column a control of the form of a registration belongs to */
const columnOfControl = (control: string): Column | undefined =>
  match(control)
    .returnType<Column | undefined>()
    .with(PREFERRED_SERVICES, PREFERENCE_NOTES, () => 'preferences')
    .otherwise((name) => guideOf(name)?.column)

/** What is said of a value the form of a registration does not take, in a file */
const fileMessageOf = (column: Column, message: string): string => {
  const choices = CHOICES[column]

  return choices === undefined
    ? message
    : `${labelOf(column)}は、${oneOf(choices)}で書いてください。`
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
          message: `列「${name}」が 2 つあります。`,
        })
      }
      return guide.column
    }
    if (name === '') {
      problems.push({
        row: 1,
        column: null,
        message: `${index + 1} 列目に、列名がありません。`,
      })
    } else if (!PASSED_OVER.includes(name)) {
      problems.push({
        row: 1,
        column: null,
        message: `列「${name}」は、台帳の項目ではありません。列名は、下の表の名前で書いてください。`,
      })
    }
    return undefined
  })
  const missing = NEEDED.filter((needed) => !columns.includes(needed))
  for (const column of missing) {
    problems.push({
      row: 1,
      column: null,
      message: `列「${column}」（${labelOf(column)}）がありません。`,
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
  for (const [index, column] of columns.entries()) {
    const value = cellValueOf(cells[index] ?? '')
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
          message: `${labelOf(column)}は、true か false で書いてください。`,
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
        message:
          'ダブルクォートで始まった値が、ファイルの終わりまで閉じられていません。',
      },
    ])
  }
  const [names, ...rest] = csv.rows
  if (names === undefined || isBlank(names)) {
    return invalid([
      ofFile(
        'ファイルが空です。1 行目に列名を、2 行目から 1 行に 1 人ずつ、お客様を書いてください。',
      ),
    ])
  }
  const columns = columnsOf(names)
  if (columns.type !== 'columns') {
    return columns
  }
  const rows = rest
    .map((cells, index) => ({ cells, row: index + 2 }))
    .filter(({ cells }) => !isBlank(cells))
  if (rows.length === 0) {
    return invalid([
      ofFile(
        'ファイルに、登録するお客様がいません。2 行目から、1 行に 1 人ずつ書いてください。',
      ),
    ])
  }
  if (rows.length > MOST_REGISTERED) {
    return invalid([
      ofFile(
        `ファイルには ${rows.length} 人います。一度に登録できるのは ${MOST_REGISTERED} 人までです。ファイルを分けてください。`,
      ),
    ])
  }
  const problems: FileProblem[] = []
  const customers: FileCustomer[] = []
  for (const { cells, row } of rows) {
    if (cells.length !== names.length) {
      problems.push({
        row,
        column: null,
        message: `値が ${cells.length} 個あり、列の数（${names.length}）と合いません。`,
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
      for (const [control, message] of Object.entries(entry.errors)) {
        const column = columnOfControl(control)
        problems.push({
          row,
          column: column === undefined ? null : labelOf(column),
          message:
            column === undefined ? message : fileMessageOf(column, message),
        })
      }
      continue
    }
    if (unread.length > 0) {
      continue
    }
    const { email, referralCode } = entry.request
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
        message: `${sameEmail.row} 行目と同じメールアドレスです。`,
      })
    }
    if (sameCode !== undefined) {
      problems.push({
        row,
        column: labelOf('referralCode'),
        message: `${sameCode.row} 行目と同じ紹介コードです。`,
      })
    }
    customers.push({ row, request: entry.request })
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
  | { type: 'done'; message: string }
  | { type: 'again'; message: string | undefined; problems: FileProblem[] }

/** `items.3.email` → the customer at 3, and the column of `email`; `items.0.tags.1` → the column of the tags */
const refusedAt = (
  field: string,
): { index: number; column: Column | undefined } | undefined => {
  const [items, index, name] = field.split('.')
  return items === 'items' && index !== undefined && /^\d+$/.test(index)
    ? { index: Number(index), column: guideOf(name ?? '')?.column }
    : undefined
}

const refusedMessageOf = (column: Column | undefined, rule: string): string =>
  match([column, rule])
    .returnType<string>()
    .with(
      ['referredBy', 'not_found'],
      () =>
        '台帳にいないお客様の ID です。台帳の出力の id を書くか、空にしてください。',
    )
    .with(
      ['birthDate', P.string],
      () => '生年月日は、1900-01-01 から今日までの日付を書いてください。',
    )
    .otherwise(
      () => 'この値は受け付けられませんでした。書き方を確かめてください。',
    )

const FAILED_REGISTRATION =
  'お客様を登録できませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What the screen says after the API answered a registration of the customers of a file. */
export const afterRegistration = (
  attempt: RegistrationAttempt,
  customers: readonly FileCustomer[],
): RegistrationSays =>
  match(attempt)
    .returnType<RegistrationSays>()
    .with({ type: 'registered' }, ({ count }) => ({
      type: 'done',
      message: `${count} 人を台帳に登録しました。`,
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
        message:
          problems.length === 0
            ? 'ファイルの内容を確かめて、もう一度お試しください。'
            : undefined,
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
              message:
                'このメールアドレスのお客様が、もう台帳にいます。台帳で探して、このお客様の行を外してください。',
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
              message:
                'この紹介コードは、ほかのお客様が使っています（台帳から削除したお客様も含みます）。別のコードを書いてください。',
            },
          ],
        }))
        .otherwise(() => ({
          type: 'again',
          message:
            '台帳のお客様と、メールアドレスか紹介コードが重なっています。ファイルを確かめてください。',
          problems: [],
        }))
    })
    .with({ type: 'tooLarge' }, () => ({
      type: 'again',
      message:
        'ファイルが大きすぎて、一度に送れません。ファイルを分けて、登録してください。',
      problems: [],
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'again',
      message: CANNOT_HANDLE_CUSTOMERS.message,
      problems: [],
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS.message,
      problems: [],
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: FAILED_REGISTRATION,
      problems: [],
    }))
    .exhaustive()
