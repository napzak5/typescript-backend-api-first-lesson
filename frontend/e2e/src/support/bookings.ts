import type { CustomerBookingsCreate201 } from '@beauty-salon-frontend/api-client'
import { CUSTOMER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import * as z from 'zod'
import type { TestApi } from './fixtures'
import { part } from './screen'
import { accessTokenOf } from './sign-in'

/*
 * What the tests of the booking screens share: the seed data they name,
 * the day they arrange in the database, a booking made through the API,
 * and the locators of what the screens show.
 */

/** What the tests book at the salon in Tokyo, and with whom */
export const LADIES_CUT = 'Ladies Cut'
export const HIROSHI = 'Hiroshi Tanaka'
export const MIKA = 'Mika Suzuki'

/** Two weeks from today: the seed data has no booking that far ahead. */
const DAYS_AHEAD = 14

const dateSchema = z.tuple([z.object({ date: z.iso.date() })])

/** The ID of the salon the tests work at: the one in Tokyo. */
export const salonId = (api: TestApi): Promise<string> => api.salonIdOf(TOKYO)

export const serviceId = (api: TestApi): Promise<string> =>
  api.idOf(
    `select services.id::text from services join salons on salons.id = services."salonId"
       where salons.name = $1 and services.name = $2`,
    [TOKYO, LADIES_CUT],
  )

export const staffId = (api: TestApi, displayName: string): Promise<string> =>
  api.idOf('select id::text from staff where "displayName" = $1', [displayName])

/**
 * Opens the salon on the day the tests book on, from 10:00 until `until`
 * whatever day of the week it is, and says who works then: each member of
 * the staff that is named, from their hour until then, and nobody else.
 * The day is the answer.
 */
export const openDay = async (
  api: TestApi,
  working: Record<string, string>,
  until = '13:00',
): Promise<string> => {
  const [{ date }] = dateSchema.parse(
    await api.query(
      `select ((now() at time zone 'Asia/Tokyo')::date + $1::int)::text as date`,
      [DAYS_AHEAD],
    ),
  )
  await api.query(
    `insert into opening_hours ("salonId", "dayOfWeek", date, "openTime", "closeTime")
     select id, trim(to_char($2::date, 'day'))::day_of_week, $2::date, '10:00', $3::time
     from salons where name = $1
     on conflict ("salonId", date) do update
     set "openTime" = excluded."openTime", "closeTime" = excluded."closeTime", "isHoliday" = false`,
    [TOKYO, date, until],
  )
  await api.query(
    `insert into staff_schedules ("staffId", date, "startTime", "endTime", "isRecurring", "isAvailable")
     select staff.id, $2::date, hours.value::time,
            case when hours.value is null then null else $4::time end,
            false, hours.value is not null
     from staff
     join salons on salons.id = staff."salonId"
     left join jsonb_each_text($3::jsonb) as hours(name, value) on hours.name = staff."displayName"
     where salons.name = $1`,
    [TOKYO, date, JSON.stringify(working), until],
  )

  return date
}

/** What a test reads of a booking it made: its ID and its number */
const bookedSchema = z.object({
  data: z.object({ id: z.uuid(), bookingNumber: z.string() }),
}) satisfies z.ZodType<{
  data: Pick<CustomerBookingsCreate201['data'], 'id' | 'bookingNumber'>
}>

/**
 * A booking that the customer of the seed data made before the test
 * begins: the service of the tests on a day, at a time of the salon, with
 * a member of its staff. It is made as the screen makes it, through the
 * API; an answer that is no booking fails the test here.
 */
export const bookThroughApi = async (
  request: APIRequestContext,
  api: TestApi,
  booking: { date: string; time: string; staff: string },
): Promise<{ id: string; bookingNumber: string }> => {
  const booked = await request.post(
    `${api.origin}/api/v1/customers/me/bookings`,
    {
      headers: {
        Authorization: `Bearer ${await accessTokenOf(request, api, CUSTOMER)}`,
      },
      data: {
        salonId: await salonId(api),
        serviceId: await serviceId(api),
        staffId: await staffId(api, booking.staff),
        startTime: new Date(
          `${booking.date}T${booking.time}:00+09:00`,
        ).toISOString(),
        customerRequest: null,
      },
    },
  )

  return bookedSchema.parse(await booked.json()).data
}

export const staffControl = (page: Page): Locator =>
  page.getByRole('combobox', { name: 'スタッフ' })

export const dateControl = (page: Page): Locator => page.getByLabel('日付')

export const times = (page: Page): Locator =>
  page.getByRole('radiogroup', { name: '開始時刻' }).getByRole('radio')

export const time = (page: Page, name: string): Locator =>
  page.getByRole('radio', { name, exact: true })

/** The values of the booking that is shown, in the order of the page. */
export const details = (page: Page): Locator =>
  part(page, /^予約番号 BK-/).getByRole('definition')
