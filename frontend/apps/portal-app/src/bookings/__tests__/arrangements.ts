import { signIn } from '@beauty-salon-frontend/session'
import { testApi } from '@beauty-salon-frontend/testing/api'
import { expect } from 'vitest'
import * as z from 'zod'

/*
 * What the tests of the booking screens start from, and how they bring it
 * about: the seed data they name, what they write into the database of the
 * test (the hours of a day, a failure), and what they ask of the API as a
 * client that is no screen does (a booking made elsewhere, an account that
 * was just registered).
 */

/** The salon the tests book at, and what of it they book */
export const TOKYO = 'Beauty Studio Tokyo'
export const LADIES_CUT = 'Ladies Cut'
export const HIROSHI = 'Hiroshi Tanaka'
export const MIKA = 'Mika Suzuki'

/** Customers of the seed data: each has an account and a profile */
export const CUSTOMER = 'customer1@example.com'
export const ANOTHER_CUSTOMER = 'customer2@example.com'

/** Somebody who registers in a test: an account without a profile */
export const NEWCOMER = 'newcomer@example.com'
export const NEWCOMER_PASSWORD = 'a passphrase that only this test knows'

/** An ID that nothing has */
export const NOTHING = '00000000-0000-4000-8000-000000000000'

/** Signs a seeded account in before the screen opens: the sign-in is not what the test is about. */
export const signedInAs = async (
  email: string,
  password = testApi().seedPassword,
): Promise<void> => {
  const outcome = await signIn({
    email,
    password,
    rememberMe: false,
    twoFactorCode: null,
  })
  expect(outcome).toMatchObject({ type: 'signedIn' })
}

// --- What the tests ask of the database

const idSchema = z.tuple([z.object({ id: z.uuid() })])

export const salonId = async (): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await testApi().query('select id::text from salons where name = $1', [
      TOKYO,
    ]),
  )

  return id
}

export const serviceId = async (name: string): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await testApi().query(
      `select services.id::text from services join salons on salons.id = services."salonId"
       where salons.name = $1 and services.name = $2`,
      [TOKYO, name],
    ),
  )

  return id
}

export const staffId = async (displayName: string): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await testApi().query(
      'select id::text from staff where "displayName" = $1',
      [displayName],
    ),
  )

  return id
}

export const bookingPathOf = async (service = LADIES_CUT): Promise<string> =>
  `/salons/${await salonId()}/services/${await serviceId(service)}/booking`

const dateSchema = z.tuple([z.object({ date: z.iso.date() })])

/** The calendar date at the salon a number of days from today. */
export const dayAhead = async (days: number): Promise<string> => {
  const [{ date }] = dateSchema.parse(
    await testApi().query(
      `select ((now() at time zone 'Asia/Tokyo')::date + $1::int)::text as date`,
      [days],
    ),
  )

  return date
}

/** Two weeks from today: the seed data has no booking that far ahead. */
export const DAYS_AHEAD = 14

/**
 * Opens the salon on the day the tests book on, from 10:00 to 13:00
 * whatever day of the week it is, and says who works then: each member of
 * the staff that is named, from their hour until 13:00, and nobody else.
 * The day is the answer.
 */
export const openDay = async (
  working: Record<string, string>,
): Promise<string> => {
  const date = await dayAhead(DAYS_AHEAD)
  await testApi().query(
    `insert into opening_hours ("salonId", "dayOfWeek", date, "openTime", "closeTime")
     select id, trim(to_char($2::date, 'day'))::day_of_week, $2::date, '10:00', '13:00'
     from salons where name = $1
     on conflict ("salonId", date) do update
     set "openTime" = excluded."openTime", "closeTime" = excluded."closeTime", "isHoliday" = false`,
    [TOKYO, date],
  )
  await testApi().query(
    `delete from staff_schedules
     where date = $2::date
       and "staffId" in (select staff.id from staff join salons on salons.id = staff."salonId" where salons.name = $1)`,
    [TOKYO, date],
  )
  await testApi().query(
    `insert into staff_schedules ("staffId", date, "startTime", "endTime", "isRecurring", "isAvailable")
     select staff.id, $2::date, hours.value::time,
            case when hours.value is null then null else time '13:00' end,
            false, hours.value is not null
     from staff
     join salons on salons.id = staff."salonId"
     left join jsonb_each_text($3::jsonb) as hours(name, value) on hours.name = staff."displayName"
     where salons.name = $1`,
    [TOKYO, date, JSON.stringify(working)],
  )

  return date
}

/** The salon is closed on the day, as on a holiday of its calendar. */
export const closeDay = async (): Promise<string> => {
  const date = await dayAhead(DAYS_AHEAD)
  await testApi().query(
    `insert into opening_hours ("salonId", "dayOfWeek", date, "openTime", "closeTime", "isHoliday")
     select id, trim(to_char($2::date, 'day'))::day_of_week, $2::date, null, null, true
     from salons where name = $1
     on conflict ("salonId", date) do update
     set "openTime" = null, "closeTime" = null, "isHoliday" = true`,
    [TOKYO, date],
  )

  return date
}

/** The moment a time of day of a date is at the salon, as the API writes it. */
export const momentAt = (date: string, time: string): string =>
  new Date(`${date}T${time}:00+09:00`).toISOString()

/**
 * Takes a table away from the API, which then answers 500 where it reads
 * it, and gives it back: an answer that went wrong, without a stub.
 */
export const takeAway = (table: string) =>
  testApi().query(`alter table ${table} rename to ${table}_away`)

export const giveBack = (table: string) =>
  testApi().query(`alter table ${table}_away rename to ${table}`)

// --- What the tests ask of the API, as a client that is no screen does

export const ask = (
  path: string,
  body: unknown,
  accessToken = '',
): Promise<Response> =>
  fetch(`${testApi().origin}/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken === '' ? {} : { Authorization: `Bearer ${accessToken}` }),
    },
    body: JSON.stringify(body),
  })

const signedInSchema = z.object({ data: z.object({ accessToken: z.string() }) })

export const accessTokenOf = async (
  email: string,
  password = testApi().seedPassword,
): Promise<string> => {
  const answer = await ask('/auth/login', {
    email,
    password,
    rememberMe: false,
    twoFactorCode: null,
  })

  return signedInSchema.parse(await answer.json()).data.accessToken
}

const bookedSchema = z.object({
  data: z.object({ id: z.uuid(), bookingNumber: z.string() }),
})

/** A booking that a customer made somewhere else: in another tab, or a moment earlier. */
export const bookThroughApi = async (
  email: string,
  booking: { staff: string; startTime: string; customerRequest: string | null },
): Promise<{ id: string; bookingNumber: string }> => {
  const answer = await ask(
    '/customers/me/bookings',
    {
      salonId: await salonId(),
      serviceId: await serviceId(LADIES_CUT),
      staffId: await staffId(booking.staff),
      startTime: booking.startTime,
      customerRequest: booking.customerRequest,
    },
    await accessTokenOf(email),
  )
  expect(answer.status).toBe(201)

  return bookedSchema.parse(await answer.json()).data
}

/** An account whose address is confirmed, and that has not said who its customer is. */
export const registerNewcomer = async (): Promise<void> => {
  expect(
    (
      await ask('/auth/register', {
        email: NEWCOMER,
        password: NEWCOMER_PASSWORD,
      })
    ).status,
  ).toBe(204)
  const token = new URL(await testApi().mailedLink(NEWCOMER)).hash.replace(
    '#token=',
    '',
  )
  expect((await ask('/auth/verify-email/confirm', { token })).status).toBe(204)
}
