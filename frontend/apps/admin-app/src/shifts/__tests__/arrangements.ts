import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the shifts arrange in the database, and read
 * back from it. In the seed data, Hiroshi Tanaka (STF001, the account
 * stylist1) and Mika Suzuki (STF002) of the salon in Tokyo work from
 * Monday to Friday from 9 to 20 and on Saturday from 10 to 18, with a
 * break from 13 to 14; the other members of the salon have no schedule.
 */

/** A row of a date: the hours of a day of work, none for a day off */
type DateRow = {
  date: string
  hours: [string, string] | undefined
  notes: string | null
}

/** Lets a member have a row of a date in their schedule, as another account wrote it. */
export const arrangeDateRow = (
  staffCode: string,
  { date, hours, notes }: DateRow,
): Promise<unknown> =>
  testApi().query(
    `insert into staff_schedules ("staffId", date, "startTime", "endTime", "isRecurring", "isAvailable", notes)
     select id, $2::date, $3::time, $4::time, false, $3::time is not null, $5
     from staff where "staffCode" = $1`,
    [staffCode, date, hours?.[0] ?? null, hours?.[1] ?? null, notes],
  )

const storedSchema = z.array(
  z.object({
    dayOfWeek: z.string().nullable(),
    date: z.string().nullable(),
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    breakStartTime: z.string().nullable(),
    breakEndTime: z.string().nullable(),
    isRecurring: z.boolean(),
    isAvailable: z.boolean(),
    notes: z.string().nullable(),
  }),
)

/** The schedule of a member as the database of the API keeps it, in the order the API lists it. */
export const storedScheduleOf = async (staffCode: string) =>
  storedSchema.parse(
    await testApi().query(
      `select "dayOfWeek"::text as "dayOfWeek", date::text as date,
              "startTime"::text as "startTime", "endTime"::text as "endTime",
              "breakStartTime"::text as "breakStartTime", "breakEndTime"::text as "breakEndTime",
              "isRecurring", "isAvailable", notes
       from staff_schedules
       where "staffId" = (select id from staff where "staffCode" = $1)
       -- The columns, not the texts selected: the days of the week in their order
       order by "isRecurring" desc, staff_schedules."dayOfWeek", staff_schedules.date`,
      [staffCode],
    ),
  )

const idsSchema = z.array(z.object({ id: z.uuid() }))

/** The rows of the schedule of a member as they were written: a schedule that was replaced has new ones. */
export const scheduleRowIdsOf = async (staffCode: string): Promise<string[]> =>
  idsSchema
    .parse(
      await testApi().query(
        `select id::text from staff_schedules
         where "staffId" = (select id from staff where "staffCode" = $1)
         order by id`,
        [staffCode],
      ),
    )
    .map(({ id }) => id)
