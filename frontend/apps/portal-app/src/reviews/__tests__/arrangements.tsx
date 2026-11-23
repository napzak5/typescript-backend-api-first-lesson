import type {
  ModelsReviewCreateRequest,
  ModelsReviewReportRequest,
  ModelsReviewUpdateRequest,
  ReviewCrudCreate201,
} from '@beauty-salon-frontend/api-client'
import { idOf, testApi } from '@beauty-salon-frontend/testing/api'
import { KENJI, OPERATOR, OWNER } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import { expect } from 'vitest'
import * as z from 'zod'
import { accessTokenOf } from '../../bookings/__tests__/arrangements'

/*
 * What the tests of the review screens start from, and how they bring it
 * about. The customer of these tests is the second of the seed data, Kenji
 * Yamamoto: he went to Hair & Spa Osaka twice, both times to Takeshi Ito,
 * wrote about the first visit, and has not written about the second. The
 * fourth, Hiroshi Nakamura, wrote about a visit to Beauty Studio Tokyo
 * that two members of the staff took: Mika Suzuki, and Hiroshi Tanaka for
 * one of its services.
 *
 * What a test starts from is written as a customer or a salon writes it:
 * through the API.
 */

export const TAKESHI = 'Takeshi Ito'

/** What Kenji wrote about his first visit, in the seed data */
export const WRITTEN = {
  title: 'Great experience',
  comment:
    'Really enjoyed my visit. The stylist understood exactly what I wanted.',
}

// --- What the tests ask of the database

