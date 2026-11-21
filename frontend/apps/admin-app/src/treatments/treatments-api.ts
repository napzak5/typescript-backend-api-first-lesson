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
  type RefusedValue,
  refusedValuesOf,
  toTheEnd,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsCustomerResponse,
  type ModelsTreatmentPhotoBulkCreateRequest,
  type ModelsTreatmentPhotoResponse,
  type ModelsTreatmentRecordCreateRequest,
  type ModelsTreatmentRecordResponse,
  type ModelsTreatmentRecordUpdateRequest,
  type ModelsTreatmentStatisticsResponse,
  type TreatmentRecordCrudListParams,
  treatmentRecordCrudAddPhotos,
  treatmentRecordCrudCreate,
  treatmentRecordCrudDelete,
  treatmentRecordCrudGet,
  treatmentRecordCrudGetStatistics,
  treatmentRecordCrudList,
  treatmentRecordCrudRemovePhoto,
  treatmentRecordCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import {
  dayAfter,
  type Period,
  startOfDayAt,
} from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'
import * as z from 'zod'
import { readCustomers } from '../customers/customers-api'

/*
 * The treatment records of a salon: what was done at a visit, written by
 * the member of the staff who did it. A booking has one record at most;
 * the salon of a record is that of its booking.
 */

const UNANSWERED = P.union(...UNANSWERED_PARTS)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const idSchema = z.uuid()

/** The key of every list of treatment records that was read, and of the record of every booking */
export const TREATMENT_LISTS = ['treatments']

/** The key of a treatment record */
export const treatmentKeyOf = (treatmentId: string): string[] => [
  'treatment',
  treatmentId.toLowerCase(),
]

/** The key of the treatment record of a booking: a list, below the lists */
export const treatmentOfBookingKeyOf = (bookingId: string): string[] => [
  ...TREATMENT_LISTS,
  'booking',
  bookingId,
]

/** Which records the list shows: the names are those of the query of the address. */
export type TreatmentConditions = {
  /** The member of the staff who did the treatment */
  staff?: string
  /** The customer who had it */
  customer?: string
  /** The first day it was written on, at the salon */
  from?: string
  /** The last day it was written on, at the salon */
  to?: string
}

/**
 * What the API is asked for: the days at the salon as the moments they
 * begin and end. The end of a day is the moment before the next one begins.
 */
export const treatmentListParamsOf = (
  salonId: string,
  { staff, customer, from: first, to: last }: TreatmentConditions,
  timezone: string,
): Omit<TreatmentRecordCrudListParams, 'cursor' | 'limit'> => {
  const startDate =
    first === undefined ? undefined : startOfDayAt(first, timezone)
  const nextDay =
    last === undefined ? undefined : startOfDayAt(dayAfter(last, 1), timezone)

  return {
    salonId,
    ...(staff === undefined ? {} : { staffId: staff }),
    ...(customer === undefined ? {} : { customerId: customer }),
    ...(startDate === undefined ? {} : { startDate }),
    ...(nextDay === undefined
      ? {}
      : { endDate: new Date(Date.parse(nextDay) - 1).toISOString() }),
  }
}

/** A record that was found, and its customer; `undefined` for one who left the ledger. */
export type FoundTreatment = {
  record: ModelsTreatmentRecordResponse
  customer: ModelsCustomerResponse | undefined
}

/**
 * A page of the records of a salon that meet the conditions, the latest
 * written first, with their customers, who are read at once: a record
 * holds the ID of its customer only.
 */
export const readTreatmentPage = async (
  salonId: string,
  conditions: TreatmentConditions,
  timezone: string,
  cursor: string | undefined,
): Promise<Page<FoundTreatment> | Unread> => {
  const answer = await treatmentRecordCrudList({
    ...treatmentListParamsOf(salonId, conditions, timezone),
    ...from(cursor),
  }).catch(() => null)
  if (answer?.status !== 200) {
    return (
      match(answer)
        .returnType<Unread>()
        // The screens of a salon are behind the same permission as its records
        .with({ status: 403 }, () => FAILED)
        .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
        .exhaustive(outsideTheContract)
    )
  }
  const records = answer.data.data
  const customers = await readCustomers(
    records.map(({ customerId }) => customerId),
  )
  if (customers.type !== 'found') {
    return customers
  }

  return pageOf(
    records.map((record) => ({
      record,
      customer: customers.customers.get(record.customerId),
    })),
    answer.data.meta,
  )
}

