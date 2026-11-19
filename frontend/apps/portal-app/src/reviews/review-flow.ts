import type {
  ModelsReviewCreateRequest,
  ModelsReviewResponse,
  ModelsReviewUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import type { FormErrors } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { RefusedValue } from '../behind-the-session'
import type { FormSays, Read } from '../forms'
import { linesOf, pictureAddressesError } from '../lines'
import { DETAIL_RATINGS } from '../salons/salon-format'
import type {
  ReviewChange,
  ReviewRemoval,
  ReviewWriting,
  Visit,
} from './reviews-api'

/*
 * The names of the controls of the form: those of the properties of the
 * request.
 */
export const STAFF = 'staffId'
export const OVERALL_RATING = 'overallRating'
export const STAFF_RATING = 'staffRating'
export const TITLE = 'title'
export const COMMENT = 'comment'
export const IMAGES = 'imageUrls'

/** How many characters the column of the title takes */
export const MAX_TITLE_LENGTH = 255

/** How many pictures the API takes with a review */
export const MAX_IMAGES = 10

/** What the controls of the form hold: text as it was typed, and a choice as the value of its option. */
export type Entered = {
  /**
   * The member of the staff the review rates; empty for nobody.
   * `undefined` when the form has no control for it: there is nobody to
   * choose, or the review is written and its member cannot be changed
   */
  staffId: string | undefined
  /** `1` to `5`; empty while nothing is chosen */
  overallRating: string
  serviceRating: string
  /** `undefined` when the form has no control for it: the review rates nobody */
  staffRating: string | undefined
  atmosphereRating: string
  cleanlinessRating: string
  valueRating: string
  title: string
  comment: string
  /** The addresses of the pictures, a line each */
  imageUrls: string
}

const chosen = (rating: number | null): string =>
  rating === null ? '' : String(rating)

/**
 * What the form of a new review opens with: nothing but the member of the
 * staff the booking was with, when a review can rate them.
 */
export const enteredForVisit = ({ booking, staff }: Visit): Entered => {
  const offered = staff.some(({ id }) => id === booking.staffId)

  return {
    staffId: staff.length === 0 ? undefined : offered ? booking.staffId : '',
    overallRating: '',
    serviceRating: '',
    staffRating: offered ? '' : undefined,
    atmosphereRating: '',
    cleanlinessRating: '',
    valueRating: '',
    title: '',
    comment: '',
    imageUrls: '',
  }
}

/** What the form that changes a review opens with. */
export const enteredOf = (review: ModelsReviewResponse): Entered => ({
  staffId: undefined,
  overallRating: chosen(review.overallRating),
  serviceRating: chosen(review.serviceRating),
  staffRating: review.staffId === null ? undefined : chosen(review.staffRating),
  atmosphereRating: chosen(review.atmosphereRating),
  cleanlinessRating: chosen(review.cleanlinessRating),
  valueRating: chosen(review.valueRating),
  title: review.title ?? '',
  comment: review.comment ?? '',
  imageUrls: review.imageUrls.join('\n'),
})

const textOf = (values: FormData, name: string): string => {
  const value = values.get(name)

  return typeof value === 'string' ? value : ''
}

/**
 * What the form was sent with. A `select` is always sent with a value, so
 * a form without that of the staff, or of their rating, has no control for
 * it; a group of radio buttons of which none is chosen sends nothing.
 */
const enteredIn = (values: FormData): Entered => ({
  staffId: values.has(STAFF) ? textOf(values, STAFF) : undefined,
  overallRating: textOf(values, OVERALL_RATING),
  serviceRating: textOf(values, 'serviceRating'),
  staffRating: values.has(STAFF_RATING)
    ? textOf(values, STAFF_RATING)
    : undefined,
  atmosphereRating: textOf(values, 'atmosphereRating'),
  cleanlinessRating: textOf(values, 'cleanlinessRating'),
  valueRating: textOf(values, 'valueRating'),
  title: textOf(values, TITLE),
  comment: textOf(values, COMMENT),
  imageUrls: textOf(values, IMAGES),
})

/** The ratings there are, as the options of a control hold them */
const RATINGS = ['1', '2', '3', '4', '5']

/** The rating a control holds; `null` when none is chosen. */
const ratingOf = (text: string): number | null =>
  RATINGS.includes(text) ? Number(text) : null

/** What a control that may be left empty holds: `null` for nothing. */
const textOrNull = (text: string): string | null => {
  const trimmed = text.trim()

  return trimmed === '' ? null : trimmed
}

/** What a customer says of a visit, as a request states it. */
type Said = {
  /** `null` while none is chosen: a review has one */
  overallRating: number | null
  serviceRating: number | null
  /** `undefined` when the form has no control for it */
  staffRating: number | null | undefined
  atmosphereRating: number | null
  cleanlinessRating: number | null
  valueRating: number | null
  title: string | null
  comment: string | null
  imageUrls: string[]
}

/**
 * The values the controls stand for: no rating and no text as `null`, text
 * without the spaces around it, and the pictures each once.
 */
const saidOf = (entered: Entered): Said => ({
  overallRating: ratingOf(entered.overallRating),
  serviceRating: ratingOf(entered.serviceRating),
  staffRating:
    entered.staffRating === undefined
      ? undefined
      : ratingOf(entered.staffRating),
  atmosphereRating: ratingOf(entered.atmosphereRating),
  cleanlinessRating: ratingOf(entered.cleanlinessRating),
  valueRating: ratingOf(entered.valueRating),
  title: textOrNull(entered.title),
  comment: textOrNull(entered.comment),
  imageUrls: linesOf(entered.imageUrls),
})

const OVERALL_RATING_MISSING = '総合の評価を選んでください。'
const TITLE_TOO_LONG = `${MAX_TITLE_LENGTH} 文字以内で入力してください。`
const TOO_MANY_IMAGES = `画像は ${MAX_IMAGES} 個までです。行を減らしてください。`
const UNACCEPTABLE = 'この内容は登録できません。入力し直してください。'

/** What cannot be right of what the form was sent with, under the names of the controls. */
const errorsOf = (entered: Entered): FormErrors => {
  const images =
    pictureAddressesError(entered.imageUrls) ??
    (linesOf(entered.imageUrls).length > MAX_IMAGES
      ? TOO_MANY_IMAGES
      : undefined)

  return Object.fromEntries([
    ...(ratingOf(entered.overallRating) === null
      ? [[OVERALL_RATING, OVERALL_RATING_MISSING]]
      : []),
    ...(entered.title.trim().length > MAX_TITLE_LENGTH
      ? [[TITLE, TITLE_TOO_LONG]]
      : []),
    ...(images === undefined ? [] : [[IMAGES, images]]),
  ])
}

/**
 * The review the form of a new one was sent with, or what is wrong with
 * it. Whose visit it is of is what the screen read (`visit`), not what a
 * control holds. A review that rates nobody has no rating of the staff.
 */
export const readNewReview = (
  values: FormData,
  { booking, customerId }: Visit,
): Read<ModelsReviewCreateRequest> => {
  const entered = enteredIn(values)
  const errors = errorsOf(entered)
  const said = saidOf(entered)
  if (Object.keys(errors).length > 0 || said.overallRating === null) {
    return { type: 'invalid', errors }
  }
  const staffId = textOrNull(entered.staffId ?? '')

  return {
    type: 'valid',
    value: {
      salonId: booking.salonId,
      customerId,
      bookingId: booking.id,
      staffId,
      overallRating: said.overallRating,
      serviceRating: said.serviceRating,
      staffRating: staffId === null ? null : (said.staffRating ?? null),
      atmosphereRating: said.atmosphereRating,
      cleanlinessRating: said.cleanlinessRating,
      valueRating: said.valueRating,
      title: said.title,
      comment: said.comment,
      imageUrls: said.imageUrls,
    },
  }
}

const differs = (one: unknown, other: unknown): boolean =>
  JSON.stringify(one) !== JSON.stringify(other)

/**
 * What the form was sent with other values for than it was opened with.
 * What the form has no control for is no change.
 */
const changesOf = (
  sent: Said & { overallRating: number },
  shown: Said,
): ModelsReviewUpdateRequest => ({
  ...(sent.overallRating === shown.overallRating
    ? {}
    : { overallRating: sent.overallRating }),
  ...(sent.serviceRating === shown.serviceRating
    ? {}
    : { serviceRating: sent.serviceRating }),
  ...(sent.staffRating === undefined || sent.staffRating === shown.staffRating
    ? {}
    : { staffRating: sent.staffRating }),
  ...(sent.atmosphereRating === shown.atmosphereRating
    ? {}
    : { atmosphereRating: sent.atmosphereRating }),
  ...(sent.cleanlinessRating === shown.cleanlinessRating
    ? {}
    : { cleanlinessRating: sent.cleanlinessRating }),
  ...(sent.valueRating === shown.valueRating
    ? {}
    : { valueRating: sent.valueRating }),
  ...(sent.title === shown.title ? {} : { title: sent.title }),
  ...(sent.comment === shown.comment ? {} : { comment: sent.comment }),
  ...(differs(sent.imageUrls, shown.imageUrls)
    ? { imageUrls: sent.imageUrls }
    : {}),
})

/** What the form was sent with: what to change, nothing to change, or what is wrong. */
export type ReviewChangeRead =
  | Read<ModelsReviewUpdateRequest>
  /** The form was sent as it was opened: there is nothing to ask the API for */
  | { type: 'unchanged' }

/**
 * What the customer changed in the form: the properties whose values are
 * others than those the form was opened with (`shown`), and nothing else.
 * The API leaves a property alone that a request does not name.
 */
export const readReviewChange = (
  values: FormData,
  shown: ModelsReviewResponse,
): ReviewChangeRead => {
  const entered = enteredIn(values)
  const errors = errorsOf(entered)
  const said = saidOf(entered)
  if (Object.keys(errors).length > 0 || said.overallRating === null) {
    return { type: 'invalid', errors }
  }
  const changes = changesOf(
    { ...said, overallRating: said.overallRating },
    saidOf(enteredOf(shown)),
  )

  return Object.keys(changes).length === 0
    ? { type: 'unchanged' }
    : { type: 'valid', value: changes }
}

const STAFF_GONE =
  'このスタッフは、選べなくなりました。ほかのスタッフか、「スタッフを評価しない」を選んでください。'

/** The values of the request that say which visit a review is of: the form has no control for them. */
const OF_THE_VISIT = ['bookingId', 'salonId', 'customerId']

const CONTROLS = [
  STAFF,
  OVERALL_RATING,
  TITLE,
  COMMENT,
  IMAGES,
  ...DETAIL_RATINGS.map(({ name }) => name),
]

/**
 * The control a value of the request is entered at; `undefined` for a
 * value the form has no control for. A picture is entered at the control
 * of them all.
 */
const controlOf = (field: string): string | undefined =>
  CONTROLS.find((control) => control === field) ??
  (field.startsWith(`${IMAGES}.`) ? IMAGES : undefined)

/** What to say at a control whose value the API did not take, for the rule the value broke. */
const messageOf = (control: string, rule: string): string =>
  match(control)
    .with(STAFF, () => STAFF_GONE)
    .with(TITLE, () => (rule === 'too_big' ? TITLE_TOO_LONG : UNACCEPTABLE))
    .with(IMAGES, () => (rule === 'too_big' ? TOO_MANY_IMAGES : UNACCEPTABLE))
    .otherwise(() => UNACCEPTABLE)

/**
 * What the form says about the values the API did not take: at the control
 * of each, and about the attempt when the form has no control for them.
 */
const afterRefusedValues = (values: readonly RefusedValue[]): FormSays => {
  const said = values.flatMap(({ field, rule }) => {
    const control = controlOf(field)

    return control === undefined
      ? []
      : [{ control, message: messageOf(control, rule) }]
  })

  return said.length === 0
    ? {
        message: '入力した内容を確かめて、もう一度お試しください。',
        errors: {},
      }
    : {
        message: undefined,
        // The first thing the API says about a value is the one to act on
        errors: Object.fromEntries(
          said.toReversed().map(({ control, message }) => [control, message]),
        ),
      }
}

export const TOO_MANY_REQUESTS =
  'アクセスが多すぎます。しばらくしてから、もう一度お試しください。'

export const NOT_SENT =
  '送信できませんでした。通信の状態を確かめて、もう一度お試しください。'

const VISIT_READ_AGAIN: FormSays = {
  message:
    'このレビューは、投稿できませんでした。来店の内容を読み込み直しましたので、お確かめください。',
  errors: {},
}

const namesTheVisit = (values: readonly RefusedValue[]): boolean =>
  values.some(({ field }) => OF_THE_VISIT.includes(field))

/**
 * The API says of the visit itself that it cannot be written about: it has
 * a review by now, it is no visit that took place, or its booking or its
 * salon is gone. The screen reads the visit again and says what it is now.
 */
export const isOfTheVisit = (
  outcome: Exclude<ReviewWriting, { type: 'written' }>,
): boolean =>
  outcome.type === 'refused' ||
  (outcome.type === 'invalid' && namesTheVisit(outcome.values))

/** What the form says after the API did not write the review. */
export const afterReviewWriting = (
  outcome: Exclude<ReviewWriting, { type: 'written' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'refused' }, () => VISIT_READ_AGAIN)
    .with({ type: 'invalid' }, ({ values }) =>
      namesTheVisit(values) ? VISIT_READ_AGAIN : afterRefusedValues(values),
    )
    .with({ type: 'tooManyRequests' }, () => ({
      message: TOO_MANY_REQUESTS,
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({ message: NOT_SENT, errors: {} }))
    .exhaustive()

/**
 * What the form says after the API did not change the review. A review
 * that is gone is not said here: the screen then has no form to show.
 */
export const afterReviewChange = (
  outcome: Exclude<ReviewChange, { type: 'changed' } | { type: 'gone' }>,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => afterRefusedValues(values))
    .with({ type: 'tooManyRequests' }, () => ({
      message: TOO_MANY_REQUESTS,
      errors: {},
    }))
    .with({ type: 'failed' }, () => ({ message: NOT_SENT, errors: {} }))
    .exhaustive()

/**
 * What the dialog says after the API did not remove a review: the customer
 * may try again. A review that was gone already is not said here: what the
 * customer asked for is so.
 */
export const afterReviewRemoval = (
  outcome: Exclude<ReviewRemoval, { type: 'removed' } | { type: 'gone' }>,
): string =>
  match(outcome)
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => NOT_SENT)
    .exhaustive()
