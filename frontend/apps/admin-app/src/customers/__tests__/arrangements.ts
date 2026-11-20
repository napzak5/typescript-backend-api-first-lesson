import { testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the ledger of the customers arrange in the
 * database, and read back from it. The seed data has four customers,
 * registered when it was seeded; the tests name them by their address of
 * mail.
 */

const idsSchema = z.tuple([z.object({ id: z.uuid() })])

/** The ID of a customer of the ledger, by their address of mail. */
export const customerIdOf = async (email: string): Promise<string> =>
  idsSchema.parse(
    await testApi().query(
      'select id::text from customers where email = $1 and "deletedAt" is null',
      [email],
    ),
  )[0].id

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
  idsSchema.parse(
    await testApi().query(
      'select id::text from staff where "displayName" = $1',
      [displayName],
    ),
  )[0].id

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

const countSchema = z.tuple([z.object({ count: z.coerce.number() })])

/** How many customers the ledger has, the removed ones too. */
export const storedCustomerCount = async (): Promise<number> =>
  countSchema.parse(
    await testApi().query('select count(*) as count from customers'),
  )[0].count

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
  operation: 'update' | 'delete' | 'restore' | 'merge',
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
