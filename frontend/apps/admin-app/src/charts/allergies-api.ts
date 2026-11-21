import {
  FAILED,
  type Forbidden,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  REFUSED_PARTS,
  type RefusedValue,
  refusedValuesOf,
  toTheEnd,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsCustomerAllergyCreateRequest,
  type ModelsCustomerAllergyResponse,
  type ModelsCustomerAllergyUpdateRequest,
  medicalChartCrudAddAllergy,
  medicalChartCrudListAllergies,
  medicalChartCrudRemoveAllergy,
  medicalChartCrudUpdateAllergy,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import * as z from 'zod/mini'
import { customerKeyOf } from '../customers/customers-api'

/*
 * The allergies of a customer, below the customer: a customer has one of
 * an allergen, with or without a chart. The API has no route that reads
 * one allergy: it is found in the list of the customer.
 */

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const idSchema = z.uuid()

/** The key of the allergies of a customer, the pages that were read: what drops the customer drops them. */
export const allergiesKeyOf = (customerId: string): string[] => [
  ...customerKeyOf(customerId),
  'allergies',
]

/** The key of an allergy that was looked for by its ID, below the list. */
export const allergyKeyOf = (
  customerId: string,
  allergyId: string,
): string[] => [...allergiesKeyOf(customerId), allergyId]

/** How many allergies a page of the list has. */
const ALLERGIES_PAGE = 20

/** A page of the allergies, of the size asked for. */
const readPage = async (
  customerId: string,
  cursor: string | undefined,
  limit: number,
): Promise<Page<ModelsCustomerAllergyResponse> | Unread> => {
  const answer = await medicalChartCrudListAllergies(customerId, {
    ...from(cursor),
    limit,
  }).catch(() => null)

  return (
    match(answer)
      .returnType<Page<ModelsCustomerAllergyResponse> | Unread>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      // The screens read the customer first, and are behind the same permission
      .with({ status: P.union(403, 404) }, () => FAILED)
      .with(P.union(...REFUSED_PARTS), unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/**
 * The allergies of a customer, the heaviest first, those of one severity
 * in the order they were recorded, a page at a time.
 */
export const readAllergyPage = (
  customerId: string,
  cursor: string | undefined,
): Promise<Page<ModelsCustomerAllergyResponse> | Unread> =>
  readPage(customerId, cursor, ALLERGIES_PAGE)

/** An allergy of a customer that was looked for by its ID. */
export type AllergyRead =
  | { type: 'found'; allergy: ModelsCustomerAllergyResponse }
  | NotFound
  | Unread

/**
 * The allergy of the ID, among those of the customer: the list is read to
 * its end in its largest pages. An ID that is none, or of an allergy of
 * another customer, is not found.
 */
export const findAllergy = async (
  customerId: string,
  allergyId: string,
): Promise<AllergyRead> => {
  if (!idSchema.safeParse(allergyId).success) {
    return NOT_FOUND
  }
  const read = await toTheEnd((cursor) =>
    readPage(customerId, cursor, LARGEST_PAGE),
  )
  if (read.type !== 'found') {
    return read
  }
  const allergy = read.items.find(({ id }) => id === allergyId.toLowerCase())

  return allergy === undefined ? NOT_FOUND : { type: 'found', allergy }
}

/** What came of an allergy that was recorded or changed. */
export type AllergyWrite =
  | { type: 'written'; allergy: ModelsCustomerAllergyResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** The customer has another allergy of the allergen */
  | { type: 'exists' }
  /** The customer left the ledger meanwhile, or another account removed the allergy */
  | NotFound
  | Forbidden
  | Unread

/** Records an allergy of a customer (`POST /medical-charts/customer/{customerId}/allergies`). */
export const addAllergy = async (
  customerId: string,
  request: ModelsCustomerAllergyCreateRequest,
): Promise<AllergyWrite> => {
  const answer = await medicalChartCrudAddAllergy(customerId, request).catch(
    () => null,
  )

  return (
    match(answer)
      .returnType<AllergyWrite>()
      .with({ status: 201 }, ({ data }) => ({
        type: 'written',
        allergy: data.data,
      }))
      .with({ status: 400 }, ({ data }) => ({
        type: 'invalid',
        values: refusedValuesOf(data),
      }))
      .with({ status: 409 }, () => ({ type: 'exists' }))
      .with({ status: 404 }, () => NOT_FOUND)
      .with({ status: 403 }, () => FORBIDDEN)
      // The body is the form, far from the limits of size and of type
      .with({ status: P.union(413, 415) }, () => FAILED)
      .with(P.union(...UNANSWERED_PARTS), unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/**
 * Changes an allergy of a customer
 * (`PATCH /medical-charts/customer/{customerId}/allergies/{allergyId}`):
 * what the request names, and nothing else. The API answers 404 both for
 * a customer who left the ledger and for an allergy that was removed.
 */
export const updateAllergy = async (
  customerId: string,
  allergyId: string,
  request: ModelsCustomerAllergyUpdateRequest,
): Promise<AllergyWrite> => {
  const answer = await medicalChartCrudUpdateAllergy(
    customerId,
    allergyId,
    request,
  ).catch(() => null)

  return match(answer)
    .returnType<AllergyWrite>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      allergy: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'exists' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of an allergy that was to be removed. */
export type AllergyRemoval = { type: 'removed' } | NotFound | Forbidden | Unread

/**
 * Removes an allergy that was recorded by mistake
 * (`DELETE /medical-charts/customer/{customerId}/allergies/{allergyId}`).
 * As a change, a 404 is a customer who left the ledger or an allergy that
 * was removed meanwhile.
 */
export const removeAllergy = async (
  customerId: string,
  allergyId: string,
): Promise<AllergyRemoval> => {
  const answer = await medicalChartCrudRemoveAllergy(
    customerId,
    allergyId,
  ).catch(() => null)

  return match(answer)
    .returnType<AllergyRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union(...REFUSED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