/** The record of a booking; `null` while none was written. */
export type TreatmentOfBookingRead =
  | { type: 'found'; record: ModelsTreatmentRecordResponse | null }
  | Unread

/**
 * The record of a booking. The list of the API is not narrowed by booking:
 * the records of its customer at the salon are read to their end, and the
 * one of the booking is looked for among them.
 */
export const findTreatmentOfBooking = async ({
  salonId,
  customerId,
  bookingId,
}: {
  salonId: string
  customerId: string
  bookingId: string
}): Promise<TreatmentOfBookingRead> => {
  const read = await toTheEnd(async (cursor) => {
    const answer = await treatmentRecordCrudList({
      salonId,
      customerId,
      ...from(cursor),
      limit: LARGEST_PAGE,
    }).catch(() => null)

    return match(answer)
      .returnType<Page<ModelsTreatmentRecordResponse> | Unread>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 403 }, () => FAILED)
      .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
      .exhaustive(outsideTheContract)
  })
  if (read.type !== 'found') {
    return read
  }

  return {
    type: 'found',
    record: read.items.find((record) => record.bookingId === bookingId) ?? null,
  }
}

export type TreatmentRead =
  | { type: 'found'; record: ModelsTreatmentRecordResponse }
  /** No record has the ID, or it is of another salon, or it was removed */
  | NotFound
  | Unread

