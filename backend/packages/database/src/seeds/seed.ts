import { drizzle } from 'drizzle-orm/postgres-js'
import type postgres from 'postgres'
import * as schema from '../schema'
import { seedBookings } from './seed-data/bookings'
import { seedCustomerAllergies } from './seed-data/customer-allergies'
import { seedCustomers } from './seed-data/customers'
import { seedMedicalCharts } from './seed-data/medical-charts'
import { seedOpeningHours } from './seed-data/opening-hours'
import { seedPaymentMethods } from './seed-data/payment-methods'
import { seedProducts } from './seed-data/products'
import { seedReviews } from './seed-data/reviews'
import { seedSalons } from './seed-data/salons'
import { seedServiceCategories } from './seed-data/service-categories'
import { seedServices } from './seed-data/services'
import { seedStaff } from './seed-data/staff'
import { seedTreatmentRecords } from './seed-data/treatment-records'
import { seedUsers } from './seed-data/users'

/**
 * Inserts the seed data into a database without data, in the order of the
 * rows each step names, and says each step to `say` before it is taken.
 * Every step is given the rows of the steps before it by name.
 */
export async function seed(
  client: postgres.Sql,
  say: (line: string) => void,
): Promise<void> {
  const db = drizzle(client, { schema })

  say('Seeding salons...')
  const salons = await seedSalons(db)

  say('Seeding users...')
  const users = await seedUsers(db)

  say('Seeding customers...')
  const customers = await seedCustomers(db, users)

  say('Seeding medical charts...')
  await seedMedicalCharts(db, customers)

  say('Seeding customer allergies...')
  await seedCustomerAllergies(db, customers)

  say('Seeding staff...')
  const staff = await seedStaff(db, salons, users)

  say('Seeding service categories...')
  const categories = await seedServiceCategories(db, salons)

  say('Seeding services...')
  const services = await seedServices(db, salons, categories)

  say('Seeding opening hours...')
  await seedOpeningHours(db, salons)

  say('Seeding payment methods...')
  await seedPaymentMethods(db, salons)

  say('Seeding products and inventory...')
  const stock = await seedProducts(db, salons)

  say('Seeding bookings...')
  const visits = await seedBookings(db, {
    salons,
    customers,
    staff,
    services,
  })

  say('Seeding reviews...')
  await seedReviews(db, { visits, customers, users })

  say('Seeding treatment records...')
  await seedTreatmentRecords(db, visits, stock)

  say('Seeding completed successfully!')
}

/** Inserts the seed data and says nothing: for the test server of the API. */
export const seedDatabase = (client: postgres.Sql): Promise<void> =>
  seed(client, () => {})
