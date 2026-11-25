import { randomUUID } from 'node:crypto'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'

/**
 * The password of every seeded account. It is published here, so the seed is
 * for databases that hold no real data; `pnpm db:seed` refuses to run
 * against production.
 */
export const SEED_PASSWORD = 'salon-seed-password-2026'

/**
 * `SEED_PASSWORD` hashed the way the API hashes passwords: Argon2id with 19
 * MiB of memory, 2 passes and 1 lane, as a PHC string.
 */
const SEED_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$AABD2Mjo1lonar7WBG9dsw$MYHoXS5BdIe/gt7ym0IRRTM+VUQzNLMN263lSdCjuzs'

/** The IDs of the accounts: one of each role of the platform and a salon. */
export interface SeededUsers {
  readonly admin: string
  readonly owner: string
  readonly manager: string
  /** The accounts of the staff who take bookings */
  readonly stylist1: string
  readonly stylist2: string
  readonly therapist: string
  /** The accounts of the customers, in the order of the customers */
  readonly customer1: string
  readonly customer2: string
  readonly customer3: string
  readonly vipCustomer: string
}

export async function seedUsers(
  db: PostgresJsDatabase<typeof schema>,
): Promise<SeededUsers> {
  const users: SeededUsers = {
    admin: randomUUID(),
    owner: randomUUID(),
    manager: randomUUID(),
    stylist1: randomUUID(),
    stylist2: randomUUID(),
    therapist: randomUUID(),
    customer1: randomUUID(),
    customer2: randomUUID(),
    customer3: randomUUID(),
    vipCustomer: randomUUID(),
  }

  // Create admin user
  await db.insert(schema.users).values({
    id: users.admin,
    email: 'admin@beautysalon.jp',
    passwordHash: SEED_PASSWORD_HASH,
    role: 'admin',
    status: 'active',
    emailVerified: true,
    failedLoginAttempts: 0,
  })

  // Create owner user
  await db.insert(schema.users).values({
    id: users.owner,
    email: 'owner@beautysalon.jp',
    passwordHash: SEED_PASSWORD_HASH,
    role: 'owner',
    status: 'active',
    emailVerified: true,
    failedLoginAttempts: 0,
  })

  // Create manager user
  await db.insert(schema.users).values({
    id: users.manager,
    email: 'manager@beautysalon.jp',
    passwordHash: SEED_PASSWORD_HASH,
    role: 'manager',
    status: 'active',
    emailVerified: true,
    failedLoginAttempts: 0,
  })

  // Create staff users
  await db.insert(schema.users).values([
    {
      id: users.stylist1,
      email: 'stylist1@beautysalon.jp',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'staff',
      status: 'active',
      emailVerified: true,
      failedLoginAttempts: 0,
    },
    {
      id: users.stylist2,
      email: 'stylist2@beautysalon.jp',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'staff',
      status: 'active',
      emailVerified: true,
      failedLoginAttempts: 0,
    },
    {
      id: users.therapist,
      email: 'therapist@beautysalon.jp',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'staff',
      status: 'active',
      emailVerified: true,
      failedLoginAttempts: 0,
    },
  ])

  // Create customer users
  await db.insert(schema.users).values([
    {
      id: users.customer1,
      email: 'customer1@example.com',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'customer',
      status: 'active',
      emailVerified: true,
      failedLoginAttempts: 0,
    },
    {
      id: users.customer2,
      email: 'customer2@example.com',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'customer',
      status: 'active',
      emailVerified: true,
      failedLoginAttempts: 0,
    },
    {
      id: users.customer3,
      email: 'customer3@example.com',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'customer',
      status: 'active',
      emailVerified: true,
      failedLoginAttempts: 0,
    },
    {
      id: users.vipCustomer,
      email: 'vip.customer@example.com',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'customer',
      status: 'active',
      emailVerified: true,
      failedLoginAttempts: 0,
    },
  ])

  return users
}
