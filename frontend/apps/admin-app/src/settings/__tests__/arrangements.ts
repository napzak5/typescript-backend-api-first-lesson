import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the settings arrange in the database, and read
 * back from it. The salon in Tokyo of the seed data has no kana, no
 * building and no place on the map, a rate of tax of 10 %, and a date of
 * its calendar on each of the seven days after the day of the seed.
 */

const storedSchema = z.tuple([
  z.object({
    description: z.string().nullable(),
    phoneNumber: z.string(),
    email: z.string(),
    features: z.array(z.string()),
    taxRate: z.string(),
    isActive: z.boolean(),
    updatedAt: z.string(),
  }),
])

/** What the database keeps of a salon, of the values the tests change. */
export const storedSalonOf = async (name: string) =>
  storedSchema.parse(
    await testApi().query(
      `select description, "phoneNumber", email, features, "taxRate"::text, "isActive", "updatedAt"::text
       from salons where name = $1`,
      [name],
    ),
  )[0]

/** Lets somebody else have changed the phone number of a salon meanwhile. */
export const phoneChangedMeanwhile = (
  name: string,
  phoneNumber: string,
): Promise<unknown> =>
  testApi().query(
    `update salons set "phoneNumber" = $2,
       "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where name = $1`,
    [name, phoneNumber],
  )

const changedSchema = z.tuple([z.object({ id: z.uuid() })])

/** Lets a date of the calendar of a salon be a day off with a name and a note. */
export const dayOffArranged = async (
  name: string,
  date: string,
): Promise<void> => {
  changedSchema.parse(
    await testApi().query(
      `update opening_hours o set "isHoliday" = true, "holidayName" = '臨時休業',
         notes = '設備の点検', "openTime" = null, "closeTime" = null
       from salons s
       where s.id = o."salonId" and s.name = $1 and o.date = $2::date
       returning o.id::text`,
      [name, date],
    ),
  )
}

const hoursSchema = z.tuple([z.object({ businessHours: z.unknown() })])

/** The hours of the week of a salon, as the database keeps them. */
export const storedWeekOf = async (name: string): Promise<unknown> =>
  hoursSchema.parse(
    await testApi().query(
      'select "businessHours" from salons where name = $1',
      [name],
    ),
  )[0].businessHours

const calendarSchema = z.array(
  z.object({
    date: z.string(),
    dayOfWeek: z.string(),
    openTime: z.string().nullable(),
    closeTime: z.string().nullable(),
    isHoliday: z.boolean(),
    holidayName: z.string().nullable(),
    notes: z.string().nullable(),
  }),
)

/** The dates of the calendar of a salon, as the database keeps them, in their order. */
export const storedCalendarOf = async (name: string) =>
  calendarSchema.parse(
    await testApi().query(
      `select o.date::text, o."dayOfWeek"::text, o."openTime"::text, o."closeTime"::text,
         o."isHoliday", o."holidayName", o.notes
       from opening_hours o join salons s on s.id = o."salonId"
       where s.name = $1
       order by o.date`,
      [name],
    ),
  )
