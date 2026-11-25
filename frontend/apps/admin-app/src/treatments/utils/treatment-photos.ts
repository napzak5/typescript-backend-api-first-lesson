import {
  CHECK_THE_VALUES_MESSAGE,
  type RefusedValue,
  TOO_MANY_REQUESTS_MESSAGE,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsTreatmentPhotoBulkCreateRequest,
  type ModelsTreatmentPhotoCreateRequest,
  type ModelsTreatmentPhotoResponse,
  ModelsTreatmentPhotoType,
  type ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import {
  tooLongError,
  tooLongOf,
  WEB_ADDRESS_ERROR,
  webAddressError,
} from '@beauty-salon-frontend/fields'
import {
  aboutTheAttempt,
  errorAt,
  type FormErrors,
  type FormRead,
  type FormSays,
  type NamedChoice,
  textOf,
  textOrNull,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { PhotoRemoval, PhotosAdding } from '../api/treatments-api'

const { photos: PHOTOS } = adminTreatmentMessages
const { errors: ERRORS } = PHOTOS

/*
 * The photos of a treatment record: how they are named, the form that adds
 * them, and what is said after they were added or one was taken away. The
 * API keeps the address of a photo, not its file. A photo is a row of
 * controls named by the number the row has now, counted from 0
 * (`photos.1.photoUrl`), as the API names what is wrong with one.
 */

/** The most photos a record holds */
export const MOST_PHOTOS = 20
/** The longest direction a photo was taken from, as the API takes it */
export const LONGEST_ANGLE = 50

/** What is wrong with the values of the form of the photos, under the names of its controls */
type Errors = FormErrors<LocalizedText>

const PHOTO_TYPE_NAMES: Record<ModelsTreatmentPhotoType, LocalizedText> =
  PHOTOS.types

/** When a photo may have been taken, in the order of a treatment */
export const PHOTO_TYPE_CHOICES: readonly NamedChoice[] = Object.values(
  ModelsTreatmentPhotoType,
).map((photoType) => ({ value: photoType, label: PHOTO_TYPE_NAMES[photoType] }))

/** What a photo shows, as its image is named: 「施術後の写真（正面）」. */
export const photoNameOf = ({
  photoType,
  angle,
}: Pick<ModelsTreatmentPhotoResponse, 'photoType' | 'angle'>): LocalizedText =>
  PHOTOS.photoOf(PHOTO_TYPE_NAMES[photoType], angle)

/** How a photo may be used, as the customer agreed. */
export const photoUseOf = ({
  isPublic,
  customerConsent,
}: Pick<
  ModelsTreatmentPhotoResponse,
  'isPublic' | 'customerConsent'
>): LocalizedText =>
  isPublic
    ? PHOTOS.use.public
    : customerConsent
      ? PHOTOS.use.inside
      : PHOTOS.use.withoutConsent

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

const ANGLE_TOO_LONG = tooLongOf(PHOTOS.form.angle, LONGEST_ANGLE)

/** What is said when the record has no room for the photos of the form */
const noRoomOf = (room: number): LocalizedText =>
  ERRORS.noRoom(room, MOST_PHOTOS)
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
): [string, LocalizedText][] => {
  const angle = textOrNull(filled.angle)
  const repeated = earlier.findIndex(
    ({ photoUrl }) => photoUrl === filled.photoUrl,
  )

  return [
    ...errorAt(
      photoControlOf(index, 'photoType'),
      photoTypeOf(filled.photoType) === undefined ? ERRORS.type : undefined,
    ),
    ...errorAt(
      photoControlOf(index, 'photoUrl'),
      filled.photoUrl === ''
        ? ERRORS.photoUrl
        : webAddressError(filled.photoUrl) !== undefined
          ? WEB_ADDRESS_ERROR
          : repeated !== -1
            ? ERRORS.repeated(repeated + 1)
            : held.some(({ photoUrl }) => photoUrl === filled.photoUrl)
              ? ERRORS.held
              : undefined,
    ),
    ...errorAt(
      photoControlOf(index, 'thumbnailUrl'),
      webAddressError(textOrNull(filled.thumbnailUrl)),
    ),
    ...errorAt(
      photoControlOf(index, 'angle'),
      tooLongError(angle, LONGEST_ANGLE, ANGLE_TOO_LONG),
    ),
    ...errorAt(
      photoControlOf(index, 'isPublic'),
      filled.isPublic && !filled.customerConsent
        ? ERRORS.withoutConsent
        : undefined,
    ),
  ]
}

type PhotoRead =
  | { type: 'valid'; photo: ModelsTreatmentPhotoCreateRequest }
  | { type: 'invalid'; errors: [string, LocalizedText][] }

/** The row of the number `index`: the photo at the place `sortOrder` of the record, or what is wrong with it. */
const readPhoto = (
  index: number,
  filled: FilledPhoto,
  earlier: readonly FilledPhoto[],
  held: readonly ModelsTreatmentPhotoResponse[],
  sortOrder: number,
): PhotoRead => {
  const photoType = photoTypeOf(filled.photoType)
  const errors = photoErrorsOf(index, filled, earlier, held)
  if (photoType === undefined || errors.length > 0) {
    return { type: 'invalid', errors }
  }

  return {
    type: 'valid',
    photo: {
      photoType,
      photoUrl: filled.photoUrl,
      thumbnailUrl: textOrNull(filled.thumbnailUrl),
      angle: textOrNull(filled.angle),
      description: textOrNull(filled.description),
      isPublic: filled.isPublic,
      customerConsent: filled.customerConsent,
      sortOrder,
    },
  }
}

/** The photos that were filled in, or what is wrong with them; and none, when the record has no room for them. */
export type PhotosRead =
  | FormRead<ModelsTreatmentPhotoBulkCreateRequest, Errors>
  | { type: 'noRoom'; message: LocalizedText }

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
  const next = Math.max(-1, ...record.photos.map(({ sortOrder }) => sortOrder))
  const rows = filled.map((photo, index) =>
    readPhoto(
      index,
      photo,
      filled.slice(0, index),
      record.photos,
      next + 1 + index,
    ),
  )
  // The rows are parted before the check: those that are valid are sent when no row is wrong
  const photos = rows.flatMap((row) =>
    row.type === 'valid' ? [row.photo] : [],
  )
  const errors = rows.flatMap((row) =>
    row.type === 'invalid' ? row.errors : [],
  )
  if (errors.length > 0) {
    return { type: 'invalid', errors: Object.fromEntries(errors) }
  }
  // A record that came to hold more photos meanwhile has less room than the form has rows
  const room = roomOf(record)
  if (filled.length > room) {
    return { type: 'noRoom', message: noRoomOf(room) }
  }

  return { type: 'valid', value: { photos } }
}