/** A treatment record (`GET /treatments/{id}`); an address that names no ID names no record. */
export const readTreatment = async (id: string): Promise<TreatmentRead> => {
  if (!idSchema.safeParse(id).success) {
    return NOT_FOUND
  }
  const answer = await treatmentRecordCrudGet(id).catch(() => null)

  return match(answer)
    .returnType<TreatmentRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', record: data.data }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FAILED)
    .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of a record that was written or changed. */
export type TreatmentWrite =
  | { type: 'written'; record: ModelsTreatmentRecordResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** Another account wrote the record of the booking meanwhile */
  | { type: 'exists'; treatmentId: string }
  /** The booking is no longer under treatment nor completed: it was cancelled meanwhile */
  | { type: 'notBegun' }
  /** The booking, or the record that is changed, was removed meanwhile */
  | NotFound
  | Forbidden
  | Unread

/**
 * Writes the record of a booking (`POST /treatments`). The API answers 409
 * both for a booking that has a record and for one whose treatment has not
 * begun: the record of the booking is looked for, to tell which.
 */
export const createTreatment = async (
  salonId: string,
  request: ModelsTreatmentRecordCreateRequest,
): Promise<TreatmentWrite> => {
  const answer = await treatmentRecordCrudCreate(request).catch(() => null)
  if (answer?.status === 409) {
    const read = await findTreatmentOfBooking({
      salonId,
      customerId: request.customerId,
      bookingId: request.bookingId,
    })
    if (read.type !== 'found') {
      return read
    }

    return read.record === null
      ? { type: 'notBegun' }
      : { type: 'exists', treatmentId: read.record.id }
  }

  return (
    match(answer)
      .returnType<TreatmentWrite>()
      .with({ status: 201 }, ({ data }) => ({
        type: 'written',
        record: data.data,
      }))
      .with({ status: 400 }, ({ data }) => {
        const values = refusedValuesOf(data)

        // The booking is refused as a value of the body when it was removed
        return values.some(({ field }) => field === 'bookingId')
          ? NOT_FOUND
          : { type: 'invalid', values }
      })
      .with({ status: 403 }, () => FORBIDDEN)
      // The body is the form, far from the limits of size and of type
      .with({ status: P.union(413, 415) }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/** Changes a record (`PATCH /treatments/{id}`): what the request names, and nothing else. */
export const updateTreatment = async (
  id: string,
  request: ModelsTreatmentRecordUpdateRequest,
): Promise<Exclude<TreatmentWrite, { type: 'exists' | 'notBegun' }>> => {
  const answer = await treatmentRecordCrudUpdate(id, request).catch(() => null)

  return match(answer)
    .returnType<Exclude<TreatmentWrite, { type: 'exists' | 'notBegun' }>>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      record: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of the removal of a record. */
export type TreatmentRemoval =
  | { type: 'removed' }
  | NotFound
  | Forbidden
  | Unread

/** Removes a record with its materials and photos (`DELETE /treatments/{id}`). */
export const removeTreatment = async (
  id: string,
): Promise<TreatmentRemoval> => {
  const answer = await treatmentRecordCrudDelete(id).catch(() => null)

  return match(answer)
    .returnType<TreatmentRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of photos that were to be added to a record. */
export type PhotosAdding =
  | { type: 'added'; photos: ModelsTreatmentPhotoResponse[] }
  | { type: 'invalid'; values: RefusedValue[] }
  /**
   * The record holds a photo at an address of the request, or has no room
   * for them: it was read again, as it is now
   */
  | { type: 'held'; record: ModelsTreatmentRecordResponse }
  /** The record was removed meanwhile */
  | NotFound
  | Forbidden
  | Unread

/**
 * Adds photos to a record, all of them or none (`POST /treatments/{id}/photos`).
 * The API answers 409 both for an address the record holds and for more
 * photos than it has room for: the record is read again, to tell which.
 */
export const addTreatmentPhotos = async (
  id: string,
  request: ModelsTreatmentPhotoBulkCreateRequest,
): Promise<PhotosAdding> => {
  const answer = await treatmentRecordCrudAddPhotos(id, request).catch(
    () => null,
  )
  if (answer?.status === 409) {
    const read = await readTreatment(id)

    return read.type === 'found' ? { type: 'held', record: read.record } : read
  }

  return match(answer)
    .returnType<PhotosAdding>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'added',
      photos: data.data.created,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of a photo that was to be taken away from a record. */
export type PhotoRemoval =
  | { type: 'removed' }
  /** The photo, or the record, was taken away meanwhile */
  | NotFound
  | Forbidden
  | Unread

/** Takes a photo away from a record (`DELETE /treatments/{id}/photos/{photoId}`). */
export const removeTreatmentPhoto = async (
  id: string,
  photoId: string,
): Promise<PhotoRemoval> => {
  const answer = await treatmentRecordCrudRemovePhoto(id, photoId).catch(
    () => null,
  )

  return match(answer)
    .returnType<PhotoRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
    .exhaustive(outsideTheContract)
}

/** The key of the statistics of a period: below the lists, which a write takes away */
export const treatmentStatisticsKeyOf = (
  salonId: string,
  { from, to }: Period,
): string[] => [...TREATMENT_LISTS, 'statistics', salonId, from, to]

export type TreatmentStatisticsRead =
  | { type: 'found'; statistics: ModelsTreatmentStatisticsResponse }
  | Unread

/**
 * The records a salon wrote over a period, counted
 * (`GET /treatments/statistics`): the days at the salon, as the list
 * takes them.
 */
export const readTreatmentStatistics = async (
  salonId: string,
  period: Period,
  timezone: string,
): Promise<TreatmentStatisticsRead> => {
  const { startDate, endDate } = treatmentListParamsOf(
    salonId,
    period,
    timezone,
  )
  const answer = await treatmentRecordCrudGetStatistics({
    salonId,
    ...(startDate === undefined ? {} : { startDate }),
    ...(endDate === undefined ? {} : { endDate }),
  }).catch(() => null)

  return (
    match(answer)
      .returnType<TreatmentStatisticsRead>()
      .with({ status: 200 }, ({ data }) => ({
        type: 'found',
        statistics: data.data,
      }))
      // The screens of a salon are behind the same permission as its records
      .with({ status: 403 }, () => FAILED)
      .with(P.union({ status: 400 }, UNANSWERED), unreadOf)
      .exhaustive(outsideTheContract)
  )
}
