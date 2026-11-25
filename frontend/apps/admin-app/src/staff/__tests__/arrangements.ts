import { countOf, idOf, testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the staff ledger arrange in the database, and
 * read back from it. The seed data has five members at the salon in Tokyo,
 * registered in two statements at the same moment: the stylists Hiroshi
 * Tanaka (STF001, with bookings that are not finished), Mika Suzuki
 * (STF002) and Yui Watanabe (STF004), then the owner Akiko Mori (STF900)
 * and the manager Kenji Sato (STF901), whose accounts are linked to them.
 * Members registered together are in the order of their random IDs, so
 * the tests that read the order of the ledger arrange it first.
 */

/** The members of the seed data at the salon in Tokyo, by their staff codes */
export const TANAKA = 'STF001'
export const SUZUKI = 'STF002'
export const WATANABE = 'STF004'
export const MORI = 'STF900'
const SATO = 'STF901'

/**
 * Links the account of an address of mail to a member, as an administrator
 * does meanwhile: the API reads the account at every request, and the
 * member is its own from the next one on.
 */
export const linkedMeanwhile = (
  email: string,
  staffId: string,
): Promise<unknown> =>
  testApi().query('update users set "staffId" = $2 where email = $1', [
    email,
    staffId,
  ])

/** The order `arrangeLedgerOrder` registers the members of the seed data in */
const LEDGER_ORDER = [MORI, SATO, TANAKA, SUZUKI, WATANABE]

/** Lets the members of the seed data have been registered a day apart, in `LEDGER_ORDER`. */
export const arrangeLedgerOrder = (): Promise<unknown> =>
  testApi().query(
    `update staff set "createdAt" = timestamptz '2026-01-01 00:00:00+00' + listed.place * interval '1 day'
     from jsonb_array_elements_text($1::jsonb) with ordinality as listed(code, place)
     where staff."staffCode" = listed.code`,
    [JSON.stringify(LEDGER_ORDER)],
  )

/** A member of the staff ledger, by their staff code. */
export const staffIdOf = async (staffCode: string): Promise<string> =>
  idOf('select id::text from staff where "staffCode" = $1', [staffCode])

/**
 * Lets members be registered at the salon in Tokyo after those of the seed
 * data, a minute apart: 「Crowd 01」 and on, who have no staff code and no
 * bookings.
 */
export const arrangeMembers = (count: number): Promise<unknown> =>
  testApi().query(
    `insert into staff ("salonId", "firstName", "lastName", "displayName", email, "phoneNumber",
                        specialties, certifications, "createdAt", "updatedAt")
     select salons.id, lpad(n::text, 2, '0'), 'Crowd', 'Crowd ' || lpad(n::text, 2, '0'),
            'crowd-' || n || '@beautysalon.jp', '+81-90-' || lpad(n::text, 8, '0'),
            '{}', '{}', now() + n * interval '1 minute', now() + n * interval '1 minute'
     from salons, generate_series(1, $1::int) as n
     where salons.name = 'Beauty Studio Tokyo'`,
    [count],
  )

/** The member `arrangeMembers` registered of a number, from 1. */
export const crowdIdOf = async (number: number): Promise<string> =>
  idOf('select id::text from staff where email = $1', [
    `crowd-${number}@beautysalon.jp`,
  ])

/** Lets a member who left have been removed from the ledger of the salon in Tokyo, keeping their staff code. */
export const arrangeRemovedMember = (staffCode: string): Promise<unknown> =>
  testApi().query(
    `insert into staff ("salonId", "firstName", "lastName", "displayName", email, "phoneNumber",
                        "staffCode", specialties, certifications, "deletedAt")
     select id, 'Taro', 'Former', 'Taro Former', 'former@beautysalon.jp', '+81-90-0000-0001',
            $1, '{}', '{}', now()
     from salons where name = 'Beauty Studio Tokyo'`,
    [staffCode],
  )

/** Lets another owner have changed a value of a member meanwhile. */
export const changedMeanwhile = (
  staffId: string,
  bio: string,
): Promise<unknown> =>
  testApi().query(
    `update staff set bio = $2, "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [staffId, bio],
  )

/** Lets another owner have removed a member from the ledger meanwhile. */
export const removedMeanwhile = (staffId: string): Promise<unknown> =>
  testApi().query(
    `update staff set "deletedAt" = now(), "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
     where id = $1`,
    [staffId],
  )

/** Lets every member have been removed from the ledger of the salon in Tokyo. */
export const everyMemberRemoved = (): Promise<unknown> =>
  testApi().query(
    `update staff set "deletedAt" = now() from salons
      where salons.id = staff."salonId" and salons.name = 'Beauty Studio Tokyo'
        and staff."deletedAt" is null`,
    [],
  )

/** Lets a member have stopped working at the salon: they are inactive. */
export const arrangeInactive = (staffCode: string): Promise<unknown> =>
  testApi().query(
    `update staff set "isActive" = false where "staffCode" = $1`,
    [staffCode],
  )

/** Lets the account of the address have the role of the owner of the salon of its member. */
export const arrangeOwnerAccount = (email: string): Promise<unknown> =>
  testApi().query(`update users set role = 'owner' where email = $1`, [email])

const storedSchema = z.array(
  z.object({
    firstName: z.string(),
    lastName: z.string(),
    firstNameKana: z.string().nullable(),
    lastNameKana: z.string().nullable(),
    displayName: z.string(),
    email: z.string(),
    phoneNumber: z.string(),
    alternativePhone: z.string().nullable(),
    staffCode: z.string().nullable(),
    level: z.string(),
    position: z.string().nullable(),
    specialties: z.array(z.string()),
    bio: z.string().nullable(),
    imageUrl: z.string().nullable(),
    yearsOfExperience: z.number().nullable(),
    certifications: z.array(z.string()),
    hireDate: z.string().nullable(),
    employmentType: z.string().nullable(),
    baseSalary: z.number().nullable(),
    commissionRate: z.string().nullable(),
    canReceiveBookings: z.boolean(),
    maxConcurrentBookings: z.number(),
    bufferTimeBefore: z.number(),
    bufferTimeAfter: z.number(),
    isActive: z.boolean(),
    removed: z.boolean(),
    updatedAt: z.string(),
  }),
)

/** A member as the database of the API keeps them, by their address of mail; `undefined` for none. */
export const storedMemberOf = async (email: string) =>
  storedSchema.parse(
    await testApi().query(
      `select "firstName", "lastName", "firstNameKana", "lastNameKana", "displayName", email,
              "phoneNumber", "alternativePhone", "staffCode", level::text as level, position,
              specialties, bio, "imageUrl", "yearsOfExperience", certifications,
              "hireDate"::text as "hireDate", "employmentType", "baseSalary",
              "commissionRate"::text as "commissionRate", "canReceiveBookings",
              "maxConcurrentBookings", "bufferTimeBefore", "bufferTimeAfter", "isActive",
              "deletedAt" is not null as removed, "updatedAt"::text as "updatedAt"
       from staff where email = $1 order by "createdAt" desc limit 1`,
      [email],
    ),
  )[0]

/** How many members the ledger of the salon in Tokyo has, those removed left out. */
export const ledgerSize = async (): Promise<number> =>
  countOf(
    `select count(*)::int as count from staff
       join salons on salons.id = staff."salonId"
       where salons.name = 'Beauty Studio Tokyo' and staff."deletedAt" is null`,
    [],
  )
