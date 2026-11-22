import { describe, expect, it } from 'vitest'
import * as z from 'zod'
import { testApi } from '../api/test-api'
import {
  CUSTOMER,
  KENJI,
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  SAKURA,
  STYLIST,
  THERAPIST,
  TOKYO,
  VIP,
  YUKI,
} from './seed'

const namesSchema = z.array(z.object({ name: z.string() }))

const accountsSchema = z.array(
  z.object({
    role: z.string(),
    salon: z.string().nullable(),
    staffCode: z.string().nullable(),
  }),
)

/**
 * What an account may do, and the member of the staff it signs in: the
 * salon, and the code the salon knows the member by.
 */
const accountOf = async (email: string) =>
  accountsSchema.parse(
    await testApi().query(
      `select users.role::text as role, salons.name as salon, staff."staffCode"
       from users
       left join staff on staff.id = users."staffId"
       left join salons on salons.id = staff."salonId"
       where users.email = $1`,
      [email],
    ),
  )

/** The customers of the ledger with an address of mail, as the ledger names them, and whether they have an account. */
const customersSchema = z.array(
  z.object({ name: z.string(), role: z.string().nullable() }),
)

const customerOf = async (email: string) =>
  customersSchema.parse(
    await testApi().query(
      `select customers."lastName" || ' ' || customers."firstName" as name, users.role::text as role
       from customers
       left join users on users."customerId" = customers.id
       where customers.email = $1`,
      [email],
    ),
  )

describe('the names of the seed data', () => {
  it('are the names of the salons, and of no other', async () => {
    // Act
    const salons = namesSchema.parse(
      await testApi().query('select name from salons order by name'),
    )

    // Assert
    expect(salons).toEqual([{ name: TOKYO }, { name: OSAKA }])
  })

  it.each<[string, string, string | null, string | null]>([
    [OWNER, 'owner', TOKYO, 'STF900'],
    [MANAGER, 'manager', TOKYO, 'STF901'],
    [STYLIST, 'staff', TOKYO, 'STF001'],
    [THERAPIST, 'staff', OSAKA, 'STF003'],
    [OPERATOR, 'admin', null, null],
  ])(
    'are the address of an account: %s is one of the role %s',
    async (email, role, salon, staffCode) => {
      // Act, Assert
      expect(await accountOf(email)).toEqual([{ role, salon, staffCode }])
    },
  )

  it.each<[{ email: string; name: string }]>([
    [YUKI],
    [KENJI],
    [SAKURA],
    [VIP],
  ])(
    'are the address and the name of a customer who has an account: %o',
    async ({ email, name }) => {
      // Act, Assert
      expect(await customerOf(email)).toEqual([{ name, role: 'customer' }])
      expect(await accountOf(email)).toEqual([
        { role: 'customer', salon: null, staffCode: null },
      ])
    },
  )

  it('name four customers, each another one', () => {
    // Act
    const addresses = new Set(
      [YUKI, KENJI, SAKURA, VIP].map(({ email }) => email),
    )

    // Assert
    expect(addresses.size).toBe(4)
  })

  it('name the first of the customers as the one who signs in', () => {
    // Act, Assert
    expect(CUSTOMER).toBe('customer1@example.com')
    expect(CUSTOMER).toBe(YUKI.email)
  })
})
