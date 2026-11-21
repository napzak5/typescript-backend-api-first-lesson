import type {
  ModelsStaffProfileResponse,
  ModelsStaffProfileUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import { type Read, textOf } from '@beauty-salon-frontend/salon-screens'
import * as z from 'zod'
import { nullIfBlank } from '../bookings/booking-entry'
import { tagsIn } from '../customers/customer-ledger'
import { numberOf } from '../treatments/treatment-form'

/*
 * How a member of the staff is introduced to the customers: the five values
 * that the staff ledger writes, and that the member writes of themselves on
 * the screen of their profile. Both forms read them here, in the same
 * words, as the API holds both to the same rules.
 */

/** The introduction of a member, as a form sends it whole */
type Introduction = Required<ModelsStaffProfileUpdateRequest>

/** The introduction of a member as the API answers it, in the ledger or in the profile */
export type Introduced = Pick<
  ModelsStaffProfileResponse,
  'specialties' | 'bio' | 'imageUrl' | 'yearsOfExperience' | 'certifications'
>

const LONGEST_URL = 500
const MOST_YEARS = 100

const YEARS_ERROR = `経験年数は、0 から ${MOST_YEARS} までの整数で入力してください。`

/** What is said at the address of the photograph, before it is sent and when the API refused it */
export const URL_ERROR = `http:// か https:// で始まる URL を、${LONGEST_URL} 文字までで入力してください。`

const webAddressSchema = z.httpUrl().check(z.maxLength(LONGEST_URL))

/** A number up to `most` that may be left empty; `undefined` for what is none. */
export const optionalNumberUpTo = (
  text: string,
  decimals: number,
  most: number,
): number | null | undefined => {
  const number = numberOf(text, decimals)

  return number === null || (number !== undefined && number <= most)
    ? number
    : undefined
}

/**
 * The introduction a form holds: the specialties and the certifications
 * as lists, and a control that was left empty as `null`.
 */
export const readIntroduction = (values: FormData): Read<Introduction> => {
  const optional = (name: string): string | null =>
    nullIfBlank(textOf(values, name).trim())
  const yearsOfExperience = optionalNumberUpTo(
    textOf(values, 'yearsOfExperience').trim(),
    0,
    MOST_YEARS,
  )
  const imageUrl = optional('imageUrl')
  const urlTaken =
    imageUrl === null || webAddressSchema.safeParse(imageUrl).success
  if (yearsOfExperience === undefined || !urlTaken) {
    return {
      type: 'invalid',
      errors: {
        ...(yearsOfExperience === undefined
          ? { yearsOfExperience: YEARS_ERROR }
          : {}),
        ...(urlTaken ? {} : { imageUrl: URL_ERROR }),
      },
    }
  }

  return {
    type: 'valid',
    request: {
      specialties: tagsIn(textOf(values, 'specialties')),
      bio: optional('bio'),
      imageUrl,
      yearsOfExperience,
      certifications: tagsIn(textOf(values, 'certifications')),
    },
  }
}

/** A text as the form reads it back: without the spaces around it, nothing as `null`. */
export const shownText = (text: string | null): string | null =>
  nullIfBlank(text ?? '')

const sameList = (one: string[], other: string[]): boolean =>
  JSON.stringify(one) === JSON.stringify(other)

/**
 * The values of an introduction that were sent other than those it was
 * shown with, each compared as the form reads it.
 */
export const introductionChangesOf = (
  sent: Introduction,
  shown: Introduced,
): ModelsStaffProfileUpdateRequest => ({
  ...(sameList(sent.specialties, shown.specialties)
    ? {}
    : { specialties: sent.specialties }),
  ...(sent.bio === shownText(shown.bio) ? {} : { bio: sent.bio }),
  ...(sent.imageUrl === shownText(shown.imageUrl)
    ? {}
    : { imageUrl: sent.imageUrl }),
  ...(sent.yearsOfExperience === shown.yearsOfExperience
    ? {}
    : { yearsOfExperience: sent.yearsOfExperience }),
  ...(sameList(sent.certifications, shown.certifications)
    ? {}
    : { certifications: sent.certifications }),
})

/** The control a value of a request is entered at: every specialty at one, every certification at one. */
export const controlOf = (field: string): string =>
  field.replace(/^(specialties|certifications)\.\d+$/, '$1')

/** The controls of an introduction */
export const INTRODUCTION_CONTROLS: readonly string[] = [
  'specialties',
  'certifications',
  'yearsOfExperience',
  'bio',
  'imageUrl',
]
