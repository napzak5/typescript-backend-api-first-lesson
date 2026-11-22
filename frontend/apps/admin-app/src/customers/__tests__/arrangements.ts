import { countOf, idOf, testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the ledger of the customers arrange in the
 * database, and read back from it. The seed data has four customers,
 * registered when it was seeded; the tests name them by their address of
 * mail.
 */

/** The ID of a customer of the ledger, by their address of mail. */
export const customerIdOf = async (email: string): Promise<string> =>
  idOf(
    'select id::text from customers where email = $1 and "deletedAt" is null',
    [email],
  )

/** Lets a customer have been registered so many days before today, in Tokyo, at noon. */
export const registeredDaysAgo = (
  email: string,
  days: number,
): Promise<unknown> =>
  testApi().query(
    `update customers
     set "createdAt" = ((now() at time zone 'Asia/Tokyo')::date - $2::int + time '12:00') at time zone 'Asia/Tokyo',
         "updatedAt" = ((now() at time zone 'Asia/Tokyo')::date - $2::int + time '12:00') at time zone 'Asia/Tokyo'
     where email = $1`,
    [email, days],
  )

/** Lets a customer have a referral code, as another salon would have given it. */
export const giveReferralCode = (
  email: string,
  code: string,
): Promise<unknown> =>
  testApi().query(
    'update customers set "referralCode" = $2, "updatedAt" = now() where email = $1',
    [email, code],
  )

/** Lets the note of a customer be written meanwhile, as another salon would have done it. */
export const writeNoteMeanwhile = (
  email: string,
  notes: string,
): Promise<unknown> =>
  testApi().query(
    'update customers set notes = $2, "updatedAt" = now() where email = $1',
    [email, notes],
  )

/** Lets a customer be removed from the ledger meanwhile, as an owner would have done it. */
export const removeMeanwhile = (email: string): Promise<unknown> =>
  testApi().query('update customers set "deletedAt" = now() where email = $1', [
    email,
  ])

/**
 * Lets a customer have set their preferences in the portal: a member of
 * the staff of Tokyo they wish for (Hiroshi Tanaka), and two they avoid:
 * Mika Suzuki, and Takeshi Ito, who is removed since.
 */
export const arrangePreferences = async (email: string): Promise<void> => {
  await testApi().query(
    `insert into customer_preferences ("customerId", "preferredStaffId", "preferredTimeSlots",
                                       "avoidStaffIds", "stylePreferences", "communicationStyle",
                                       "specialRequests")
     select customers.id,
            (select id from staff where "staffCode" = 'STF001'),
            '[{"startTime": "10:00", "endTime": "12:00"}]'::jsonb,
            array[(select id from staff where "staffCode" = 'STF002'),
                  (select id from staff where "staffCode" = 'STF003')],
            '{"preferredLength": "ボブ", "preferredColors": ["アッシュ"], "avoidStyles": [], "inspirationImages": []}'::jsonb,
            '静かに過ごしたい',
            null
     from customers where email = $1`,
    [email],
  )
  await testApi().query(
    `update staff set "deletedAt" = now() where "staffCode" = 'STF003'`,
  )
}

/** Lets a customer have been referred by another, as another salon would have recorded it. */
export const referredMeanwhile = (
  email: string,
  referrerEmail: string,
): Promise<unknown> =>
  testApi().query(
    `update customers
     set "referredBy" = (select id from customers where email = $2), "updatedAt" = now()
     where email = $1`,
    [email, referrerEmail],
  )

/**
 * Lets a customer have said in the portal what they wish for: Takeshi Ito,
 * who works at the salon in Osaka, and not Mika Suzuki, from ten to noon,
 * and quietly.
 */
export const arrangeWishes = (email: string): Promise<unknown> =>
  testApi().query(
    `insert into customer_preferences ("customerId", "preferredStaffId", "preferredTimeSlots",
                                       "avoidStaffIds", "communicationStyle")
     select customers.id,
            (select id from staff where "staffCode" = 'STF003'),
            '[{"startTime": "10:00", "endTime": "12:00"}]'::jsonb,
            array[(select id from staff where "staffCode" = 'STF002')],
            '静かに過ごしたい'
     from customers where email = $1`,
    [email],
  )

/** Lets a customer write a request in the portal meanwhile. */
export const requestMeanwhile = (
  email: string,
  specialRequests: string,
): Promise<unknown> =>
  testApi().query(
    `update customer_preferences
     set "specialRequests" = $2, "updatedAt" = now()
     where "customerId" = (select id from customers where email = $1)`,
    [email, specialRequests],
  )

/** Lets a salon remove a member of its staff meanwhile. */
export const staffRemovedMeanwhile = (displayName: string): Promise<unknown> =>
  testApi().query(
    'update staff set "deletedAt" = now() where "displayName" = $1',
    [displayName],
  )

/** The ID of a member of the staff, by their name. */
export const staffIdOf = async (displayName: string): Promise<string> =>
  idOf('select id::text from staff where "displayName" = $1', [displayName])

const namesSchema = z.array(z.object({ displayName: z.string() }))

/** The names of the staff a salon shows, in the order of its list. */
export const staffShownAt = async (salon: string): Promise<string[]> =>
  namesSchema
    .parse(
      await testApi().query(
        `select staff."displayName"
         from staff join salons on salons.id = staff."salonId"
         where salons.name = $1 and staff."isActive" and staff."deletedAt" is null
         order by staff."createdAt", staff.id`,
        [salon],
      ),
    )
    .map(({ displayName }) => displayName)

const storedPreferencesSchema = z
  .array(
    z.object({
      preferredStaffId: z.string().nullable(),
      avoidStaffIds: z.array(z.string()),
      preferredTimeSlots: z.unknown(),
      communicationStyle: z.string().nullable(),
      specialRequests: z.string().nullable(),
      updatedAt: z.string(),
    }),
  )
  .max(1)

/** The preferences of a customer as they are stored; `null` when none were ever written. */
export const storedPreferencesOf = async (email: string) =>
  storedPreferencesSchema.parse(
    await testApi().query(
      `select stored."preferredStaffId"::text, stored."avoidStaffIds"::text[],
              stored."preferredTimeSlots", stored."communicationStyle",
              stored."specialRequests", stored."updatedAt"::text
       from customer_preferences stored join customers on customers.id = stored."customerId"
       where customers.email = $1`,
      [email],
    ),
  )[0] ?? null

const storedSchema = z.tuple([
  z.object({
    lastName: z.string(),
    firstName: z.string(),
    lastNameKana: z.string().nullable(),
    email: z.string(),
    phoneNumber: z.string(),
    membershipTier: z.string(),
    customerStatus: z.string(),
    isActive: z.boolean(),
    tags: z.array(z.string()),
    preferences: z.unknown(),
    hairType: z.string().nullable(),
    notes: z.string().nullable(),
    internalNotes: z.string().nullable(),
    referralCode: z.string().nullable(),
    referredBy: z.string().nullable(),
    allowEmail: z.boolean(),
    allowSms: z.boolean(),
    allowMarketing: z.boolean(),
    updatedAt: z.string(),
  }),
])

/** A customer as they are stored, by their address of mail. */
export const storedCustomerOf = async (email: string) =>
  storedSchema.parse(
    await testApi().query(
      `select "lastName", "firstName", "lastNameKana", email, "phoneNumber",
              "membershipTier"::text, "customerStatus"::text, "isActive", tags,
              preferences, "hairType"::text, notes, "internalNotes", "referralCode",
              "referredBy"::text, "allowEmail", "allowSms", "allowMarketing",
              "updatedAt"::text
       from customers where email = $1`,
      [email],
    ),
  )[0]

/** How many customers the ledger has, the removed ones too. */
export const storedCustomerCount = async (): Promise<number> =>
  countOf('select count(*) as count from customers')

/**
 * Lets the ledger have more customers, each with the tag, registered a
 * minute apart: the first of them latest. Their names are 「Walk In 01」
 * and so on.
 */
export const arrangeCustomers = (
  count: number,
  tag: string,
): Promise<unknown> =>
  testApi().query(
    `insert into customers ("lastName", "firstName", email, "phoneNumber", tags, "createdAt", "updatedAt")
     select 'Walk', 'In ' || lpad(n::text, 2, '0'), 'walk-in-' || lpad(n::text, 2, '0') || '@example.com',
            '+81-90-0000-' || lpad(n::text, 4, '0'), array[$2::text],
            now() - make_interval(mins => n), now() - make_interval(mins => n)
     from generate_series(1, $1::int) as n`,
    [count, tag],
  )

/**
 * Lets the ledger have a crowd of customers, each with the tag: more than
 * a page, or an export, holds. Their names are 「Crowd 00001」 and so on.
 */
export const arrangeCrowd = (count: number, tag: string): Promise<unknown> =>
  testApi().query(
    `insert into customers ("lastName", "firstName", email, "phoneNumber", tags)
     select 'Crowd', lpad(n::text, 5, '0'), 'crowd-' || n || '@example.com',
            '+81-90-' || lpad(n::text, 8, '0'), array[$2::text]
     from generate_series(1, $1::int) as n`,
    [count, tag],
  )

/** Lets the bookings of a customer that are not finished have been cancelled: the customer may be removed. */
export const finishBookingsOf = (email: string): Promise<unknown> =>
  testApi().query(
    `update bookings set status = 'cancelled', "cancelledAt" = now(), "updatedAt" = now()
     where "customerId" = (select id from customers where email = $1 and "deletedAt" is null)
       and status in ('draft', 'pending', 'confirmed', 'in_progress')`,
    [email],
  )

/** The values of a customer that a version keeps, as the columns of both tables name them */
const LEDGER_COLUMNS = [
  'firstName',
  'lastName',
  'firstNameKana',
  'lastNameKana',
  'email',
  'phoneNumber',
  'alternativePhone',
  'postalCode',
  'prefecture',
  'city',
  'address',
  'building',
  'birthDate',
  'gender',
  'occupation',
  'membershipTier',
  'preferences',
  'notes',
  'internalNotes',
  'tags',
  'referredBy',
  'referralCode',
  'allowMarketing',
  'allowSms',
  'allowEmail',
  'isActive',
  'hairType',
  'hairThickness',
  'scalpCondition',
  'customerStatus',
]
  .map((column) => `"${column}"`)
  .join(', ')

/**
 * Keeps a version of a customer as the API keeps one when it writes them:
 * the next number, made by the account of the address of mail `by`, with
 * the values the customer has now, at the moment they were written.
 */
const recordVersion = (
  customerId: string,
  operation: 'update' | 'delete' | 'restore' | 'merge' | 'erase',
  by: string,
): Promise<unknown> =>
  testApi().query(
    `insert into customer_versions ("customerId", version, operation, "changedBy", "changedAt", ${LEDGER_COLUMNS})
     select id,
            coalesce((select max(version) from customer_versions where "customerId" = customers.id), 0) + 1,
            $2::customer_version_operation,
            (select id from users where email = $3 and "deletedAt" is null),
            "updatedAt",
            ${LEDGER_COLUMNS}
     from customers where id = $1`,
    [customerId, operation, by],
  )

/**
 * Lets an account have changed the telephone number and the city of a
 * customer meanwhile, as the API would have done it: with a version.
 */
export const changedMeanwhile = async (
  customerId: string,
  by: string,
  { phoneNumber, city }: { phoneNumber: string; city: string | null },
): Promise<void> => {
  await testApi().query(
    `update customers set "phoneNumber" = $2, city = $3,
       "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [customerId, phoneNumber, city],
  )
  await recordVersion(customerId, 'update', by)
}

/**
 * Lets an account have taken a customer out of the ledger meanwhile, as
 * the API would have done it: removed them (`delete`), or merged them into
 * another (`merge`), with a version.
 */
export const removedMeanwhile = async (
  customerId: string,
  by: string,
  operation: 'delete' | 'merge' = 'delete',
): Promise<void> => {
  await testApi().query(
    `update customers set "deletedAt" = now(), "userId" = null,
       "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [customerId],
  )
  await recordVersion(customerId, operation, by)
}

/** Lets an account have brought a removed customer back meanwhile, with a version. */
export const restoredMeanwhile = async (
  customerId: string,
  by: string,
): Promise<void> => {
  await testApi().query(
    `update customers set "deletedAt" = null,
       "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [customerId],
  )
  await recordVersion(customerId, 'restore', by)
}

/**
 * Lets an account have changed the notes of a customer so many times
 * meanwhile, a minute apart, with a version each: 「メモ 1」 and so on.
 */
export const notesChangedMeanwhile = async (
  customerId: string,
  by: string,
  times: number,
): Promise<void> => {
  for (const time of Array.from({ length: times }, (_, index) => index + 1)) {
    await testApi().query(
      `update customers set notes = $2, "updatedAt" = now() + make_interval(mins => $3::int)
       where id = $1`,
      [customerId, `メモ ${time}`, time],
    )
    await recordVersion(customerId, 'update', by)
  }
}

/** Lets a customer have been registered meanwhile, with a version, as the API would have done it. */
export const registeredMeanwhile = async (
  {
    lastName,
    firstName,
    email,
  }: { lastName: string; firstName: string; email: string },
  by: string,
): Promise<void> => {
  await testApi().query(
    `insert into customers ("lastName", "firstName", email, "phoneNumber", tags)
     values ($1, $2, $3, '+81-90-1111-2222', '{}')`,
    [lastName, firstName, email],
  )
  const [row] = z
    .array(z.object({ id: z.uuid() }))
    .parse(
      await testApi().query(
        'select id::text from customers where email = $1 and "deletedAt" is null',
        [email],
      ),
    )
  await testApi().query(
    `insert into customer_versions ("customerId", version, operation, "changedBy", "changedAt", ${LEDGER_COLUMNS})
     select id, 1, 'create', (select id from users where email = $2 and "deletedAt" is null), "updatedAt", ${LEDGER_COLUMNS}
     from customers where id = $1`,
    [row?.id ?? null, by],
  )
}

const presenceSchema = z.tuple([z.object({ present: z.boolean() })])

/** Whether a customer is in the ledger: there, and not removed. */
export const isInLedger = async (customerId: string): Promise<boolean> =>
  presenceSchema.parse(
    await testApi().query(
      'select exists (select 1 from customers where id = $1 and "deletedAt" is null) as present',
      [customerId],
    ),
  )[0].present

/** A transaction of the points of a customer, as a test arranges it. */
export type ArrangedTransaction = {
  type: 'earned' | 'used' | 'adjusted'
  /** How the balance moves: negative when it falls */
  points: number
  /** How many days before now it was recorded */
  daysAgo: number
  description?: string | null
  /** The day the points given expire on, in days from today in Tokyo */
  expiresIn?: number | null
  /** The record it was made for */
  reference?: { type: 'sale' | 'booking'; id: string } | null
}

/**
 * Lets the opening balance the seed gave a customer have been recorded
 * long ago, before what a test arranges after it.
 */
const openedLongAgo = (email: string): Promise<unknown> =>
  testApi().query(
    `update customer_points set "createdAt" = now() - interval '60 days'
     where "customerId" = (select id from customers where email = $1)`,
    [email],
  )

/**
 * Lets a customer have had points recorded before, as the API would have
 * recorded them: after the opening balance of the seed, in the order
 * given, each with the balance after it, and the balance of the ledger
 * after the last.
 */
export const arrangePoints = async (
  email: string,
  transactions: readonly ArrangedTransaction[],
): Promise<void> => {
  await openedLongAgo(email)
  await testApi().query(
    `with given as (
       select *, sum(points) over (order by place) as moved
       from rows from (
         jsonb_to_recordset($2::jsonb)
           as (type text, points int, "daysAgo" int, description text, "expiresIn" int,
               "referenceType" text, "referenceId" uuid)
       ) with ordinality
         as t(type, points, "daysAgo", description, "expiresIn", "referenceType", "referenceId", place)
     ), customer as (
       select id, "loyaltyPoints" as opening from customers where email = $1 and "deletedAt" is null
     ), made as (
       insert into customer_points ("customerId", "transactionType", points, balance, description,
                                    "referenceType", "referenceId", "expiryDate", "createdAt")
       select customer.id, given.type::point_transaction_type, given.points, customer.opening + given.moved,
              given.description, given."referenceType", given."referenceId",
              (now() at time zone 'Asia/Tokyo')::date + given."expiresIn",
              now() - make_interval(days => given."daysAgo")
       from given cross join customer
     )
     update customers set "loyaltyPoints" = customer.opening + (select coalesce(sum(points), 0) from given)
     from customer where customers.id = customer.id`,
    [
      email,
      JSON.stringify(
        transactions.map(
          ({ type, points, daysAgo, description, expiresIn, reference }) => ({
            type,
            points,
            daysAgo,
            description: description ?? null,
            expiresIn: expiresIn ?? null,
            referenceType: reference?.type ?? null,
            referenceId: reference?.id ?? null,
          }),
        ),
      ),
    ],
  )
}

/**
 * Lets a customer have been given 10 points at each of so many visits in
 * the last hour, one a minute, after the opening balance of the seed.
 */
export const arrangeVisitPoints = async (
  email: string,
  count: number,
): Promise<void> => {
  await openedLongAgo(email)
  await testApi().query(
    `with customer as (
       select id, "loyaltyPoints" as opening from customers where email = $1 and "deletedAt" is null
     ), made as (
       insert into customer_points ("customerId", "transactionType", points, balance, description, "createdAt")
       select customer.id, 'earned', 10, customer.opening + 10 * visit, 'ご来店 ' || visit,
              now() - interval '1 hour' + make_interval(mins => visit)
       from customer cross join generate_series(1, $2::int) as visit
     )
     update customers set "loyaltyPoints" = customer.opening + 10 * $2::int
     from customer where customers.id = customer.id`,
    [email, count],
  )
}

const storedPointsSchema = z.array(
  z.object({
    transactionType: z.string(),
    points: z.number(),
    balance: z.number(),
    description: z.string().nullable(),
    referenceType: z.string().nullable(),
    referenceId: z.string().nullable(),
    expiryDate: z.string().nullable(),
  }),
)

/** The transactions of the points of a customer as they are stored, the latest first. */
export const storedPointsOf = async (email: string) =>
  storedPointsSchema.parse(
    await testApi().query(
      `select "transactionType"::text, points, balance, description, "referenceType",
              "referenceId"::text, to_char("expiryDate", 'YYYY-MM-DD') as "expiryDate"
       from customer_points
       where "customerId" = (select id from customers where email = $1)
       order by "createdAt" desc, id desc`,
      [email],
    ),
  )

const balanceSchema = z.tuple([z.object({ loyaltyPoints: z.number() })])

/** The balance the ledger keeps for a customer. */
export const storedBalanceOf = async (email: string): Promise<number> =>
  balanceSchema.parse(
    await testApi().query(
      'select "loyaltyPoints" from customers where email = $1',
      [email],
    ),
  )[0].loyaltyPoints

/**
 * Lets an account have taken the request of a customer to have their data
 * erased, as the API would have taken it: pending, for 14 days.
 */
export const askedForErasure = (email: string, by: string): Promise<unknown> =>
  testApi().query(
    `insert into customer_deletion_requests ("customerId", reason, "requestedBy", "requestedAt", "scheduledAt")
     select customers.id, 'ご本人からのお申し出', users.id, now(), now() + interval '14 days'
     from customers cross join users
     where customers.email = $1 and customers."deletedAt" is null and users.email = $2`,
    [email, by],
  )

/** Lets an account have called off the pending request of a customer meanwhile, as the API would have. */
export const cancelledMeanwhile = (
  customerId: string,
  by: string,
): Promise<unknown> =>
  testApi().query(
    `update customer_deletion_requests
     set status = 'cancelled', "cancelledAt" = now(),
         "cancelledBy" = (select id from users where email = $2)
     where "customerId" = $1 and status = 'pending'`,
    [customerId, by],
  )

/**
 * Lets the operator of the platform have run the pending request of a
 * customer meanwhile: the request is done, and the customer left the
 * ledger with a version of the erasure, the only one left. The values of
 * the ledger are not made anonymous, which the screens do not look at.
 */
export const erasedMeanwhile = async (
  customerId: string,
  by: string,
): Promise<void> => {
  await testApi().query(
    `update customer_deletion_requests
     set status = 'completed', "completedAt" = now(),
         "completedBy" = (select id from users where email = $2)
     where "customerId" = $1 and status = 'pending'`,
    [customerId, by],
  )
  await testApi().query(
    `update customers set "deletedAt" = now(), "userId" = null,
       "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [customerId],
  )
  await testApi().query(
    'delete from customer_versions where "customerId" = $1',
    [customerId],
  )
  await recordVersion(customerId, 'erase', by)
}

const storedRequestsSchema = z.array(
  z.object({
    status: z.string(),
    reason: z.string(),
    requestedBy: z.string(),
    cancelledBy: z.string().nullable(),
    hours: z.coerce.number(),
  }),
)

/**
 * The requests of a customer to have their data erased, as the database
 * holds them, oldest first: who took and who called off each (by the
 * address of mail of the account), and how many hours after it was taken
 * the data is to be erased.
 */
export const storedErasureRequestsOf = async (customerId: string) =>
  storedRequestsSchema.parse(
    await testApi().query(
      `select requests.status, requests.reason,
              taker.email as "requestedBy", canceller.email as "cancelledBy",
              extract(epoch from requests."scheduledAt" - requests."requestedAt") / 3600 as hours
       from customer_deletion_requests requests
       join users taker on taker.id = requests."requestedBy"
       left join users canceller on canceller.id = requests."cancelledBy"
       where requests."customerId" = $1
       order by requests."requestedAt"`,
      [customerId],
    ),
  )

/** Lets a customer have a chart that names so many products they prefer: 「製品 <first>」 and the ones after. */
export const arrangeChart = (
  email: string,
  first: number,
  count: number,
): Promise<unknown> =>
  testApi().query(
    `insert into medical_charts ("customerId", "previousTreatments", "preferredProducts", "avoidProducts")
     select id, '[]'::jsonb,
            array(select '製品 ' || n from generate_series($2::int, $2::int + $3::int - 1) as n),
            '{}'
     from customers where email = $1 and "deletedAt" is null`,
    [email, first, count],
  )

/** Lets the ledger keep so many points for a customer. */
export const keepBalance = (email: string, points: number): Promise<unknown> =>
  testApi().query(
    'update customers set "loyaltyPoints" = $2 where email = $1 and "deletedAt" is null',
    [email, points],
  )

const mergedSchema = z.tuple([
  z.object({
    removed: z.boolean(),
    email: z.string(),
    operation: z.string().nullable(),
  }),
])

/** A customer as a merge leaves them: whether they left the ledger, their address of mail, and what made their latest version. */
export const storedMergeOf = async (customerId: string) =>
  mergedSchema.parse(
    await testApi().query(
      `select "deletedAt" is not null as removed, email,
              (select operation::text from customer_versions
               where "customerId" = customers.id order by version desc limit 1) as operation
       from customers where id = $1`,
      [customerId],
    ),
  )[0]

/** How many bookings a customer has, as they are stored. */
export const storedBookingCountOf = async (
  customerId: string,
): Promise<number> =>
  countOf('select count(*) as count from bookings where "customerId" = $1', [
    customerId,
  ])