const visitSchema = z.array(
  z.object({
    id: z.uuid(),
    bookingNumber: z.string(),
    salonId: z.uuid(),
    salon: z.string(),
    customerId: z.uuid(),
    staffId: z.uuid(),
    staff: z.string(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    reviewId: z.uuid().nullable(),
  }),
)

export type Visit = z.infer<typeof visitSchema>[number]

/** The visits of a customer that took place, the earliest first, each with its review when it has one. */
const visitsOf = async (email: string): Promise<Visit[]> =>
  visitSchema.parse(
    await testApi().query(
      `select bookings.id::text, bookings."bookingNumber", bookings."salonId"::text, salons.name as salon,
              bookings."customerId"::text, bookings."staffId"::text, staff."displayName" as staff,
              to_char(bookings."startTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "startTime",
              to_char(bookings."endTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "endTime",
              (select reviews.id::text from reviews where reviews."bookingId" = bookings.id) as "reviewId"
       from bookings
       join customers on customers.id = bookings."customerId"
       join salons on salons.id = bookings."salonId"
       join staff on staff.id = bookings."staffId"
       where customers.email = $1 and bookings.status = 'completed'
       order by bookings."startTime"`,
      [email],
    ),
  )

/** The visit of a customer that nobody has written about. */
export const visitToReview = async (email = KENJI.email): Promise<Visit> => {
  const found = (await visitsOf(email)).find(
    ({ reviewId }) => reviewId === null,
  )
  if (found === undefined) {
    throw new Error(`Every visit of ${email} has its review`)
  }

  return found
}

/** The visit of a customer that has its review, and the ID of the review. */
export const visitReviewed = async (
  email = KENJI.email,
): Promise<Visit & { reviewId: string }> => {
  for (const visit of await visitsOf(email)) {
    const { reviewId } = visit
    if (reviewId !== null) {
      return { ...visit, reviewId }
    }
  }
  throw new Error(`No visit of ${email} has a review`)
}

/** A booking of a customer that is no visit that took place: it waits for its day. */
export const bookingToCome = (email: string): Promise<string> =>
  idOf(
    `select bookings.id::text
       from bookings join customers on customers.id = bookings."customerId"
       where customers.email = $1 and bookings.status in ('pending', 'confirmed')
       order by bookings."startTime" limit 1`,
    [email],
  )

const rating = z.number().int().nullable()

const storedSchema = z
  .array(
    z.object({
      id: z.uuid(),
      customer: z.string(),
      salon: z.string(),
      staff: z.string().nullable(),
      overallRating: z.number().int(),
      serviceRating: rating,
      staffRating: rating,
      atmosphereRating: rating,
      cleanlinessRating: rating,
      valueRating: rating,
      title: z.string().nullable(),
      comment: z.string().nullable(),
      imageUrls: z.array(z.string()),
      ownerResponse: z.string().nullable(),
      updatedAt: z.string(),
    }),
  )
  .max(1)

/** The review of a visit as it is stored; `null` when the visit has none. */
export const storedReviewOf = async (bookingId: string) => {
  const [row] = storedSchema.parse(
    await testApi().query(
      `select reviews.id::text, customers.email as customer, salons.name as salon,
              (select staff."displayName" from staff where staff.id = reviews."staffId") as staff,
              reviews."overallRating", reviews."serviceRating", reviews."staffRating", reviews."atmosphereRating",
              reviews."cleanlinessRating", reviews."valueRating", reviews.title, reviews.comment, reviews."imageUrls",
              reviews."ownerResponse", reviews."updatedAt"::text
       from reviews
       join customers on customers.id = reviews."customerId"
       join salons on salons.id = reviews."salonId"
       where reviews."bookingId" = $1`,
      [bookingId],
    ),
  )

  return row ?? null
}

const listedSchema = z.array(
  z.object({
    id: z.uuid(),
    salon: z.string(),
    title: z.string().nullable(),
    posted: z.string(),
    /** The day it was posted on at its salon, as the formats are given it: `2026-11-10` */
    postedOn: z.iso.date(),
  }),
)

/**
 * What a customer wrote as it is stored, the latest first, which is the
 * order of their list; each with the day it was posted on at its salon.
 */
export const storedReviewsOf = async (email = KENJI.email) =>
  listedSchema.parse(
    await testApi().query(
      `select reviews.id::text, salons.name as salon, reviews.title,
              to_char(reviews."createdAt" at time zone salons.timezone, 'YYYY"年"FMMM"月"FMDD"日"') as posted,
              to_char(reviews."createdAt" at time zone salons.timezone, 'YYYY-MM-DD') as "postedOn"
       from reviews
       join customers on customers.id = reviews."customerId"
       join salons on salons.id = reviews."salonId"
       where customers.email = $1
       order by reviews."createdAt" desc, reviews.id desc`,
      [email],
    ),
  )

const countedSchema = z.tuple([z.object({ reviewCount: z.number().int() })])

/** How many reviews a salon has, as the API counted them at the last write. */
export const reviewCountOf = async (salon: string): Promise<number> => {
  const [{ reviewCount }] = countedSchema.parse(
    await testApi().query(`select "reviewCount" from salons where name = $1`, [
      salon,
    ]),
  )

  return reviewCount
}

/**
 * Reviews in numbers: a visit has one review, so as many earlier visits of
 * the customer with a review each, a week apart, each written the day
 * after its visit. The review of the latest of them is 'Earlier visit 1'.
 */
export const insertReviews = (email: string, count: number) =>
  testApi().query(
    `with visits as (
       insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate", "startTime", "endTime",
                             duration, status, subtotal, "discountAmount", "taxAmount", "totalAmount", "completedAt")
       select 'EARLIER-' || n, visit."salonId", visit."customerId", visit."staffId", visit."bookingDate" - 7 * n,
              visit."startTime" - n * interval '7 days', visit."endTime" - n * interval '7 days',
              visit.duration, 'completed', visit.subtotal, visit."discountAmount", visit."taxAmount", visit."totalAmount",
              visit."endTime" - n * interval '7 days'
       from (select bookings.*
             from bookings join customers on customers.id = bookings."customerId"
             where customers.email = $1 and bookings.status = 'completed'
             order by bookings."startTime" limit 1) visit
       cross join generate_series(1, $2::int) n
       returning id, "bookingNumber", "salonId", "customerId", "completedAt"
     )
     insert into reviews ("salonId", "customerId", "bookingId", "overallRating", title, comment, "isVerified", "createdAt")
     select "salonId", "customerId", id, 4, replace("bookingNumber", 'EARLIER-', 'Earlier visit '), 'As good as ever', true,
            "completedAt" + interval '1 day'
     from visits`,
    [email, count],
  )

/** A salon is removed: what the removal does to its row. */
export const salonIsRemoved = (name: string) =>
  testApi().query(`update salons set "deletedAt" = now() where name = $1`, [
    name,
  ])

/**
 * A salon removes a member of its staff: what the removal does to its
 * ledger. (The API refuses it while the member has a booking to come, so
 * the test writes it.)
 */
export const staffIsRemoved = (displayName: string) =>
  testApi().query(
    `update staff set "deletedAt" = now() where "displayName" = $1`,
    [displayName],
  )

// --- What the tests ask of the API, as a client that is no screen does

const send = async (
  method: string,
  path: string,
  body: unknown,
  email: string,
): Promise<Response> =>
  fetch(`${testApi().origin}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessTokenOf(email)}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

/** What a test reads of a review it wrote: its ID */
const writtenSchema = z.object({
  data: z.object({ id: z.uuid() }),
}) satisfies z.ZodType<{ data: Pick<ReviewCrudCreate201['data'], 'id'> }>

/** What a customer wrote about a visit somewhere else: in another tab, or a while ago. */
export const writes = async (
  visit: Visit,
  said: Partial<ModelsReviewCreateRequest> = {},
  email = KENJI.email,
): Promise<string> => {
  const request: ModelsReviewCreateRequest = {
    salonId: visit.salonId,
    customerId: visit.customerId,
    bookingId: visit.id,
    staffId: visit.staffId,
    overallRating: 4,
    serviceRating: null,
    staffRating: null,
    atmosphereRating: null,
    cleanlinessRating: null,
    valueRating: null,
    title: null,
    comment: null,
    imageUrls: [],
    ...said,
  }
  const answer = await send('POST', '/reviews', request, email)
  expect(answer.status).toBe(201)

  return writtenSchema.parse(await answer.json()).data.id
}

/** What a customer changed of a review somewhere else. */
export const changes = async (
  reviewId: string,
  changed: ModelsReviewUpdateRequest,
  email = KENJI.email,
): Promise<void> => {
  const answer = await send('PATCH', `/reviews/${reviewId}`, changed, email)
  expect(answer.status).toBe(200)
}

/** A review is removed somewhere else: by the customer who wrote it, or by an administrator. */
export const removes = async (
  reviewId: string,
  email = KENJI.email,
): Promise<void> => {
  const answer = await send('DELETE', `/reviews/${reviewId}`, undefined, email)
  expect(answer.status).toBe(204)
}

/** The salon answers a review. */
export const answers = async (
  reviewId: string,
  ownerResponse: string,
  email = OWNER,
): Promise<void> => {
  const answer = await send(
    'POST',
    `/reviews/${reviewId}/respond`,
    { ownerResponse },
    email,
  )
  expect(answer.status).toBe(200)
}

/** A customer says somewhere else that a review was helpful. */
export const findsHelpful = async (
  reviewId: string,
  email: string,
): Promise<void> => {
  const answer = await send(
    'POST',
    `/reviews/${reviewId}/helpful`,
    undefined,
    email,
  )
  expect(answer.status).toBe(200)
}

/** A customer reports a review somewhere else. */
export const reports = async (
  reviewId: string,
  request: ModelsReviewReportRequest,
  email = KENJI.email,
): Promise<void> => {
  const answer = await send(
    'POST',
    `/reviews/${reviewId}/report`,
    request,
    email,
  )
  expect(answer.status).toBe(200)
}

/** An administrator dismisses the report of an account about a review. */
export const dismissesReportOf = async (
  reviewId: string,
  reporter = KENJI.email,
): Promise<void> => {
  const id = await idOf(
    `select reports.id::text
       from review_reports reports join users on users.id = reports."reportedBy"
       where reports."reviewId" = $1 and users.email = $2`,
    [reviewId, reporter],
  )
  const answer = await send(
    'POST',
    `/review-reports/${id}/dismiss`,
    undefined,
    OPERATOR,
  )
  expect(answer.status).toBe(200)
}

// --- What the tests read on the screen

/** A part of a page: the region of its heading. */
export const region = (name: string) => screen.findByRole('region', { name })

/** The names and the values of a record, as a description list shows them. */
export const detailsIn = (part: HTMLElement): Record<string, string | null> =>
  Object.fromEntries(
    within(part)
      .getAllByRole('term')
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? null,
      ]),
  )

/** What stands on the page, paragraph by paragraph. */
export const paragraphsIn = (part: HTMLElement): (string | null)[] =>
  within(part)
    .getAllByRole('paragraph')
    .map((paragraph) => paragraph.textContent)

const day = (moment: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'full',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(moment))

const timeOfDay = (moment: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(moment))

/** When a visit was, as a screen says it. */
export const whenOf = ({
  startTime,
  endTime,
}: Pick<Visit, 'startTime' | 'endTime'>): string =>
  `${day(startTime)} ${timeOfDay(startTime)}〜${timeOfDay(endTime)}`

// --- The form of a review

export const overall = () =>
  screen.findByRole('radiogroup', { name: '総合の評価' })
export const ratingOf = (name: string) => screen.getByRole('radio', { name })
export const select = (name: string) => screen.getByRole('combobox', { name })
export const text = (name: string) => screen.getByRole('textbox', { name })
export const button = (name: string) => screen.getByRole('button', { name })

/** The names of the selects of the form, in the order of the page. */
export const selects = (): (string | null)[] =>
  screen.getAllByRole('combobox').map((control) => control.getAttribute('name'))
