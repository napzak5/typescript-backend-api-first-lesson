import {
  type ModelsTreatmentPhotoBulkCreateRequest,
  type ModelsTreatmentPhotoCreateRequest,
  type ModelsTreatmentPhotoResponse,
  ModelsTreatmentPhotoType,
  type ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import {
  type Read,
  type RefusedValue,
  textOf,
} from '@beauty-salon-frontend/salon-screens'
import type { SelectOption } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import * as z from 'zod'
import { type FormSays, TOO_MANY_REQUESTS } from '../bookings/booking-entry'
import type { PhotoRemoval, PhotosAdding } from './treatments-api'

/*
 * The photos of a treatment record: how they are named, the form that adds
 * them, and what is said after they were added or one was taken away. The
 * API keeps the address of a photo, not its file. A photo is a row of
 * controls named by the number the row has now, counted from 0
 * (`photos.1.photoUrl`), as the API names what is wrong with one.
 */

/** The most photos a record holds */
export const MOST_PHOTOS = 20
const LONGEST_URL = 500
const LONGEST_ANGLE = 50

const PHOTO_TYPE_NAMES: Record<ModelsTreatmentPhotoType, string> = {
  before: '施術前',
  during: '施術中',
  after: '施術後',
  other: 'そのほか',
}

/** When a photo may have been taken, in the order of a treatment */
export const PHOTO_TYPE_OPTIONS: readonly SelectOption[] = Object.values(
  ModelsTreatmentPhotoType,
).map((photoType) => ({ value: photoType, label: PHOTO_TYPE_NAMES[photoType] }))

/** What a photo shows, as its image is named: 「施術後の写真（正面）」. */
export const photoNameOf = ({
  photoType,
  angle,
}: Pick<ModelsTreatmentPhotoResponse, 'photoType' | 'angle'>): string =>
  angle === null
    ? `${PHOTO_TYPE_NAMES[photoType]}の写真`
    : `${PHOTO_TYPE_NAMES[photoType]}の写真（${angle}）`

/** How a photo may be used, as the customer agreed. */
export const photoUseOf = ({
  isPublic,
  customerConsent,
}: Pick<
  ModelsTreatmentPhotoResponse,
  'isPublic' | 'customerConsent'
>): string =>
  isPublic
    ? 'お客様の同意あり。サロンの外にも見せられます。'
    : customerConsent
      ? 'お客様の同意あり。サロンの中だけで使います。'
      : 'お客様の同意なし。サロンの中だけで使います。'

/** How many photos a record can still take. */
export const roomOf = ({
  photos,
}: {
  photos: readonly ModelsTreatmentPhotoResponse[]
}): number => Math.max(0, MOST_PHOTOS - photos.length)

/** The name of a control of the row of the photo of the number `index`, counted from 0 */
export const photoControlOf = (
  index: number,
  name: keyof ModelsTreatmentPhotoCreateRequest,
): string => `photos.${index}.${name}`

const TYPE_MISSING = '写真の区分を選んでください。'
const URL_MISSING = '写真の URL を入力してください。'
const URL_ERROR = `http:// か https:// で始まる、ドメイン名（photos.example.com など）の URL を、${LONGEST_URL} 文字までで入力してください。`
const ANGLE_TOO_LONG = `撮った向きは、${LONGEST_ANGLE} 文字までで入力してください。`
const NO_CONSENT =
  'お客様の同意がない写真は、サロンの外に見せられません。お客様の同意を確かめるか、このチェックを外してください。'
const URL_HELD =
  'この施術記録には、同じ URL の写真があります。ほかの写真の URL を入力するか、この写真の欄を外してください。'
const CHECK_AGAIN = '入力した内容を確かめて、もう一度お試しください。'

/** What is said of the address of a photo that an earlier row of the form holds */
const repeatedUrlOf = (row: number): string =>
  `${row} 枚目と同じ URL です。ほかの写真の URL を入力するか、この写真の欄を外してください。`

/** What is said when the record has no room for the photos of the form */
const noRoomOf = (room: number): string =>
  room === 0
    ? `この施術記録の写真は、${MOST_PHOTOS} 枚になりました。写真を外してから足してください。`
    : `この施術記録には、あと ${room} 枚まで足せます。写真の欄を減らしてください。`

/** A text that was filled in, without the spaces around it; nothing as `null`. */
const textOrNull = (text: string): string | null => {
  const trimmed = text.trim()

  return trimmed === '' ? null : trimmed
}

/** An address of the web as the API takes it for a photo: of a domain name, not of a machine or its number */
const photoAddressSchema = z.httpUrl().check(z.maxLength(LONGEST_URL))

/** Whether a text is an address the API keeps a photo at. */
const isPhotoAddress = (text: string): boolean =>
  photoAddressSchema.safeParse(text).success

/** What is wrong with a control, under its name; nothing when nothing is. */
const errorAt = (
  control: string,
  message: string | undefined,
): [string, string][] => (message === undefined ? [] : [[control, message]])

/** A photo as it was filled in */
type FilledPhoto = {
  photoType: string
  photoUrl: string
  thumbnailUrl: string
  angle: string
  description: string
  customerConsent: boolean
  isPublic: boolean
}

/** The photos the form was sent with, from the row of the number `index` on. */
const photosIn = (values: FormData, index: number): FilledPhoto[] =>
  values.has(photoControlOf(index, 'photoType'))
    ? [
        {
          photoType: textOf(values, photoControlOf(index, 'photoType')),
          photoUrl: textOf(values, photoControlOf(index, 'photoUrl')).trim(),
          thumbnailUrl: textOf(
            values,
            photoControlOf(index, 'thumbnailUrl'),
          ).trim(),
          angle: textOf(values, photoControlOf(index, 'angle')),
          description: textOf(values, photoControlOf(index, 'description')),
          customerConsent: values.has(photoControlOf(index, 'customerConsent')),
          isPublic: values.has(photoControlOf(index, 'isPublic')),
        },
        ...photosIn(values, index + 1),
      ]
    : []

const photoTypeOf = (text: string): ModelsTreatmentPhotoType | undefined =>
  Object.values(ModelsTreatmentPhotoType).find(
    (photoType) => photoType === text,
  )

/** What is wrong with the row of the number `index`, against the record and the rows before it. */
const photoErrorsOf = (
  index: number,
  filled: FilledPhoto,
  earlier: readonly FilledPhoto[],
  held: readonly ModelsTreatmentPhotoResponse[],
): [string, string][] => {
  const angle = textOrNull(filled.angle)
  const repeated = earlier.findIndex(
    ({ photoUrl }) => photoUrl === filled.photoUrl,
  )

  return [
    ...errorAt(
      photoControlOf(index, 'photoType'),
      photoTypeOf(filled.photoType) === undefined ? TYPE_MISSING : undefined,
    ),
    ...errorAt(
      photoControlOf(index, 'photoUrl'),
      filled.photoUrl === ''
        ? URL_MISSING
        : !isPhotoAddress(filled.photoUrl)
          ? URL_ERROR
          : repeated !== -1
            ? repeatedUrlOf(repeated + 1)
            : held.some(({ photoUrl }) => photoUrl === filled.photoUrl)
              ? URL_HELD
              : undefined,
    ),
    ...errorAt(
      photoControlOf(index, 'thumbnailUrl'),
      filled.thumbnailUrl === '' || isPhotoAddress(filled.thumbnailUrl)
        ? undefined
        : URL_ERROR,
    ),
    ...errorAt(
      photoControlOf(index, 'angle'),
      angle !== null && angle.length > LONGEST_ANGLE
        ? ANGLE_TOO_LONG
        : undefined,
    ),
    ...errorAt(
      photoControlOf(index, 'isPublic'),
      filled.isPublic && !filled.customerConsent ? NO_CONSENT : undefined,
    ),
  ]
}

/** The photos that were filled in, or what is wrong with them; and none, when the record has no room for them. */
export type PhotosRead =
  | Read<ModelsTreatmentPhotoBulkCreateRequest>
  | { type: 'noRoom'; message: string }

/**
 * The photos that were filled in, to be added to a record. They follow the
 * photos it holds, in the order of the rows: the API orders the photos of
 * a record by `sortOrder`, which the form gives and does not show.
 */
export const readPhotos = (
  values: FormData,
  record: Pick<ModelsTreatmentRecordResponse, 'photos'>,
): PhotosRead => {
  const filled = photosIn(values, 0)
  const errors = filled.flatMap((photo, index) =>
    photoErrorsOf(index, photo, filled.slice(0, index), record.photos),
  )
  if (errors.length > 0) {
    return { type: 'invalid', errors: Object.fromEntries(errors) }
  }
  const room = roomOf(record)
  if (filled.length > room) {
    return { type: 'noRoom', message: noRoomOf(room) }
  }
  const next = Math.max(-1, ...record.photos.map(({ sortOrder }) => sortOrder))

  return {
    type: 'valid',
    request: {
      photos: filled.flatMap((photo, index) => {
        const photoType = photoTypeOf(photo.photoType)

        return photoType === undefined
          ? []
          : [
              {
                photoType,
                photoUrl: photo.photoUrl,
                thumbnailUrl: textOrNull(photo.thumbnailUrl),
                angle: textOrNull(photo.angle),
                description: textOrNull(photo.description),
                isPublic: photo.isPublic,
                customerConsent: photo.customerConsent,
                sortOrder: next + 1 + index,
              },
            ]
      }),
    },
  }
}

const PHOTO_FIELD =
  /^photos\.(\d+)\.(photoType|photoUrl|thumbnailUrl|angle|isPublic)$/

/** What the API says is wrong with a control of a photo, in the words of the form. */
const photoSaidOf = (name: string): string =>
  match(name)
    .returnType<string>()
    .with('photoType', () => TYPE_MISSING)
    .with('angle', () => ANGLE_TOO_LONG)
    .with('isPublic', () => NO_CONSENT)
    .otherwise(() => URL_ERROR)

/**
 * What the form says after the API refused the photos, or after nothing
 * came of them. Photos the record holds now are those it was read with
 * after a 409: of an address it holds, or too many for it.
 */
export const afterPhotosAdded = (
  outcome: Extract<
    PhotosAdding,
    { type: 'invalid' | 'held' | 'forbidden' | 'tooManyRequests' | 'failed' }
  >,
  request: ModelsTreatmentPhotoBulkCreateRequest,
): FormSays =>
  match(outcome)
    .returnType<FormSays>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap(
        ({ field }: RefusedValue): [string, string][] => {
          const photo = PHOTO_FIELD.exec(field)

          return photo?.[2] === undefined
            ? []
            : [[field, photoSaidOf(photo[2])]]
        },
      )

      return {
        message: said.length < values.length ? CHECK_AGAIN : undefined,
        errors: Object.fromEntries(said.toReversed()),
      }
    })
    .with({ type: 'held' }, ({ record }) => {
      const errors = request.photos.flatMap(
        ({ photoUrl }, index): [string, string][] =>
          record.photos.some((photo) => photo.photoUrl === photoUrl)
            ? [[photoControlOf(index, 'photoUrl'), URL_HELD]]
            : [],
      )

      return errors.length > 0
        ? { message: undefined, errors: Object.fromEntries(errors) }
        : { message: noRoomOf(roomOf(record)), errors: {} }
    })
    .with({ type: 'forbidden' }, () => ({
      message: 'このアカウントでは、施術写真を足せません。',
      errors: {},
    }))
    .with({ type: 'tooManyRequests' }, () => TOO_MANY_REQUESTS)
    .with({ type: 'failed' }, () => ({
      message:
        '施術写真を足せませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    }))
    .exhaustive()

/** What is said when photos were added: 「施術写真を 2 枚足しました。」. */
export const photosAddedOf = (count: number): string =>
  `施術写真を ${count} 枚足しました。`

/** What is said after a photo was to be taken away. */
export type PhotoRemovalSays =
  | { type: 'done'; message: string }
  /** What can be tried again: said in the dialog */
  | { type: 'again'; message: string }
  /** What changed meanwhile: said above the photos, which are read again */
  | { type: 'refused'; message: string }

/** What is said after a photo was to be taken away. */
export const afterPhotoRemoval = (
  outcome: PhotoRemoval,
  name: string,
): PhotoRemovalSays =>
  match(outcome)
    .returnType<PhotoRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: `${name}を外しました。`,
    }))
    // The photo, or the record, was taken away meanwhile
    .with({ type: 'notFound' }, () => ({
      type: 'refused',
      message: 'この写真は、その間に外されていました。',
    }))
    // The role of the account changed meanwhile
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: 'このアカウントでは、施術写真を外せません。',
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message:
        '施術写真を外せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
