import { idOf, testApi } from '@beauty-salon-frontend/testing/api'
import { KENJI, TOKYO, YUKI } from '@beauty-salon-frontend/testing/seed'
import * as z from 'zod'

/*
 * What the screen tests of the bookings arrange in the database, and read
 * back from it. The seed data has two salons in Tokyo's time zone; the
 * owner, the manager and two stylists work at the first, a therapist at
 * the second.
 */

export type Arranged = {
  bookingNumber: string
  /** Days from today in Tokyo */
  day: number
  /** The time of day in Tokyo: `10:00` */
  at: string
  minutes?: number
  status?: string
  salon?: string
  customer?: string
  staffCode?: string
  service?: string
  actualStartTime?: string | null
}

/** Puts a booking of one service into the database, as the ledger would have it. */
export const arrange = ({
  bookingNumber,
  day,
  at,
  minutes = 60,
  status = 'pending',
  salon = TOKYO,
  customer = YUKI.email,
  staffCode = 'STF001',
  service = 'Ladies Cut',
  actualStartTime = null,
}: Arranged): Promise<string> =>
  idOf(
    `with picked as (
       select salons.id as "salonId", customers.id as "customerId", staff.id as "staffId",
              services.id as "serviceId", services.price,
              (now() at time zone 'Asia/Tokyo')::date + $2::int as day
       from salons
       join staff on staff."salonId" = salons.id and staff."staffCode" = $4
       join services on services."salonId" = salons.id and services.name = $5
       cross join customers
       where salons.name = $1 and customers.email = $3
     ), made as (
       insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate",
                             "startTime", "endTime", duration, status, subtotal, "totalAmount",
                             "actualStartTime", "cancelledAt", "completedAt")
       select $6, "salonId", "customerId", "staffId", day,
              (day + $7::time) at time zone 'Asia/Tokyo',
              (day + $7::time) at time zone 'Asia/Tokyo' + make_interval(mins => $8::int),
              $8::int, $9::text::booking_status, price, price,
              -- What the operation that led to the state would have written
              coalesce($10::timestamptz,
                       case when $9::text = 'in_progress' then (day + $7::time) at time zone 'Asia/Tokyo' end),
              case when $9::text = 'cancelled' then now() end,
              case when $9::text = 'completed'
                   then (day + $7::time) at time zone 'Asia/Tokyo' + make_interval(mins => $8::int) end
       from picked
       returning id, "staffId", "startTime", "endTime", subtotal
     ), lines as (
       insert into booking_services ("bookingId", "serviceId", "staffId", "startTime", "endTime",
                                     duration, price, "finalPrice", "taxIncluded")
       select made.id, picked."serviceId", made."staffId", made."startTime", made."endTime",
              $8::int, made.subtotal, made.subtotal, true
       from made cross join picked
     )
     select id::text from made`,
    [
      salon,
      day,
      customer,
      staffCode,
      service,
      bookingNumber,
      at,
      minutes,
      status,
      actualStartTime,
    ],
  )

/** So many bookings of a day, one every ten minutes from 09:00, numbered from 1. */
export const arrangeMany = (day: number, count: number): Promise<unknown> =>
  testApi().query(
    `with picked as (
       select salons.id as "salonId", customers.id as "customerId", staff.id as "staffId",
              services.id as "serviceId", services.price,
              (now() at time zone 'Asia/Tokyo')::date + $1::int as day
       from salons
       join staff on staff."salonId" = salons.id and staff."staffCode" = 'STF001'
       join services on services."salonId" = salons.id and services.name = 'Kids Cut (Under 12)'
       cross join customers
       where salons.name = $3 and customers.email = $4
     ), made as (
       insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate",
                             "startTime", "endTime", duration, status, subtotal, "totalAmount")
       select 'BK-MANY-' || lpad(n::text, 4, '0'), "salonId", "customerId", "staffId", day,
              (day + time '09:00') at time zone 'Asia/Tokyo' + make_interval(mins => 10 * (n - 1)),
              (day + time '09:00') at time zone 'Asia/Tokyo' + make_interval(mins => 10 * (n - 1) + 30),
              30, 'confirmed', price, price
       from picked cross join generate_series(1, $2::int) as n
       returning id, "staffId", "startTime", "endTime", subtotal
     )
     insert into booking_services ("bookingId", "serviceId", "staffId", "startTime", "endTime",
                                   duration, price, "finalPrice", "taxIncluded")
     select made.id, picked."serviceId", made."staffId", made."startTime", made."endTime",
            30, made.subtotal, made.subtotal, true
     from made cross join picked`,
    [day, count, TOKYO, KENJI.email],
  )

const storedSchema = z.tuple([
  z.object({
    status: z.string(),
    actualStartTime: z.string().nullable(),
    actualEndTime: z.string().nullable(),
    completedAt: z.string().nullable(),
    cancelledAt: z.string().nullable(),
    cancelledBy: z.string().nullable(),
    cancellationReason: z.string().nullable(),
    updatedAt: z.string(),
  }),
])

/** A booking as it is stored: its state and what its operations wrote. */
export const storedBooking = async (id: string) =>
  storedSchema.parse(
    await testApi().query(
      `select status::text,
              to_char("actualStartTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "actualStartTime",
              to_char("actualEndTime" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "actualEndTime",
              "completedAt"::text, "cancelledAt"::text,
              (select email from users where users.id = bookings."cancelledBy") as "cancelledBy",
              "cancellationReason", "updatedAt"::text
       from bookings where id = $1`,
      [id],
    ),
  )[0]

/**
 * Lets the database refuse `what` on `table`, as a database that fails
 * does: the API answers with an error of the server. The copy of the
 * database goes with the test.
 */
export const refuse = async (what: string, table: string): Promise<void> => {
  await testApi().query(
    `create function refuse() returns trigger language plpgsql
       as $$ begin raise exception 'refused by the test'; end $$`,
  )
  await testApi().query(
    `create trigger refuse before ${what} on ${table}
       for each row execute function refuse()`,
  )
}

/** The time of day of a moment in Tokyo: 「10:30」. */
export const clockOf = (moment: Date): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Tokyo',
  }).format(moment)
