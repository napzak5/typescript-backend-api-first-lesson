import {
  CHECK_THE_VALUES_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import {
  ModelsAllergySeverityType,
  ModelsAllergyType,
  type ModelsCustomerAllergyCreateRequest,
  type ModelsCustomerAllergyResponse,
  type ModelsCustomerAllergyUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  EARLIEST_DAY,
  isDay,
  lengthOf,
  tooLongOf,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type BadgeTone,
  type FormErrors,
  type FormRead,
  type FormSays,
  type NamedChoice,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminChartMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import { mayKeepCustomers } from '../../customers/utils/customer-history'
import type { AllergyRemoval, AllergyWrite } from '../api/allergies-api'

/*
 * The allergies of a customer: what they are called, how heavy they are,
 * what a form of one reads, and what is said after it was sent. A
 * customer has one allergy of an allergen, whatever its kind.
 */

const { change, entry, form, removal, severities, types, words } =
  adminChartMessages.allergies
const { errors: ERRORS } = form

type Errors = FormErrors<LocalizedText>

const TYPE_NAMES: Record<ModelsAllergyType, LocalizedText> = types

const SEVERITY_NAMES: Record<ModelsAllergySeverityType, LocalizedText> =
  severities

const SEVERITY_TONES: Record<ModelsAllergySeverityType, BadgeTone> = {
  mild: 'neutral',
  moderate: 'neutral',
  severe: 'warning',
  life_threatening: 'danger',
}

const TYPES: readonly ModelsAllergyType[] = Object.values(ModelsAllergyType)

/** The severities, the heaviest first: the order of the list of a customer. */
const SEVERITIES: readonly ModelsAllergySeverityType[] = Object.values(
  ModelsAllergySeverityType,
).toReversed()

/** What a kind of allergy is called: 「香料」. */
export const allergyTypeNameOf = (type: ModelsAllergyType): LocalizedText =>
  TYPE_NAMES[type]

/** What a severity is called: 「命に関わる」. */
export const severityNameOf = (
  severity: ModelsAllergySeverityType,
): LocalizedText => SEVERITY_NAMES[severity]

/** The colour of a severity: the two heaviest stand out. The word says which it is. */
export const severityToneOf = (
  severity: ModelsAllergySeverityType,
): BadgeTone => SEVERITY_TONES[severity]

/** The kinds a form offers, in the order of the contract. */
export const ALLERGY_TYPE_CHOICES: readonly NamedChoice[] = TYPES.map(
  (type) => ({ value: type, label: TYPE_NAMES[type] }),
)

/** The severities a form offers, the heaviest first. */
export const SEVERITY_CHOICES: readonly NamedChoice[] = SEVERITIES.map(
  (severity) => ({ value: severity, label: SEVERITY_NAMES[severity] }),
)

/** Whether an account of the role may remove an allergy: the API allows those who take a customer out of the ledger. */
export const mayRemoveAllergies = (role: string): boolean =>
  mayKeepCustomers(role)

const LONGEST_ALLERGEN = 255

const ALLERGEN_TOO_LONG = tooLongOf(words.allergen, LONGEST_ALLERGEN)

/** A text written as a day, whether or not it is one the API takes */
const DAY = /^\d{4}-\d{2}-\d{2}$/
const typeFrom = (value: string): ModelsAllergyType | undefined =>
  TYPES.find((type) => type === value)

const severityFrom = (value: string): ModelsAllergySeverityType | undefined =>
  SEVERITIES.find((severity) => severity === value)

/** What is wrong with the day the allergy was confirmed on, if anything; none is no day. */
const dateErrorOf = (
  date: string,
  today: string,
): LocalizedText | undefined => {
  if (date === '') {
    return undefined
  }
  if (DAY.test(date) && date < EARLIEST_DAY) {
    return ERRORS.dateTooEarly
  }
  if (!isDay(date)) {
    return ERRORS.dateNotADay
  }

  return date > today ? ERRORS.dateTooLate : undefined
}

/** What is wrong with the allergen, if anything. */
const allergenErrorOf = (allergen: string): LocalizedText | undefined => {
  if (allergen === '') {
    return ERRORS.allergenMissing
  }

  return lengthOf(allergen) > LONGEST_ALLERGEN ? ALLERGEN_TOO_LONG : undefined
}

/**
 * The allergy a form records: every property, those left empty as `null`.
 * A day after today at the salon is refused, as the API refuses it.
 */
export const readAllergy = (
  values: FormData,
  today: string,
): FormRead<ModelsCustomerAllergyCreateRequest, Errors> => {
  const allergyType = typeFrom(textOf(values, 'allergyType'))
  const allergenName = textOf(values, 'allergenName').trim()
  const severityType = severityFrom(textOf(values, 'severityType'))
  const confirmedDate = textOf(values, 'confirmedDate').trim()
  const wrong: [string, LocalizedText | undefined][] = [
    ['allergyType', allergyType === undefined ? ERRORS.typeMissing : undefined],
    ['allergenName', allergenErrorOf(allergenName)],
    [
      'severityType',
      severityType === undefined ? ERRORS.severityMissing : undefined,
    ],
    ['confirmedDate', dateErrorOf(confirmedDate, today)],
  ]
  const errors = Object.fromEntries(
    wrong.flatMap(([name, message]) =>
      message === undefined ? [] : [[name, message]],
    ),
  )
  if (
    allergyType === undefined ||
    severityType === undefined ||
    Object.keys(errors).length > 0
  ) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    value: {
      allergyType,
      allergenName,
      severityType,
      symptoms: textOrNull(textOf(values, 'symptoms')),
      notes: textOrNull(textOf(values, 'notes')),
      confirmedDate: confirmedDate === '' ? null : confirmedDate,
    },
  }
}

/** What a change of an allergy asks for: nothing, when nothing was changed. */
export type AllergyChange =
  | FormRead<ModelsCustomerAllergyUpdateRequest, Errors>
  | { type: 'unchanged' }

/**
 * What was changed in the form: the properties whose values are others
 * than those of the allergy it was opened with. What another account
 * wrote meanwhile stays, unless the same property was changed here.
 */
export const readAllergyChange = (
  values: FormData,
  shown: ModelsCustomerAllergyResponse,
  today: string,
): AllergyChange => {
  const read = readAllergy(values, today)
  if (read.type === 'invalid') {
    return read
  }
  const sent = read.value
  const changes: ModelsCustomerAllergyUpdateRequest = {
    ...(sent.allergyType === shown.allergyType
      ? {}
      : { allergyType: sent.allergyType }),
    ...(sent.allergenName === shown.allergenName
      ? {}
      : { allergenName: sent.allergenName }),
    ...(sent.severityType === shown.severityType
      ? {}
      : { severityType: sent.severityType }),
    ...(sent.symptoms === textOrNull(shown.symptoms)
      ? {}
      : { symptoms: sent.symptoms }),
    ...(sent.notes === textOrNull(shown.notes) ? {} : { notes: sent.notes }),
    ...(sent.confirmedDate === shown.confirmedDate
      ? {}
      : { confirmedDate: sent.confirmedDate }),
  }

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** Where the form says what the API refused, and in what words; `undefined` for what it has no control of. */
const saidOf = ({
  field,
  rule,
}: RefusedValue): [string, LocalizedText] | undefined =>
  match(field)
    .returnType<[string, LocalizedText] | undefined>()
    .with('allergyType', () => [field, ERRORS.typeMissing])
    .with('allergenName', () => [
      field,
      rule === 'too_big' ? ALLERGEN_TOO_LONG : ERRORS.allergenMissing,
    ])
    .with('severityType', () => [field, ERRORS.severityMissing])
    .with('confirmedDate', () => [
      field,
      rule === 'too_big'
        ? ERRORS.dateTooLate
        : rule === 'too_small'
          ? ERRORS.dateTooEarly
          : ERRORS.dateNotADay,
    ])
    .otherwise(() => undefined)

/** Which write a form makes: the words of its failure differ. */
export type AllergyWriteKind = 'entry' | 'change'

const FAILED_WRITES: Record<AllergyWriteKind, LocalizedText> = {
  entry: entry.failed,
  change: change.failed,
}

/** What the form says after the API refused it, or after nothing came of it. */
export const afterAllergyWrite = (
  outcome: Extract<
    AllergyWrite,
    { type: 'invalid' | 'exists' | 'forbidden' | 'tooManyRequests' | 'failed' }
  >,
  write: AllergyWriteKind,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap((value) => {
        const at = saidOf(value)

        return at === undefined ? [] : [at]
      })

      return {
        message:
          said.length < values.length ? CHECK_THE_VALUES_MESSAGE : undefined,
        // The first thing the API says about a control is the one to act on
        errors: Object.fromEntries(said.toReversed()),
      }
    })
    .with({ type: 'exists' }, () => ({
      message: undefined,
      errors: { allergenName: ERRORS.allergenExists },
    }))
    .with({ type: 'forbidden' }, () => aboutTheAttempt(form.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(FAILED_WRITES[write]))
    .exhaustive()

/** What is said when an allergy was recorded or changed: 「山田 花子 様のアレルギー（PPD）を記録しました。」. */
export const allergyWrittenOf = (
  name: string,
  allergen: string,
  write: AllergyWriteKind,
): LocalizedText =>
  write === 'entry' ? entry.done(name, allergen) : change.done(name, allergen)

/** What a removal comes to on the screen. */
export type AllergyRemovalSays =
  /** The allergy was removed: said in a notification */
  | { type: 'done'; message: LocalizedText }
  /** Nothing was removed, and another attempt may: said in the dialog */
  | { type: 'again'; message: LocalizedText }
  /** What changed meanwhile, which another attempt does not change: said under the heading, and the list is read again */
  | { type: 'refused'; message: LocalizedText }

/** What is said after an allergy was to be removed. */
export const afterAllergyRemoval = (
  outcome: AllergyRemoval,
  name: string,
  allergen: string,
): AllergyRemovalSays =>
  match(outcome)
    .returnType<AllergyRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: removal.done(name, allergen),
    }))
    .with({ type: 'notFound' }, () => ({
      type: 'refused',
      message: removal.gone,
    }))
    // The role of the account changed meanwhile
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: removal.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: removal.failed,
    }))
    .exhaustive()
