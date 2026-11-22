import {
  CHECK_THE_VALUES_MESSAGE,
  type Forbidden,
  type NotFound,
  REFUSED_VALUE_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
  type Unread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsStaffCreateRequest,
  ModelsStaffResponse,
  ModelsStaffUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { isDay } from '@beauty-salon-frontend/salon-screens'
import {
  aboutTheAttempt,
  type FormRead,
  type FormSays,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { yenOf } from '../bookings/booking-entry'
import {
  emailError,
  isPhoneNumber,
  nameError,
  PHONE_MALFORMED,
  phoneError,
  tooLong,
} from '../customers/customer-form'
import { numberOf } from '../treatments/treatment-form'
import {
  controlOf,
  introductionChangesOf,
  optionalNumberUpTo,
  readIntroduction,
  URL_ERROR,
} from './introduction'
import { LEVELS } from './staff-format'

/*
 * The form of a member of the staff ledger: what it sends to register one
 * and to change one, and what it says about the answers. A control is
 * named as the property of the request is.
 */

type Whole = ModelsStaffCreateRequest

const LONGEST_DISPLAY_NAME = 255
const MOST_RATE = 100
const MOST_CONCURRENT = 10
const MOST_BUFFER = 120

/** The lengths of the texts that may be left empty, under the names of their controls */
const LONGEST: Record<string, number> = {
  lastNameKana: 100,
  firstNameKana: 100,
  staffCode: 50,
  position: 100,
  employmentType: 50,
}

const HIRE_DATE_OUT_OF_RANGE =
  '入社日は、1900 年 1 月 1 日から 2999 年 12 月 31 日までの日付を入力してください。'

const SALARY_ERROR = '基本給は、0 以上の円の整数で入力してください。'

const RATE_ERROR = `歩合率は、0 から ${MOST_RATE} までの数で、小数第 2 位まで入力してください。`

const CONCURRENT_ERROR = `同時に担当できる予約の数は、1 から ${MOST_CONCURRENT} までの整数で入力してください。`

const BUFFER_ERROR = `0 から ${MOST_BUFFER} までの分を、整数で入力してください。`

/** What is said at the control of being active, of the member the account is linked to */
export const OWN_RECORD_STAYS_ACTIVE =
  'ご自身のスタッフ情報は、無効にできません。無効にすると、このアカウントでサロンの画面を使えなくなります。'

/** A whole number from `least` to `most`; `undefined` for anything else, nothing included. */
const wholeNumberIn = (
  text: string,
  least: number,
  most: number,
): number | undefined => {
  const number = numberOf(text, 0)

  return number !== null &&
    number !== undefined &&
    number >= least &&
    number <= most
    ? number
    : undefined
}

/**
 * Everything the form holds, as the API takes a member: a control that was
 * left empty is `null` where the API allows that.
 */
const readWhole = (values: FormData): FormRead<Whole> => {
  const text = (name: string): string => textOf(values, name).trim()
  const optional = (name: string): string | null => textOrNull(text(name))
  const lastName = text('lastName')
  const firstName = text('firstName')
  const displayName = text('displayName')
  const email = text('email')
  const phoneNumber = text('phoneNumber')
  const alternativePhone = optional('alternativePhone')
  const level = LEVELS.find((one) => one === text('level'))
  const hireDate = optional('hireDate')
  const baseSalary = yenOf(text('baseSalary'))
  const commissionRate = optionalNumberUpTo(
    text('commissionRate'),
    2,
    MOST_RATE,
  )
  const introduction = readIntroduction(values)
  const maxConcurrentBookings = wholeNumberIn(
    text('maxConcurrentBookings'),
    1,
    MOST_CONCURRENT,
  )
  const bufferTimeBefore = wholeNumberIn(
    text('bufferTimeBefore'),
    0,
    MOST_BUFFER,
  )
  const bufferTimeAfter = wholeNumberIn(text('bufferTimeAfter'), 0, MOST_BUFFER)
  const found: Record<string, string | undefined> = {
    lastName: nameError(lastName, '姓を入力してください。'),
    firstName: nameError(firstName, '名を入力してください。'),
    displayName: match(displayName.length)
      .with(0, () => '表示名を入力してください。')
      .when(
        (length) => length > LONGEST_DISPLAY_NAME,
        () => tooLong(LONGEST_DISPLAY_NAME),
      )
      .otherwise(() => undefined),
    email: emailError(email),
    phoneNumber: phoneError(phoneNumber),
    alternativePhone:
      alternativePhone === null || isPhoneNumber(alternativePhone)
        ? undefined
        : PHONE_MALFORMED,
    level: level === undefined ? 'レベルを選んでください。' : undefined,
    hireDate:
      hireDate === null || isDay(hireDate) ? undefined : HIRE_DATE_OUT_OF_RANGE,
    baseSalary: baseSalary === undefined ? SALARY_ERROR : undefined,
    commissionRate: commissionRate === undefined ? RATE_ERROR : undefined,
    maxConcurrentBookings:
      maxConcurrentBookings === undefined ? CONCURRENT_ERROR : undefined,
    bufferTimeBefore: bufferTimeBefore === undefined ? BUFFER_ERROR : undefined,
    bufferTimeAfter: bufferTimeAfter === undefined ? BUFFER_ERROR : undefined,
    ...Object.fromEntries(
      Object.entries(LONGEST).map(
        ([name, most]): [string, string | undefined] => [
          name,
          (optional(name) ?? '').length > most ? tooLong(most) : undefined,
        ],
      ),
    ),
  }
  const errors = {
    ...Object.fromEntries(
      Object.entries(found).flatMap(([name, error]): [string, string][] =>
        error === undefined ? [] : [[name, error]],
      ),
    ),
    ...(introduction.type === 'invalid' ? introduction.errors : {}),
  }
  if (
    introduction.type === 'invalid' ||
    Object.keys(errors).length > 0 ||
    level === undefined ||
    baseSalary === undefined ||
    commissionRate === undefined ||
    maxConcurrentBookings === undefined ||
    bufferTimeBefore === undefined ||
    bufferTimeAfter === undefined
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      firstName,
      lastName,
      firstNameKana: optional('firstNameKana'),
      lastNameKana: optional('lastNameKana'),
      displayName,
      email,
      phoneNumber,
      alternativePhone,
      staffCode: optional('staffCode'),
      level,
      position: optional('position'),
      ...introduction.value,
      hireDate,
      employmentType: optional('employmentType'),
      baseSalary,
      commissionRate,
      canReceiveBookings: values.has('canReceiveBookings'),
      maxConcurrentBookings,
      bufferTimeBefore,
      bufferTimeAfter,
      isActive: values.has('isActive'),
    },
  }
}

/** A new member, from the form. */
export const readStaffEntry = (values: FormData): FormRead<Whole> =>
  readWhole(values)

/**
 * The properties a form was sent with other values for than the member it
 * was opened with. A value is compared as the form reads it: without the
 * spaces around it, nothing as `null`, an address of mail in small letters
 * as the API keeps it.
 */
const changesOf = (
  sent: Whole,
  shown: ModelsStaffResponse,
): ModelsStaffUpdateRequest => ({
  ...(sent.lastName === shown.lastName.trim()
    ? {}
    : { lastName: sent.lastName }),
  ...(sent.firstName === shown.firstName.trim()
    ? {}
    : { firstName: sent.firstName }),
  ...(sent.lastNameKana === textOrNull(shown.lastNameKana)
    ? {}
    : { lastNameKana: sent.lastNameKana }),
  ...(sent.firstNameKana === textOrNull(shown.firstNameKana)
    ? {}
    : { firstNameKana: sent.firstNameKana }),
  ...(sent.displayName === shown.displayName.trim()
    ? {}
    : { displayName: sent.displayName }),
  ...(sent.email.toLowerCase() === shown.email ? {} : { email: sent.email }),
  ...(sent.phoneNumber === shown.phoneNumber.trim()
    ? {}
    : { phoneNumber: sent.phoneNumber }),
  ...(sent.alternativePhone === textOrNull(shown.alternativePhone)
    ? {}
    : { alternativePhone: sent.alternativePhone }),
  ...(sent.staffCode === textOrNull(shown.staffCode)
    ? {}
    : { staffCode: sent.staffCode }),
  ...(sent.level === shown.level ? {} : { level: sent.level }),
  ...(sent.position === textOrNull(shown.position)
    ? {}
    : { position: sent.position }),
  ...introductionChangesOf(sent, shown),
  ...(sent.hireDate === shown.hireDate ? {} : { hireDate: sent.hireDate }),
  ...(sent.employmentType === textOrNull(shown.employmentType)
    ? {}
    : { employmentType: sent.employmentType }),
  ...(sent.baseSalary === shown.baseSalary
    ? {}
    : { baseSalary: sent.baseSalary }),
  ...(sent.commissionRate === shown.commissionRate
    ? {}
    : { commissionRate: sent.commissionRate }),
  ...(sent.canReceiveBookings === shown.canReceiveBookings
    ? {}
    : { canReceiveBookings: sent.canReceiveBookings }),
  ...(sent.maxConcurrentBookings === shown.maxConcurrentBookings
    ? {}
    : { maxConcurrentBookings: sent.maxConcurrentBookings }),
  ...(sent.bufferTimeBefore === shown.bufferTimeBefore
    ? {}
    : { bufferTimeBefore: sent.bufferTimeBefore }),
  ...(sent.bufferTimeAfter === shown.bufferTimeAfter
    ? {}
    : { bufferTimeAfter: sent.bufferTimeAfter }),
  ...(sent.isActive === shown.isActive ? {} : { isActive: sent.isActive }),
})

/** What a change of a member asks for: nothing, when nothing was changed. */
export type StaffChange =
  | FormRead<ModelsStaffUpdateRequest>
  | { type: 'unchanged' }

/**
 * What was changed in the form: the properties whose values are others
 * than those of the member it was opened with, and nothing else. The API
 * leaves a property alone that a request does not name, so what somebody
 * else wrote in the meantime stays unless the same value was changed here.
 * The member the account is linked to stays active (`own`).
 */
export const readStaffChange = (
  values: FormData,
  shown: ModelsStaffResponse,
  own: boolean,
): StaffChange => {
  const read = readWhole(values)
  if (read.type === 'invalid') {
    return read
  }
  const changes = changesOf(read.value, shown)
  if (own && changes.isActive === false) {
    return { type: 'invalid', errors: { isActive: OWN_RECORD_STAYS_ACTIVE } }
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** What came of registering a member, or of changing one, after the API was asked why it refused. */
export type StaffWriteAttempt =
  | { type: 'written'; member: ModelsStaffResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** Another member has the address of mail, or the staff code */
  | { type: 'duplicate'; field: 'email' | 'staffCode' }
  /** The change would deactivate the member the account is linked to */
  | { type: 'ownRecord' }
  /** The member to change is not in the ledger: removed meanwhile */
  | NotFound
  | Forbidden
  | Unread

/** What came of registering a member: there is no member yet who could be gone, or be the account's own. */
export type StaffEntryAttempt = Exclude<
  StaffWriteAttempt,
  NotFound | { type: 'ownRecord' }
>

/** The controls of the form */
const CONTROLS: readonly string[] = [
  'lastName',
  'firstName',
  'lastNameKana',
  'firstNameKana',
  'displayName',
  'email',
  'phoneNumber',
  'alternativePhone',
  'staffCode',
  'level',
  'position',
  'employmentType',
  'hireDate',
  'baseSalary',
  'commissionRate',
  'specialties',
  'certifications',
  'yearsOfExperience',
  'bio',
  'imageUrl',
  'canReceiveBookings',
  'maxConcurrentBookings',
  'bufferTimeBefore',
  'bufferTimeAfter',
  'isActive',
]

/** What is said at a control of a value the API refused. */
const messageAt = (control: string): string =>
  match(control)
    .with('hireDate', () => HIRE_DATE_OUT_OF_RANGE)
    .with('imageUrl', () => URL_ERROR)
    .otherwise(() => REFUSED_VALUE_MESSAGE)

const DUPLICATES: Record<'email' | 'staffCode', string> = {
  email:
    'このメールアドレスのスタッフが、すでに台帳にいます。別のメールアドレスを入力してください。',
  staffCode:
    'このスタッフコードは、ほかのスタッフが使っています（台帳から削除したスタッフも含みます）。別のコードを入力してください。',
}

/** What a form of the ledger says when the API refuses the account: it does not keep the ledger of the salon. */
const CANNOT_KEEP_STAFF: FormSays = aboutTheAttempt(
  'このアカウントでは、このサロンのスタッフ台帳を扱えません。',
)

/** Which write a form makes: the words of its failure differ. */
export type StaffWrite = 'entry' | 'change'

const FAILED_WRITES: Record<StaffWrite, string> = {
  entry:
    'スタッフを登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
  change:
    'スタッフ情報を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
}

/**
 * What the form of a member says after the API did not take it. A member
 * that is gone is no failure of the form: the screen says so.
 */
export const afterStaffWrite = (
  outcome: Exclude<StaffWriteAttempt, { type: 'written' } | NotFound>,
  write: StaffWrite,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values
        .map(({ field }) => controlOf(field))
        .filter((control) => CONTROLS.includes(control))

      return {
        message: said.length === 0 ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(
          said.map((control) => [control, messageAt(control)]),
        ),
      }
    })
    .with({ type: 'duplicate' }, ({ field }) => ({
      message: undefined,
      errors: { [field]: DUPLICATES[field] },
    }))
    .with({ type: 'ownRecord' }, () => ({
      message: undefined,
      errors: { isActive: OWN_RECORD_STAYS_ACTIVE },
    }))
    .with({ type: 'forbidden' }, () => CANNOT_KEEP_STAFF)
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(FAILED_WRITES[write]))
    .exhaustive()
