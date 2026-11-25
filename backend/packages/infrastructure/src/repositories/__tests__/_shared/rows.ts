import {
  bookingServices,
  bookings,
  customerAllergies,
  customerDeletionRequests,
  customerPoints,
  customerPreferences,
  customers,
  inventory,
  medicalCharts,
  openingHours,
  paymentMethods,
  paymentTransactions,
  products,
  reviewHelpfulVotes,
  reviewReports,
  reviews,
  sales,
  salesDetails,
  salons,
  serviceCategories,
  services,
  sessions,
  staff,
  staffInvitations,
  staffSchedules,
  treatmentMaterials,
  treatmentPhotos,
  treatmentRecords,
  users,
} from '@beauty-salon-backend/database'
import type {
  DbNewCustomer,
  DbNewOpeningHours,
  DbNewSalon,
  DbNewService,
  DbNewServiceCategory,
  DbNewServiceOption,
  DbNewSession,
  DbNewStaff,
  DbNewStaffSchedule,
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

/** A customer to register, with nothing they may leave out: a regular customer without a referrer. */
export const newCustomer = (
  overrides: Partial<DbNewCustomer> = {},
): DbNewCustomer => ({
  firstName: '花子',
  lastName: '山田',
  firstNameKana: null,
  lastNameKana: null,
  email: `customer-${nextNumber()}@example.com`,
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  membershipTier: 'regular',
  preferences: null,
  notes: null,
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: null,
  allowMarketing: true,
  allowSms: true,
  allowEmail: true,
  isActive: true,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
  ...overrides,
})

/** A customer in the table. */
export const insertCustomer = async (
  db: Database,
  overrides: Partial<typeof customers.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(customers)
      .values({ ...newCustomer(), ...overrides })
      .returning(),
  )

/** A member of the staff to create: a stylist who works at the salon and takes bookings. */
export const newStaffMember = (
  overrides: Partial<DbNewStaff> = {},
): DbNewStaff => {
  const number = nextNumber()
  return {
    firstName: '太郎',
    lastName: '佐藤',
    firstNameKana: null,
    lastNameKana: null,
    displayName: `佐藤 ${number}`,
    email: `staff-${number}@example.com`,
    phoneNumber: '090-8765-4321',
    alternativePhone: null,
    staffCode: null,
    level: 'stylist',
    position: null,
    specialties: [],
    bio: null,
    imageUrl: null,
    yearsOfExperience: null,
    certifications: [],
    hireDate: null,
    employmentType: null,
    baseSalary: null,
    commissionRate: null,
    canReceiveBookings: true,
    maxConcurrentBookings: 1,
    bufferTimeBefore: 0,
    bufferTimeAfter: 0,
    isActive: true,
    ...overrides,
  }
}

/** A member of the staff of the salon in the table. */
export const insertStaffMember = async (
  db: Database,
  salonId: string,
  overrides: Partial<typeof staff.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(staff)
      .values({ ...newStaffMember(), salonId, ...overrides })
      .returning(),
  )

/** An account in the table: a customer's whose address is confirmed, unless the test says otherwise. */
export const insertUser = async (
  db: Database,
  overrides: Partial<typeof users.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(users)
      .values({
        email: `user-${nextNumber()}@example.com`,
        passwordHash: 'stored-hash',
        emailVerified: true,
        ...overrides,
      })
      .returning(),
  )

/** A session of the user to create: signed in at ten on 7 December, its refresh token good for a week. */
export const newSession = (
  userId: string,
  overrides: Partial<DbNewSession> = {},
): DbNewSession => {
  const number = nextNumber()
  return {
    userId,
    tokenHash: `access-${number}`,
    refreshTokenHash: `refresh-${number}`,
    ipAddress: null,
    userAgent: null,
    expiresAt: '2026-12-07T01:15:00.000Z',
    refreshExpiresAt: '2026-12-14T01:00:00.000Z',
    lastActivityAt: '2026-12-07T01:00:00.000Z',
    ...overrides,
  }
}

/** A session of the user in the table. */
export const insertSession = async (
  db: Database,
  userId: string,
  overrides: Partial<typeof sessions.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(sessions)
      .values({ ...newSession(userId), ...overrides })
      .returning(),
  )

/** An invitation of the staff member in the table, to the address the member has, good until 8 December. */
export const insertInvitation = async (
  db: Database,
  member: { id: string; email: string },
  overrides: Partial<typeof staffInvitations.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(staffInvitations)
      .values({
        staffId: member.id,
        email: member.email,
        role: 'staff',
        tokenHash: `invitation-${nextNumber()}`,
        expiresAt: '2026-12-08T01:00:00.000Z',
        ...overrides,
      })
      .returning(),
  )

/** A weekly row of the schedule of a staff member: Mondays from ten to seven. */
export const newSchedule = (
  overrides: Partial<DbNewStaffSchedule> = {},
): DbNewStaffSchedule => ({
  dayOfWeek: 'monday',
  date: null,
  startTime: '10:00:00',
  endTime: '19:00:00',
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: true,
  isAvailable: true,
  notes: null,
  ...overrides,
})

/** The hours of the salon on a date, from ten to seven on 7 December 2026 unless the test says otherwise. */
export const insertOpeningHours = async (
  db: Database,
  salonId: string,
  overrides: Partial<typeof openingHours.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(openingHours)
      .values({ ...newOpeningHours(), salonId, ...overrides })
      .returning(),
  )

/** A row of the schedule of the staff member: every Monday from ten to seven unless the test says otherwise. */
export const insertSchedule = async (
  db: Database,
  staffId: string,
  overrides: Partial<typeof staffSchedules.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(staffSchedules)
      .values({ ...newSchedule(), staffId, ...overrides })
      .returning(),
  )

/**
 * A slot a customer can book by themself: a salon in Tokyo that is open
 * from ten to seven on Monday 7 December 2026, a service of an hour that
 * is booked online, a staff member who works then, and a customer.
 */
export const insertBookableSlot = async (db: Database) => {
  const salon = await insertSalon(db)
  await insertOpeningHours(db, salon.id)
  const service = await insertService(db, salon.id)
  const member = await insertStaffMember(db, salon.id)
  await insertSchedule(db, member.id)
  const customer = await insertCustomer(db)

  return {
    salonId: salon.id,
    serviceId: service.id,
    staffId: member.id,
    customerId: customer.id,
  }
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

/** Who a sale is of: the salon, and the customer when the sale names one. */
export type SaleParties = {
  salonId: string
  customerId: string | null
}

/** A sale in the table, of 6,600 yen on 7 December, unpaid unless the test says otherwise. */
export const insertSale = async (
  db: Database,
  parties: SaleParties,
  overrides: Partial<typeof sales.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(sales)
      .values({
        saleNumber: `SL-TEST-${String(nextNumber()).padStart(4, '0')}`,
        ...parties,
        saleDate: '2026-12-07',
        saleTime: '2026-12-07T02:00:00Z',
        subtotal: 6000,
        taxAmount: 600,
        totalAmount: 6600,
        ...overrides,
      })
      .returning(),
  )

/** A line of the sale in the table: one cut. */
export const insertSaleLine = async (
  db: Database,
  saleId: string,
  overrides: Partial<typeof salesDetails.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(salesDetails)
      .values({
        saleId,
        itemType: 'service',
        itemName: 'カット',
        quantity: 1,
        unitPrice: 6000,
        taxAmount: 600,
        totalAmount: 6600,
        ...overrides,
      })
      .returning(),
  )

/** A way of paying of the salon in the table: cash, unless the test says otherwise. */
export const insertPaymentMethod = async (
  db: Database,
  salonId: string,
  overrides: Partial<typeof paymentMethods.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(paymentMethods)
      .values({ salonId, method: 'cash', displayName: '現金', ...overrides })
      .returning(),
  )

/** A payment of the sale in the table, of 6,600 yen, received unless the test says otherwise. */
export const insertPayment = async (
  db: Database,
  saleId: string,
  paymentMethodId: string,
  overrides: Partial<typeof paymentTransactions.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(paymentTransactions)
      .values({
        saleId,
        paymentMethodId,
        transactionNumber: `TX-TEST-${String(nextNumber()).padStart(4, '0')}`,
        amount: 6600,
        status: 'completed',
        processedAt: '2026-12-07T02:00:00Z',
        ...overrides,
      })
      .returning(),
  )

/** What a treatment record is of: the booking, its customer and staff member, and the service done. */
export type TreatmentParties = {
  bookingId: string
  customerId: string
  staffId: string
  serviceId: string
}

/** A treatment record of the booking in the table. */
export const insertTreatmentRecord = async (
  db: Database,
  { serviceId, ...parties }: TreatmentParties,
  overrides: Partial<typeof treatmentRecords.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(treatmentRecords)
      .values({ ...parties, services: [serviceId], ...overrides })
      .returning(),
  )

/** A product of the salon in the table: a shampoo used in treatments. */
export const insertProduct = async (
  db: Database,
  salonId: string,
  overrides: Partial<typeof products.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(products)
      .values({
        salonId,
        productCode: `P-TEST-${String(nextNumber()).padStart(4, '0')}`,
        name: 'シャンプー',
        unit: 'ml',
        ...overrides,
      })
      .returning(),
  )

/** A product used in the treatment record in the table: 20 ml, first in the record. */
export const insertTreatmentMaterial = async (
  db: Database,
  treatmentRecordId: string,
  productId: string,
  overrides: Partial<typeof treatmentMaterials.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(treatmentMaterials)
      .values({
        treatmentRecordId,
        productId,
        quantity: '20.00',
        unit: 'ml',
        sortOrder: 0,
        ...overrides,
      })
      .returning(),
  )

/** A photo of the treatment record in the table, taken before the treatment. */
export const insertTreatmentPhoto = async (
  db: Database,
  treatmentRecordId: string,
  overrides: Partial<typeof treatmentPhotos.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(treatmentPhotos)
      .values({
        treatmentRecordId,
        photoType: 'before',
        photoUrl: `https://storage.example.com/photos/${nextNumber()}.jpg`,
        ...overrides,
      })
      .returning(),
  )

/** What a review is of: the booking, its salon and its customer. */
export type ReviewParties = {
  bookingId: string
  salonId: string
  customerId: string
}

/** A review of the booking in the table, of five stars. */
export const insertReview = async (
  db: Database,
  parties: ReviewParties,
  overrides: Partial<typeof reviews.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(reviews)
      .values({ ...parties, overallRating: 5, ...overrides })
      .returning(),
  )

/** A mark of the customer that the review in the table helped. */
export const insertHelpfulVote = async (
  db: Database,
  reviewId: string,
  customerId: string,
  overrides: Partial<typeof reviewHelpfulVotes.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(reviewHelpfulVotes)
      .values({ reviewId, customerId, ...overrides })
      .returning(),
  )

/** A report of the review in the table by an account, pending: spam. */
export const insertReviewReport = async (
  db: Database,
  reviewId: string,
  reportedBy: string,
  overrides: Partial<typeof reviewReports.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(reviewReports)
      .values({ reviewId, reportedBy, reason: 'spam', ...overrides })
      .returning(),
  )

/** A stock row of the product of the salon in the table: 10 in stock, none of it reserved, of no lot. */
export const insertStock = async (
  db: Database,
  salonId: string,
  productId: string,
  overrides: Partial<typeof inventory.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(inventory)
      .values({
        salonId,
        productId,
        currentStock: '10.00',
        availableStock: '10.00',
        ...overrides,
      })
      .returning(),
  )

/** A point transaction of the customer in the table: 100 points earned, the first the customer has. */
export const insertPoints = async (
  db: Database,
  customerId: string,
  overrides: Partial<typeof customerPoints.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(customerPoints)
      .values({
        customerId,
        transactionType: 'earned',
        points: 100,
        balance: 100,
        ...overrides,
      })
      .returning(),
  )

/** The medical chart of the customer in the table, with nothing written in it. */
export const insertChart = async (
  db: Database,
  customerId: string,
  overrides: Partial<typeof medicalCharts.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(medicalCharts)
      .values({
        customerId,
        previousTreatments: [],
        preferredProducts: [],
        avoidProducts: [],
        ...overrides,
      })
      .returning(),
  )

/** An allergy of the customer in the table: a moderate one to a dye. */
export const insertAllergy = async (
  db: Database,
  customerId: string,
  overrides: Partial<typeof customerAllergies.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(customerAllergies)
      .values({
        customerId,
        allergyType: 'chemical',
        allergenName: 'ジアミン',
        severityType: 'moderate',
        ...overrides,
      })
      .returning(),
  )

/** The preferences of the customer in the table, with nothing chosen. */
export const insertPreferences = async (
  db: Database,
  customerId: string,
  overrides: Partial<typeof customerPreferences.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(customerPreferences)
      .values({
        customerId,
        preferredTimeSlots: [],
        avoidStaffIds: [],
        ...overrides,
      })
      .returning(),
  )

/** A request of the customer in the table to have their data erased: taken on 5 January 2026, and due since 19 January. */
export const insertDeletionRequest = async (
  db: Database,
  customerId: string,
  requestedBy: string,
  overrides: Partial<typeof customerDeletionRequests.$inferInsert> = {},
) =>
  theRow(
    await db
      .insert(customerDeletionRequests)
      .values({
        customerId,
        requestedBy,
        reason: '使わなくなったため',
        requestedAt: '2026-01-05T03:00:00Z',
        scheduledAt: '2026-01-19T03:00:00Z',
        ...overrides,
      })
      .returning(),
  )
