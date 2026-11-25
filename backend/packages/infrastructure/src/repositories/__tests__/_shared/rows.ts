import {
  bookingServices,
  bookings,
  customers,
  salons,
  serviceCategories,
  services,
  staff,
} from '@beauty-salon-backend/database'
import type {
  DbNewOpeningHours,
  DbNewSalon,
  DbNewService,
  DbNewServiceCategory,
  DbNewServiceOption,
} from '@beauty-salon-backend/domain'
import type { Database } from '../../../database/index'

/*
 * The rows of the tests of the repositories: what a repository is given to
 * write (`new…`), and the rows a test puts in by itself for what the
 * repository reads (`insert…`). Every row names its salon, and every value
 * that has to be unique is made unique.
 */

let made = 0

/** A number of its own for every row, for the values that have to be unique. */
const nextNumber = (): number => {
  made += 1
  return made
}

/** The one row a write returned. */
const theRow = <T>(rows: T[]): T => {
  const [row] = rows
  if (row === undefined) {
    throw new Error('The write returned no row')
  }
  return row
}

/** A salon to create, in Minato, Tokyo, with nothing it may leave out. */
export const newSalon = (overrides: Partial<DbNewSalon> = {}): DbNewSalon => {
  const number = nextNumber()
  return {
    name: `Hair Studio ${number}`,
    nameKana: null,
    description: null,
    postalCode: '107-0062',
    prefecture: '東京都',
    city: '港区',
    address: '南青山1-2-3',
    building: null,
    latitude: null,
    longitude: null,
    phoneNumber: '03-1234-5678',
    alternativePhone: null,
    email: `salon-${number}@example.com`,
    websiteUrl: null,
    logoUrl: null,
    imageUrls: [],
    features: [],
    amenities: [],
    businessHours: null,
    timezone: 'Asia/Tokyo',
    currency: 'JPY',
    taxRate: '10.00',
    isActive: true,
    ...overrides,
  }
}

/** The hours of a day the salon is open, from ten to seven. */
export const newOpeningHours = (
  overrides: Partial<DbNewOpeningHours> = {},
): DbNewOpeningHours => ({
  dayOfWeek: 'monday',
  date: '2026-12-07',
  openTime: '10:00:00',
  closeTime: '19:00:00',
  isHoliday: false,
  holidayName: null,
  notes: null,
  ...overrides,
})

/** A category to create, at the top of the hierarchy. */
export const newCategory = (
  overrides: Partial<DbNewServiceCategory> = {},
): DbNewServiceCategory => ({
  name: `カット ${nextNumber()}`,
  description: null,
  parentId: null,
  category: 'cut',
  displayOrder: 10,
  iconUrl: null,
  color: null,
  isActive: true,
  ...overrides,
})

/** A service to create, of no category, which is no package. */
export const newService = (
  overrides: Partial<DbNewService> = {},
): DbNewService => ({
  categoryId: null,
  name: `カット＆ブロー ${nextNumber()}`,
  description: null,
  shortDescription: null,
  duration: 60,
  price: 6600,
  discountPrice: null,
  taxIncluded: true,
  pricingStrategy: 'fixed',
  imageUrl: null,
  imageUrls: [],
  requiredStaffLevel: null,
  maxBookingsPerDay: null,
  requiresConsultation: false,
  allowOnlineBooking: true,
  bookingRequirements: [],
  isPackage: false,
  packageServiceIds: [],
  tags: [],
  sortOrder: 10,
  serviceStatus: 'active',
  availability: 'always',
  isActive: true,
  ...overrides,
})

/** An option to create with a service. */
export const newOption = (
  overrides: Partial<DbNewServiceOption> = {},
): DbNewServiceOption => ({
  name: 'トリートメント',
  description: null,
  optionType: 'addon',
  additionalTime: 15,
  additionalPrice: 1100,
  maxQuantity: 1,
  isRequired: false,
  sortOrder: 1,
  isActive: true,
  ...overrides,
})

/** A salon in the table, with the columns that the platform keeps too. */
export const insertSalon = async (
  db: Database,
  overrides: Partial<typeof salons.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(salons)
      .values({ ...newSalon(), ...overrides })
      .returning(),
  )

/** A category of the salon in the table. */
export const insertCategory = async (
  db: Database,
  salonId: string,
  overrides: Partial<typeof serviceCategories.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(serviceCategories)
      .values({ ...newCategory(), salonId, ...overrides })
      .returning(),
  )

/** A service of the salon in the table, deleted when the test says so. */
export const insertService = async (
  db: Database,
  salonId: string,
  overrides: Partial<typeof services.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(services)
      .values({ ...newService(), salonId, ...overrides })
      .returning(),
  )

/** A customer in the table. */
export const insertCustomer = async (db: Database) => {
  const number = nextNumber()
  return theRow(
    await db
      .insert(customers)
      .values({
        firstName: '花子',
        lastName: '山田',
        email: `customer-${number}@example.com`,
        phoneNumber: '090-1234-5678',
        tags: [],
      })
      .returning(),
  )
}

/** A member of the staff of the salon in the table. */
export const insertStaffMember = async (db: Database, salonId: string) => {
  const number = nextNumber()
  return theRow(
    await db
      .insert(staff)
      .values({
        salonId,
        firstName: '太郎',
        lastName: '佐藤',
        displayName: `佐藤 ${number}`,
        email: `staff-${number}@example.com`,
        phoneNumber: '090-8765-4321',
        specialties: [],
        certifications: [],
      })
      .returning(),
  )
}

/** Who a booking is of, at which salon, and with whom. */
export type BookingParties = {
  salonId: string
  customerId: string
  staffId: string
}

/** A booking in the table, an hour long, pending unless the test says otherwise. */
export const insertBooking = async (
  db: Database,
  parties: BookingParties,
  overrides: Partial<typeof bookings.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-TEST-${String(nextNumber()).padStart(4, '0')}`,
        ...parties,
        bookingDate: '2026-12-07',
        startTime: '2026-12-07T01:00:00Z',
        endTime: '2026-12-07T02:00:00Z',
        duration: 60,
        subtotal: 6600,
        totalAmount: 6600,
        ...overrides,
      })
      .returning(),
  )

/** A service line of the booking in the table, over the whole booking. */
export const insertBookingLine = async (
  db: Database,
  bookingId: string,
  serviceId: string,
  overrides: Partial<typeof bookingServices.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(bookingServices)
      .values({
        bookingId,
        serviceId,
        startTime: '2026-12-07T01:00:00Z',
        endTime: '2026-12-07T02:00:00Z',
        duration: 60,
        price: 6600,
        finalPrice: 6600,
        taxIncluded: true,
        ...overrides,
      })
      .returning(),
  )

/** The columns of a booking that has finished: it was completed. */
export const COMPLETED: Partial<typeof bookings.$inferInsert> = {
  status: 'completed',
  completedAt: '2026-12-07T02:00:00Z',
}

/** The columns of a booking that has finished: it was cancelled. */
export const CANCELLED: Partial<typeof bookings.$inferInsert> = {
  status: 'cancelled',
  cancelledAt: '2026-12-06T09:00:00Z',
}
