import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import type { SeededUsers } from './users'

/** The four customers: three regulars and a VIP, each with an account. */
export type CustomerKey = 'first' | 'second' | 'third' | 'vip'

export type SeededCustomers = Readonly<Record<CustomerKey, string>>

export async function seedCustomers(
  db: PostgresJsDatabase<typeof schema>,
  users: SeededUsers,
): Promise<SeededCustomers> {
  const ids: SeededCustomers = {
    first: randomUUID(),
    second: randomUUID(),
    third: randomUUID(),
    vip: randomUUID(),
  }
  const customers = await db
    .insert(schema.customers)
    .values([
      {
        id: ids.first,
        userId: users.customer1,
        firstName: 'Yuki',
        lastName: 'Tanaka',
        firstNameKana: 'ユキ',
        lastNameKana: 'タナカ',
        email: 'customer1@example.com',
        phoneNumber: '+81-90-1234-5678',
        birthDate: '1990-05-15',
        gender: 'female',
        occupation: 'Designer',
        postalCode: '153-0063',
        prefecture: 'Tokyo',
        city: 'Meguro-ku',
        address: '7-8-9 Meguro',
        building: 'Meguro Heights 301',
        membershipTier: 'gold',
        loyaltyPoints: 2500,
        preferences: {
          preferredServices: ['cut', 'color'],
          notes: 'Prefers organic products',
        },
        tags: ['vip', 'organic-preference'],
        allowMarketing: true,
        allowSms: true,
        allowEmail: true,
        isActive: true,
      },
      {
        id: ids.second,
        userId: users.customer2,
        firstName: 'Kenji',
        lastName: 'Yamamoto',
        firstNameKana: 'ケンジ',
        lastNameKana: 'ヤマモト',
        email: 'customer2@example.com',
        phoneNumber: '+81-80-9876-5432',
        birthDate: '1985-11-20',
        gender: 'male',
        occupation: 'Software Engineer',
        postalCode: '105-0001',
        prefecture: 'Tokyo',
        city: 'Minato-ku',
        address: '2-3-4 Minato',
        membershipTier: 'silver',
        loyaltyPoints: 800,
        preferences: {
          preferredServices: ['cut'],
          notes: 'Monthly regular customer',
        },
        tags: ['regular', 'monthly'],
        allowMarketing: true,
        allowSms: false,
        allowEmail: true,
        isActive: true,
      },
      {
        id: ids.third,
        userId: users.customer3,
        firstName: 'Sakura',
        lastName: 'Sato',
        firstNameKana: 'サクラ',
        lastNameKana: 'サトウ',
        email: 'customer3@example.com',
        phoneNumber: '+81-70-1111-2222',
        birthDate: '1995-03-10',
        gender: 'female',
        occupation: 'Marketing Manager',
        postalCode: '160-0022',
        prefecture: 'Tokyo',
        city: 'Shinjuku-ku',
        address: '5-6-7 Shinjuku',
        building: 'Shinjuku Tower 15F',
        membershipTier: 'regular',
        loyaltyPoints: 300,
        preferences: {
          preferredServices: ['color', 'treatment', 'spa'],
          notes: 'Sensitive skin, requires patch test',
        },
        tags: ['sensitive-skin', 'treatment-focus'],
        allowMarketing: true,
        allowSms: true,
        allowEmail: true,
        isActive: true,
      },
      {
        id: ids.vip,
        userId: users.vipCustomer,
        firstName: 'Hiroshi',
        lastName: 'Nakamura',
        firstNameKana: 'ヒロシ',
        lastNameKana: 'ナカムラ',
        email: 'vip.customer@example.com',
        phoneNumber: '+81-90-5555-6666',
        birthDate: '1975-07-25',
        gender: 'male',
        occupation: 'CEO',
        postalCode: '107-0052',
        prefecture: 'Tokyo',
        city: 'Minato-ku',
        address: '1-1-1 Roppongi',
        building: 'Roppongi Hills Residence',
        membershipTier: 'platinum',
        loyaltyPoints: 10000,
        preferences: {
          preferredServices: ['cut', 'spa', 'treatment'],
          notes: 'VIP customer, requires private room',
        },
        tags: ['vip', 'platinum', 'high-value'],
        allowMarketing: false,
        allowSms: false,
        allowEmail: true,
        isActive: true,
      },
    ])
    // The whole rows: the versions below begin with what they hold.
    .returning()

  // The balance of a customer is that of their latest point transaction:
  // each balance above is opened as the migration of the points ledger
  // opens the balances it finds.
  await db.insert(schema.customerPoints).values(
    customers
      .filter(({ loyaltyPoints }) => loyaltyPoints > 0)
      .map(
        ({ id, loyaltyPoints }): typeof schema.customerPoints.$inferInsert => ({
          customerId: id,
          transactionType: 'adjusted',
          points: loyaltyPoints,
          balance: loyaltyPoints,
          description: 'ポイント台帳の開始残高',
        }),
      ),
  )

  // The values the seed gives the customers are where their versions begin,
  // as for the customers who were there before versions were kept.
  await db.insert(schema.customerVersions).values(
    customers.map(
      ({
        id,
        userId,
        loyaltyPoints,
        firstVisitDate,
        lastVisitDate,
        visitCount,
        noShowCount,
        cancellationCount,
        deletedAt,
        createdAt,
        updatedAt,
        ...ledger
      }): typeof schema.customerVersions.$inferInsert => ({
        ...ledger,
        customerId: id,
        version: 1,
        operation: 'baseline',
        changedBy: null,
        changedAt: updatedAt,
      }),
    ),
  )

  // Each account is that of its customer
  const accounts: [userId: string, customerId: string][] = [
    [users.customer1, ids.first],
    [users.customer2, ids.second],
    [users.customer3, ids.third],
    [users.vipCustomer, ids.vip],
  ]
  for (const [userId, customerId] of accounts) {
    await db
      .update(schema.users)
      .set({ customerId })
      .where(eq(schema.users.id, userId))
  }

  return ids
}
