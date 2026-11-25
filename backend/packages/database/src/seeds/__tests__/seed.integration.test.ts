import type postgres from 'postgres'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTestDatabases } from '../../__tests__/_shared/test-databases'
import { rowCountsOf } from '../../scripts/tables'
import { getSetupSql } from '../../setup-sql'
import { seed, seedDatabase } from '../seed'

const databases = useTestDatabases()
const connections: postgres.Sql[] = []

afterEach(async () => {
  await Promise.all(connections.splice(0).map((sql) => sql.end()))
  vi.restoreAllMocks()
})

/** A connection to the database of the test, which has the schema and no data. */
const emptyDatabase = async (): Promise<postgres.Sql> => {
  const sql = databases.connect()
  connections.push(sql)
  await sql.unsafe(getSetupSql())
  return sql
}

/** The number of rows of every table that has rows. */
const rowsOf = async (sql: postgres.Sql): Promise<Record<string, number>> =>
  Object.fromEntries(
    (await rowCountsOf(sql))
      .filter(({ count }) => count > 0)
      .map(({ table, count }) => [table, count]),
  )

/** What the seed inserts: the rows of every table it writes to. */
const SEEDED_ROWS = {
  booking_services: 20,
  booking_status_histories: 33,
  bookings: 16,
  customer_allergies: 2,
  customer_points: 4,
  customer_versions: 4,
  customers: 4,
  inventory: 6,
  inventory_transactions: 6,
  medical_charts: 2,
  opening_hours: 20,
  payment_methods: 14,
  products: 9,
  purchase_order_items: 3,
  purchase_orders: 2,
  review_helpful_votes: 9,
  review_reports: 2,
  reviews: 5,
  salons: 2,
  service_categories: 16,
  service_options: 2,
  services: 15,
  staff: 6,
  staff_schedules: 18,
  treatment_materials: 3,
  treatment_photos: 3,
  treatment_records: 3,
  users: 10,
}

/** What the database answers to a query of one count. */
const countOf = async (
  sql: postgres.Sql,
  query: string,
): Promise<number | undefined> => {
  const [row] = await sql.unsafe<{ count: number }[]>(query)
  return row?.count
}

describe('seed', () => {
  it('should insert the rows of every table it writes to, and say each step before it is taken', async () => {
    // Arrange
    const sql = await emptyDatabase()
    const said: string[] = []

    // Act
    await seed(sql, (line) => {
      said.push(line)
    })

    // Assert
    expect(await rowsOf(sql)).toEqual(SEEDED_ROWS)
    expect(said).toEqual([
      'Seeding salons...',
      'Seeding users...',
      'Seeding customers...',
      'Seeding medical charts...',
      'Seeding customer allergies...',
      'Seeding staff...',
      'Seeding service categories...',
      'Seeding services...',
      'Seeding opening hours...',
      'Seeding payment methods...',
      'Seeding products and inventory...',
      'Seeding bookings...',
      'Seeding reviews...',
      'Seeding treatment records...',
      'Seeding completed successfully!',
    ])
  })

  it('should name, in every row, rows of the salon of the row', async () => {
    // Arrange
    const sql = await emptyDatabase()

    // Act
    await seed(sql, () => {})

    // Assert
    // The staff and the services of the lines of a booking
    expect(
      await countOf(
        sql,
        `SELECT count(*)::integer AS count
         FROM booking_services line
         JOIN bookings booking ON booking.id = line."bookingId"
         JOIN services service ON service.id = line."serviceId"
         JOIN staff member ON member.id = line."staffId"
         WHERE service."salonId" <> booking."salonId" OR member."salonId" <> booking."salonId"`,
      ),
    ).toBe(0)
    // The staff member in charge of a booking
    expect(
      await countOf(
        sql,
        `SELECT count(*)::integer AS count
         FROM bookings booking JOIN staff member ON member.id = booking."staffId"
         WHERE member."salonId" <> booking."salonId"`,
      ),
    ).toBe(0)
    // The members of a package
    expect(
      await countOf(
        sql,
        `SELECT count(*)::integer AS count
         FROM services package
         JOIN services member ON member.id = ANY (package."packageServiceIds")
         WHERE member."salonId" <> package."salonId"`,
      ),
    ).toBe(0)
    // The category of a service
    expect(
      await countOf(
        sql,
        `SELECT count(*)::integer AS count
         FROM services service JOIN service_categories category ON category.id = service."categoryId"
         WHERE category."salonId" <> service."salonId"`,
      ),
    ).toBe(0)
  })

  it('should write the reviews and the treatment records of visits that took place, as the customer and the staff member of the visit', async () => {
    // Arrange
    const sql = await emptyDatabase()

    // Act
    await seed(sql, () => {})

    // Assert
    expect(
      await countOf(
        sql,
        `SELECT count(*)::integer AS count
         FROM reviews review JOIN bookings visit ON visit.id = review."bookingId"
         WHERE visit.status <> 'completed'
           OR (review."salonId", review."customerId", review."staffId")
              IS DISTINCT FROM (visit."salonId", visit."customerId", visit."staffId")`,
      ),
    ).toBe(0)
    expect(
      await countOf(
        sql,
        `SELECT count(*)::integer AS count
         FROM treatment_records record JOIN bookings visit ON visit.id = record."bookingId"
         WHERE visit.status <> 'completed'
           OR (record."customerId", record."staffId")
              IS DISTINCT FROM (visit."customerId", visit."staffId")`,
      ),
    ).toBe(0)
  })

  it('should give every account of a customer or a staff member the row it is of, and the row the account', async () => {
    // Arrange
    const sql = await emptyDatabase()

    // Act
    await seed(sql, () => {})

    // Assert
    expect(
      await countOf(
        sql,
        `SELECT count(*)::integer AS count
         FROM users account LEFT JOIN customers customer ON customer.id = account."customerId"
         WHERE account.role = 'customer'
           AND customer."userId" IS DISTINCT FROM account.id`,
      ),
    ).toBe(0)
    expect(
      await countOf(
        sql,
        `SELECT count(*)::integer AS count
         FROM staff member JOIN users account ON account.id = member."userId"
         WHERE account."staffId" IS DISTINCT FROM member.id`,
      ),
    ).toBe(0)
  })
})

describe('seedDatabase', () => {
  it('should insert the same rows as the seed, and say nothing', async () => {
    // Arrange
    const sql = await emptyDatabase()
    const log = vi.spyOn(console, 'log')

    // Act
    await seedDatabase(sql)

    // Assert
    expect(await rowsOf(sql)).toEqual(SEEDED_ROWS)
    expect(log).not.toHaveBeenCalled()
  })
})