const PHOTO_FIELD =
  /^photos\.(\d+)\.(photoType|photoUrl|thumbnailUrl|angle|isPublic)$/

/** What the API says is wrong with a control of a photo, in the words of the form. */
const photoSaidOf = (name: string): LocalizedText =>
  match(name)
    .returnType<LocalizedText>()
    .with('photoType', () => ERRORS.type)
    .with('angle', () => ANGLE_TOO_LONG)
    .with('isPublic', () => ERRORS.withoutConsent)
    .otherwise(() => WEB_ADDRESS_ERROR)

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
): FormSays<LocalizedText> =>
  match(outcome)
    .returnType<FormSays<LocalizedText>>()
    .with({ type: 'invalid' }, ({ values }) => {
      const said = values.flatMap(
        ({ field }: RefusedValue): [string, LocalizedText][] => {
          const photo = PHOTO_FIELD.exec(field)

          return photo?.[2] === undefined
            ? []
            : [[field, photoSaidOf(photo[2])]]
        },
      )

      return {
        message:
          said.length < values.length ? CHECK_THE_VALUES_MESSAGE : undefined,
        errors: Object.fromEntries(said.toReversed()),
      }
    })
    .with({ type: 'held' }, ({ record }) => {
      const errors = request.photos.flatMap(
        ({ photoUrl }, index): [string, LocalizedText][] =>
          record.photos.some((photo) => photo.photoUrl === photoUrl)
            ? [[photoControlOf(index, 'photoUrl'), ERRORS.held]]
            : [],
      )

      return errors.length > 0
        ? { message: undefined, errors: Object.fromEntries(errors) }
        : aboutTheAttempt(noRoomOf(roomOf(record)))
    })
    .with({ type: 'forbidden' }, () => aboutTheAttempt(PHOTOS.forbidden))
    .with({ type: 'tooManyRequests' }, () =>
      aboutTheAttempt(TOO_MANY_REQUESTS_MESSAGE),
    )
    .with({ type: 'failed' }, () => aboutTheAttempt(PHOTOS.failed))
    .exhaustive()

/** What is said after a photo was to be taken away. */
export type PhotoRemovalSays =
  | { type: 'done'; message: LocalizedText }
  /** What can be tried again: said in the dialog */
  | { type: 'again'; message: LocalizedText }
  /** What changed meanwhile: said above the photos, which are read again */
  | { type: 'refused'; message: LocalizedText }

/** What is said after a photo was to be taken away; the photo is named as its image is. */
export const afterPhotoRemoval = (
  outcome: PhotoRemoval,
  photo: LocalizedText,
): PhotoRemovalSays =>
  match(outcome)
    .returnType<PhotoRemovalSays>()
    .with({ type: 'removed' }, () => ({
      type: 'done',
      message: PHOTOS.removal.done(photo),
    }))
    // The photo, or the record, was taken away meanwhile
    .with({ type: 'notFound' }, () => ({
      type: 'refused',
      message: PHOTOS.removal.gone,
    }))
    // The role of the account changed meanwhile
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: PHOTOS.removal.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: PHOTOS.removal.failed,
    }))
    .exhaustive()
