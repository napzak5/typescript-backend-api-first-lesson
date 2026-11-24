import {
  CHECK_THE_VALUES_MESSAGE,
  NOT_SENT_MESSAGE,
  REFUSED_VALUE_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerPreferencesResponse,
  ModelsCustomerPreferencesUpdateRequest,
  ModelsStylePreference,
  ModelsTimeSlot,
} from '@beauty-salon-frontend/api-client'
import {
  LONGEST_WEB_ADDRESS,
  lengthOf,
  linesOf,
  tooLong,
  webAddressLinesError,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  type FormErrors,
  type FormRead,
  type FormSays,
  same,
  textOf,
  textOrNull,
  textsOf,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { preferenceMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import type { StaffChoice } from './staff-choices'

/*
 * The names of the controls of the form: those of the properties of the
 * request, and the path of a property that stands inside another.
 */
export const PREFERRED_STAFF = 'preferredStaffId'
export const AVOIDED_STAFF = 'avoidStaffIds'
export const TIME_SLOTS = 'preferredTimeSlots'
export const PREFERRED_LENGTH = 'stylePreferences.preferredLength'
export const PREFERRED_COLORS = 'stylePreferences.preferredColors'
export const AVOIDED_STYLES = 'stylePreferences.avoidStyles'
export const INSPIRATION_IMAGES = 'stylePreferences.inspirationImages'
export const COMMUNICATION_STYLE = 'communicationStyle'
export const SPECIAL_REQUESTS = 'specialRequests'

/** The name of the control of the time a time slot begins at: the slot is the row of that number, counted from 0. */
export const startOf = (name: string, index: number): string =>
  `${name}.${index}.startTime`

/** The name of the control of the time a time slot ends at. */
export const endOf = (name: string, index: number): string =>
  `${name}.${index}.endTime`

/** How many characters the column of the way a customer likes to be talked to takes */
export const MAX_COMMUNICATION_STYLE_LENGTH = 100

/**
 * What the controls of the form hold: text as it was typed, and for the
 * lists that are written a line each, the lines as one text.
 */
export type Entered = {
  /**
   * The member of the staff the customer wishes for; empty for nobody.
   * `undefined` when the form offers no staff: it has no control for them
   */
  preferredStaffId: string | undefined
  /** The members to avoid; `undefined` as above */
  avoidStaffIds: readonly string[] | undefined
  /** A row each; a time that was not entered is empty */
  timeSlots: readonly ModelsTimeSlot[]
  preferredLength: string
  preferredColors: string
  avoidStyles: string
  inspirationImages: string
  communicationStyle: string
  specialRequests: string
}

/**
 * What the form opens with. The staff it does not offer are not in it: a
 * member who was removed since the preferences were written stays in what
 * is stored, and is neither shown nor chosen.
 */
export const enteredOf = (
  preferences: ModelsCustomerPreferencesResponse,
  staff: readonly StaffChoice[],
): Entered => {
  const offered = staff.map(({ id }) => id)
  const wished = preferences.preferredStaffId ?? ''
  const style = preferences.stylePreferences

  return {
    ...(staff.length === 0
      ? { preferredStaffId: undefined, avoidStaffIds: undefined }
      : {
          preferredStaffId: offered.includes(wished) ? wished : '',
          avoidStaffIds: offered.filter((id) =>
            preferences.avoidStaffIds.includes(id),
          ),
        }),
    timeSlots: preferences.preferredTimeSlots,
    preferredLength: style?.preferredLength ?? '',
    preferredColors: (style?.preferredColors ?? []).join('\n'),
    avoidStyles: (style?.avoidStyles ?? []).join('\n'),
    inspirationImages: (style?.inspirationImages ?? []).join('\n'),
    communicationStyle: preferences.communicationStyle ?? '',
    specialRequests: preferences.specialRequests ?? '',
  }
}
/** The rows of time slots the form was sent with, from the row of the number `index` on. */
const timeSlotsIn = (values: FormData, index: number): ModelsTimeSlot[] =>
  values.has(startOf(TIME_SLOTS, index))
    ? [
        {
          startTime: textOf(values, startOf(TIME_SLOTS, index)),
          endTime: textOf(values, endOf(TIME_SLOTS, index)),
        },
        ...timeSlotsIn(values, index + 1),
      ]
    : []

/**
 * What the form was sent with. A `select` is always sent with a value, so
 * a form without the one of the staff is a form that offers no staff.
 */
const enteredIn = (values: FormData): Entered => ({
  ...(values.has(PREFERRED_STAFF)
    ? {
        preferredStaffId: textOf(values, PREFERRED_STAFF),
        avoidStaffIds: textsOf(values, AVOIDED_STAFF),
      }
    : { preferredStaffId: undefined, avoidStaffIds: undefined }),
  timeSlots: timeSlotsIn(values, 0),
  preferredLength: textOf(values, PREFERRED_LENGTH),
  preferredColors: textOf(values, PREFERRED_COLORS),
  avoidStyles: textOf(values, AVOIDED_STYLES),
  inspirationImages: textOf(values, INSPIRATION_IMAGES),
  communicationStyle: textOf(values, COMMUNICATION_STYLE),
  specialRequests: textOf(values, SPECIAL_REQUESTS),
})
/** What a customer likes of a style; `null` when nothing of it was entered. */
const styleOf = (entered: Entered): ModelsStylePreference | null => {
  const style: ModelsStylePreference = {
    preferredLength: textOrNull(entered.preferredLength),
    preferredColors: linesOf(entered.preferredColors),
    avoidStyles: linesOf(entered.avoidStyles),
    inspirationImages: linesOf(entered.inspirationImages),
  }

  return style.preferredLength === null &&
    style.preferredColors.length === 0 &&
    style.avoidStyles.length === 0 &&
    style.inspirationImages.length === 0
    ? null
    : style
}

const isEmptyRow = ({ startTime, endTime }: ModelsTimeSlot): boolean =>
  startTime.trim() === '' && endTime.trim() === ''

/** The preferences as a request would state all of them. */
type Whole = {
  /** `undefined` when the form has no control for the staff */
  preferredStaffId: string | null | undefined
  avoidStaffIds: readonly string[] | undefined
  preferredTimeSlots: ModelsTimeSlot[]
  stylePreferences: ModelsStylePreference | null
  communicationStyle: string | null
  specialRequests: string | null
}

/**
 * The values the controls stand for: nobody and nothing as `null`, text
 * without the spaces around it, and a row without a time as no time slot.
 */
const wholeOf = (entered: Entered): Whole => ({
  preferredStaffId:
    entered.preferredStaffId === undefined
      ? undefined
      : textOrNull(entered.preferredStaffId),
  avoidStaffIds: entered.avoidStaffIds,
  preferredTimeSlots: entered.timeSlots
    .filter((slot) => !isEmptyRow(slot))
    .map(({ startTime, endTime }) => ({
      startTime: startTime.trim(),
      endTime: endTime.trim(),
    })),
  stylePreferences: styleOf(entered),
  communicationStyle: textOrNull(entered.communicationStyle),
  specialRequests: textOrNull(entered.specialRequests),
})

/** What the form says of what it was sent with, and of what the API did not take */
const { flow } = preferenceMessages

const COMMUNICATION_STYLE_TOO_LONG = tooLong(MAX_COMMUNICATION_STYLE_LENGTH)

/** A time of day as the API takes it: `09:30`. Two of them compare as text. */
const TIME_OF_DAY = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const isTimeSlot = ({ startTime, endTime }: ModelsTimeSlot): boolean =>
  TIME_OF_DAY.test(startTime) &&
  TIME_OF_DAY.test(endTime) &&
  startTime < endTime

/**
 * What is wrong with a row of the time slots, at the control to correct.
 * A row overlaps an earlier one when it begins before that one ends and
 * ends after that one begins: two that touch do not overlap.
 */
const timeSlotError = (
  row: ModelsTimeSlot,
  index: number,
  rows: readonly ModelsTimeSlot[],
): [string, LocalizedText] | undefined => {
  const startTime = row.startTime.trim()
  const endTime = row.endTime.trim()
  const start = startOf(TIME_SLOTS, index)
  const end = endOf(TIME_SLOTS, index)

  if (startTime === '' && endTime === '') {
    return undefined
  }
  if (startTime === '') {
    return [start, flow.startMissing]
  }
  if (!TIME_OF_DAY.test(startTime)) {
    return [start, flow.timeMalformed]
  }
  if (endTime === '') {
    return [end, flow.endMissing]
  }
  if (!TIME_OF_DAY.test(endTime)) {
    return [end, flow.timeMalformed]
  }
  if (startTime >= endTime) {
    return [end, flow.endNotLater]
  }

  return rows
    .slice(0, index)
    .map((before) => ({
      startTime: before.startTime.trim(),
      endTime: before.endTime.trim(),
    }))
    .filter(isTimeSlot)
    .some(
      (earlier) => startTime < earlier.endTime && earlier.startTime < endTime,
    )
    ? [start, flow.overlapping]
    : undefined
}

/** What is said at a control */
const said = (
  control: string,
  error: LocalizedText,
): [string, LocalizedText] => [control, error]

/** What cannot be right of what the form was sent with, under the names of the controls. */
const errorsOf = (entered: Entered): FormErrors<LocalizedText> => {
  const wished = entered.preferredStaffId ?? ''
  const images = webAddressLinesError(
    entered.inspirationImages,
    LONGEST_WEB_ADDRESS,
  )

  const wrong: [string, LocalizedText][] = [
    ...(wished !== '' && entered.avoidStaffIds?.includes(wished) === true
      ? [said(AVOIDED_STAFF, flow.avoidedIsWishedFor)]
      : []),
    ...entered.timeSlots.flatMap((row, index, rows) => {
      const error = timeSlotError(row, index, rows)

      return error === undefined ? [] : [error]
    }),
    ...(images === undefined ? [] : [said(INSPIRATION_IMAGES, images)]),
    ...(lengthOf(entered.communicationStyle.trim()) >
    MAX_COMMUNICATION_STYLE_LENGTH
      ? [said(COMMUNICATION_STYLE, COMMUNICATION_STYLE_TOO_LONG)]
      : []),
  ]

  return Object.fromEntries(wrong)
}
/**
 * The preferences the form was sent with other values for than it was
 * opened with. What the form has no control for is no change.
 */
const changesOf = (
  sent: Whole,
  shown: Whole,
): ModelsCustomerPreferencesUpdateRequest => ({
  ...(sent.preferredStaffId === undefined ||
  sent.preferredStaffId === shown.preferredStaffId
    ? {}
    : { preferredStaffId: sent.preferredStaffId }),
  ...(sent.avoidStaffIds === undefined ||
  same(sent.avoidStaffIds, shown.avoidStaffIds)
    ? {}
    : { avoidStaffIds: [...sent.avoidStaffIds] }),
  ...(!same(sent.preferredTimeSlots, shown.preferredTimeSlots)
    ? { preferredTimeSlots: sent.preferredTimeSlots }
    : {}),
  ...(!same(sent.stylePreferences, shown.stylePreferences)
    ? { stylePreferences: sent.stylePreferences }
    : {}),
  ...(sent.communicationStyle === shown.communicationStyle
    ? {}
    : { communicationStyle: sent.communicationStyle }),
  ...(sent.specialRequests === shown.specialRequests
    ? {}
    : { specialRequests: sent.specialRequests }),
})

/** What the form was sent with: what to change, nothing to change, or what is wrong. */
export type PreferencesChangeRead =
  | FormRead<ModelsCustomerPreferencesUpdateRequest, FormErrors<LocalizedText>>
  /** The form was sent as it was opened: there is nothing to ask the API for */
  | { type: 'unchanged' }

/**
 * What the customer changed in the form: the preferences whose values are
 * others than those the form was opened with, and nothing else. The API
 * leaves a property alone that a request does not name, so what a salon
 * wrote in the meantime stays unless the customer changed the same value,
 * and so does a member of the staff the form did not show.
 *
 * `shown` and `staff` are what the form was opened with.
 */
export const readPreferencesChange = (
  values: FormData,
  shown: ModelsCustomerPreferencesResponse,
  staff: readonly StaffChoice[],
): PreferencesChangeRead => {
  const entered = enteredIn(values)
  const errors = errorsOf(entered)
  if (Object.keys(errors).length > 0) {
    return { type: 'invalid', errors }
  }
  const changes = changesOf(wholeOf(entered), wholeOf(enteredOf(shown, staff)))

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

/** A value of a list is entered at the control of the list. */
const LISTS = [
  AVOIDED_STAFF,
  PREFERRED_COLORS,
  AVOIDED_STYLES,
  INSPIRATION_IMAGES,
]

const CONTROLS = [
  PREFERRED_STAFF,
  PREFERRED_LENGTH,
  COMMUNICATION_STYLE,
  SPECIAL_REQUESTS,
  ...LISTS,
]

/**
 * The control a value of the request is entered at; `undefined` for a
 * value the form has no control of its own for.
 */
const controlOf = (field: string): string | undefined =>
  CONTROLS.find((control) => control === field) ??
  LISTS.find((list) => field.startsWith(`${list}.`))

/** What to say at a control whose value the API did not take, for the rule the value broke. */
const messageOf = (control: string, rule: string): LocalizedText =>
  match(control)
    .returnType<LocalizedText>()
    .with(PREFERRED_STAFF, () =>
      rule === 'avoided' ? flow.wishedForIsAvoided : flow.staffGone,
    )
    .with(AVOIDED_STAFF, () => flow.avoidedStaffGone)
    .with(COMMUNICATION_STYLE, () =>
      rule === 'too_big' ? COMMUNICATION_STYLE_TOO_LONG : REFUSED_VALUE_MESSAGE,
    )
    .otherwise(() => REFUSED_VALUE_MESSAGE)

/**
 * What the form says about the values the API did not take: at the
 * control of each. The form sends no time slot the API refuses, and the
 * rows of the request are not the rows of the form when one of them was
 * left empty: a time slot that is refused all the same is said of the
 * attempt, and so is a value the form has no control for.
 */
const afterRefusedValues = (
  values: readonly RefusedValue[],
): FormSays<LocalizedText> => {
  const said = values.flatMap(({ field, rule }) => {
    const control = controlOf(field)

    return control === undefined
      ? []
      : [{ control, message: messageOf(control, rule) }]
  })
  const ofTimeSlots = values.some(
    ({ field }) => field === TIME_SLOTS || field.startsWith(`${TIME_SLOTS}.`),
  )

  return said.length === 0 && !ofTimeSlots
    ? aboutTheAttempt(CHECK_THE_VALUES_MESSAGE)
    : {
        message: ofTimeSlots ? flow.timeSlotsRefused : undefined,
        // The first thing the API says about a value is the one to act on
        errors: Object.fromEntries(
          said
            .toReversed()
            .map(({ control, message }): [string, LocalizedText] => [
              control,
              message,
            ]),
        ),
      }
}
/**
 * Why the API did not change the preferences, as the form can say it: the
 * values it did not take, too many requests, or no answer. A customer who
 * is gone is not among them: the screen then has no form to show.
 */
export type PreferencesRefusal =
  | { type: 'invalid'; values: readonly RefusedValue[] }
  | { type: 'tooManyRequests' }
  | { type: 'failed' }

/** What the form says after the API did not change the preferences. */
export const afterPreferencesChange = (
  outcome: PreferencesRefusal,
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => afterRefusedValues(values))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(NOT_SENT_MESSAGE))
    .exhaustive()
