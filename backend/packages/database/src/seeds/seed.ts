import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
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
 * Main seeding function
 */
export async function seed(
  db: PostgresJsDatabase<typeof schema>,
): Promise<void> {
  // Seed base data in order of dependencies
  console.log('Seeding salons...')
  const salonIds = await seedSalons(db)

  console.log('Seeding users...')
  const userResult = await seedUsers(db)

  console.log('Seeding customers...')
  const customerResult = await seedCustomers(db, {
    customerUserIds: userResult.customerUserIds,
  })

  console.log('Seeding medical charts...')
  await seedMedicalCharts(db, customerResult.customerIds)

  console.log('Seeding customer allergies...')
  await seedCustomerAllergies(db, customerResult.customerIds)

  console.log('Seeding staff...')
  await seedStaff(db, salonIds, {
    staffUserIds: userResult.staffUserIds,
    ownerUserId: userResult.ownerUserId,
    managerUserId: userResult.managerUserId,
  })

  console.log('Seeding service categories...')
  const categoryResult = await seedServiceCategories(db, salonIds)

  console.log('Seeding services...')
  await seedServices(db, salonIds, categoryResult)

  console.log('Seeding opening hours...')
  await seedOpeningHours(db, salonIds)

  console.log('Seeding payment methods...')
  await seedPaymentMethods(db, salonIds)

  console.log('Seeding products and inventory...')
  await seedProducts(db, salonIds)

  console.log('Seeding bookings...')
  const completedBookings = await seedBookings(db, {
    salonIds,
    customerIds: customerResult.customerIds,
    vipCustomerId: customerResult.vipCustomerId,
  })

  console.log('Seeding reviews...')
  await seedReviews(db, completedBookings, customerResult.customerIds, {
    adminUserId: userResult.adminUserId,
  })

  const [firstSalonId] = salonIds
  if (firstSalonId !== undefined) {
    console.log('Seeding treatment records...')
    await seedTreatmentRecords(db, completedBookings, firstSalonId)
  }

  console.log('Seeding completed successfully!')
}

/**
 * Inserts the seed data over a connection: for a caller outside this package,
 * which has no Drizzle instance of the type that `seed` takes.
 */
export const seedDatabase = (client: postgres.Sql): Promise<void> =>
  seed(drizzle(client, { schema }))
