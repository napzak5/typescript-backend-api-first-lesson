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

export interface UserSeedResult {
  userIds: string[]
  adminUserId: string
  ownerUserId: string
  managerUserId: string
  staffUserIds: string[]
  customerUserIds: string[]
}

export async function seedUsers(
  db: PostgresJsDatabase<typeof schema>,
): Promise<UserSeedResult> {
  // Create admin user
  const adminUser = await db
    .insert(schema.users)
    .values({
      email: 'admin@beautysalon.jp',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'admin',
      status: 'active',
      emailVerified: true,
      twoFactorEnabled: false,
      failedLoginAttempts: 0,
      permissions: ['all'],
      metadata: { createdBy: 'seed' },
    })
    .returning({ id: schema.users.id })

  // Create owner user
  const ownerUser = await db
    .insert(schema.users)
    .values({
      email: 'owner@beautysalon.jp',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'owner',
      status: 'active',
      emailVerified: true,
      twoFactorEnabled: false,
      failedLoginAttempts: 0,
      permissions: [],
      metadata: { createdBy: 'seed' },
    })
    .returning({ id: schema.users.id })

  // Create manager user
  const managerUser = await db
    .insert(schema.users)
    .values({
      email: 'manager@beautysalon.jp',
      passwordHash: SEED_PASSWORD_HASH,
      role: 'manager',
      status: 'active',
      emailVerified: true,
      twoFactorEnabled: false,
      failedLoginAttempts: 0,
      permissions: ['manage_staff', 'manage_bookings', 'view_reports'],
      metadata: { createdBy: 'seed' },
    })
    .returning({ id: schema.users.id })

  // Create staff users
  const staffUsers = await db
    .insert(schema.users)
    .values([
      {
        email: 'stylist1@beautysalon.jp',
        passwordHash: SEED_PASSWORD_HASH,
        role: 'staff',
        status: 'active',
        emailVerified: true,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        permissions: ['view_bookings', 'manage_own_schedule'],
        metadata: { createdBy: 'seed' },
      },
      {
        email: 'stylist2@beautysalon.jp',
        passwordHash: SEED_PASSWORD_HASH,
        role: 'staff',
        status: 'active',
        emailVerified: true,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        permissions: ['view_bookings', 'manage_own_schedule'],
        metadata: { createdBy: 'seed' },
      },
      {
        email: 'therapist@beautysalon.jp',
        passwordHash: SEED_PASSWORD_HASH,
        role: 'staff',
        status: 'active',
        emailVerified: true,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        permissions: ['view_bookings', 'manage_own_schedule'],
        metadata: { createdBy: 'seed' },
      },
    ])
    .returning({ id: schema.users.id })

  // Create customer users
  const customerUsers = await db
    .insert(schema.users)
    .values([
      {
        email: 'customer1@example.com',
        passwordHash: SEED_PASSWORD_HASH,
        role: 'customer',
        status: 'active',
        emailVerified: true,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        permissions: [],
        metadata: { createdBy: 'seed' },
      },
      {
        email: 'customer2@example.com',
        passwordHash: SEED_PASSWORD_HASH,
        role: 'customer',
        status: 'active',
        emailVerified: true,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        permissions: [],
        metadata: { createdBy: 'seed' },
      },
      {
        email: 'customer3@example.com',
        passwordHash: SEED_PASSWORD_HASH,
        role: 'customer',
        status: 'active',
        emailVerified: true,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        permissions: [],
        metadata: { createdBy: 'seed' },
      },
      {
        email: 'vip.customer@example.com',
        passwordHash: SEED_PASSWORD_HASH,
        role: 'customer',
        status: 'active',
        emailVerified: true,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        permissions: [],
        metadata: { createdBy: 'seed', vip: true },
      },
    ])
    .returning({ id: schema.users.id })

  const adminUserId = adminUser[0]?.id ?? ''
  const ownerUserId = ownerUser[0]?.id ?? ''
  const managerUserId = managerUser[0]?.id ?? ''
  const staffUserIds = staffUsers.map((u) => u.id)
  const customerUserIds = customerUsers.map((u) => u.id)
  const allUserIds = [
    adminUserId,
    ownerUserId,
    managerUserId,
    ...staffUserIds,
    ...customerUserIds,
  ]

  return {
    userIds: allUserIds,
    adminUserId,
    ownerUserId,
    managerUserId,
    staffUserIds,
    customerUserIds,
  }
}
