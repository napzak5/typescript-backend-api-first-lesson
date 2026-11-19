import type {
  ModelsBookingResponse,
  ModelsCustomerResponse,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'

/*
 * What the stories and the tests of the booking screens show: a salon in
 * Tokyo, its staff and services, customers, and bookings of a day.
 */

/** The day the stories are told on, at the salon */
export const DAY = '2026-11-20'

const MS_OF_A_MINUTE = 60 * 1000

/** A moment of the day, so many minutes after 10:00 at the salon (01:00 UTC). */
export const moment = (minutes: number): string =>
  new Date(
    Date.parse(`${DAY}T01:00:00.000Z`) + minutes * MS_OF_A_MINUTE,
  ).toISOString()

export const salon: ModelsSalonResponse = {
  id: '3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60',
  name: 'Salon Hikari 表参道店',
  nameKana: null,
  description: null,
  postalCode: '150-0001',
  prefecture: '東京都',
  city: '渋谷区',
  address: '神宮前 4-1-1',
  building: null,
  latitude: null,
  longitude: null,
  phoneNumber: '03-1234-5678',
  alternativePhone: null,
  email: 'omotesando@example.com',
  websiteUrl: null,
  logoUrl: null,
  imageUrls: [],
  features: [],
  amenities: [],
  businessHours: null,
  rating: null,
  reviewCount: 0,
  timezone: 'Asia/Tokyo',
  currency: 'JPY',
  taxRate: 10,
  isActive: true,
  openingHours: [],
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
}

const profile = (
  id: string,
  displayName: string,
): ModelsStaffProfileResponse => ({
  id,
  salonId: salon.id,
  displayName,
  level: 'senior',
  position: null,
  specialties: [],
  bio: null,
  imageUrl: null,
  yearsOfExperience: null,
  certifications: [],
  canReceiveBookings: true,
})

export const staff: ModelsStaffProfileResponse[] = [
  profile('7c4a9e2b-1f3d-4b8a-9e6c-5d2f8a1b3c70', '田中 美咲'),
  profile('8d5b0f3c-2a4e-4c9b-8f7d-6e3a9b2c4d81', '佐藤 健'),
]

/** A service of an hour, with its ID, its name and its price. */
export const service = (
  id: string,
  name: string,
  price: number,
): ModelsServiceResponse => ({
  id,
  salonId: salon.id,
  categoryId: null,
  name,
  description: null,
  shortDescription: null,
  duration: 60,
  price,
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
  sortOrder: 0,
  serviceStatus: 'active',
  availability: 'always',
  isActive: true,
  options: [],
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
})

export const services: ModelsServiceResponse[] = [
  service('9e6c1a4d-3b5f-4dac-9a8e-7f4b0c3d5e92', 'カット', 5500),
  service('af7d2b5e-4c6a-4ebd-8b9f-8a5c1d4e6fa3', 'カラー', 8800),
]

/** A customer, with what a test changes of it. */
export const aCustomer = (
  changes: Partial<ModelsCustomerResponse> = {},
): ModelsCustomerResponse => ({
  id: 'b08e3c6f-5d7b-4fce-9cad-9b6d2e5f7ab4',
  userId: null,
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
  email: 'hanako@example.com',
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
  loyaltyPoints: 0,
  preferences: null,
  notes: null,
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: null,
  allowMarketing: false,
  allowSms: false,
  allowEmail: true,
  firstVisitDate: null,
  lastVisitDate: null,
  visitCount: 0,
  noShowCount: 0,
  cancellationCount: 0,
  isActive: true,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T00:00:00.000Z',
  ...changes,
})

export const customers: ModelsCustomerResponse[] = [
  aCustomer(),
  aCustomer({
    id: 'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
    firstName: '一郎',
    lastName: '鈴木',
    firstNameKana: 'イチロウ',
    lastNameKana: 'スズキ',
    email: 'ichiro@example.com',
  }),
]

const [cut] = services
const [misaki] = staff

/** A booking of the day: a cut at 10:00 with the first member of the staff, waiting to be confirmed. */
export const aBooking = (
  changes: Partial<ModelsBookingResponse> = {},
): ModelsBookingResponse => ({
  id: 'd2a05e8b-7f9d-4be0-9ecf-bd8f4a7b9cd6',
  bookingNumber: 'BK-4F7H-2KQM',
  salonId: salon.id,
  customerId: customers[0]?.id ?? '',
  staffId: misaki?.id ?? '',
  bookingDate: DAY,
  startTime: moment(0),
  endTime: moment(60),
  duration: 60,
  status: 'pending',
  subtotal: 5500,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 5500,
  depositAmount: null,
  pointsUsed: null,
  pointsEarned: null,
  customerRequest: null,
  internalNotes: null,
  reminderSent: false,
  reminderSentAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  cancellationFee: null,
  completedAt: null,
  actualStartTime: null,
  actualEndTime: null,
  source: null,
  services: [
    {
      id: 'e3b16f9c-8a0e-4cf1-8fd0-ce9a5b8cade7',
      serviceId: cut?.id ?? '',
      staffId: misaki?.id ?? null,
      startTime: moment(0),
      endTime: moment(60),
      duration: 60,
      price: 5500,
      discountAmount: 0,
      finalPrice: 5500,
      taxIncluded: true,
      isCompleted: false,
      completedAt: null,
      notes: null,
      sortOrder: 0,
    },
  ],
  createdAt: '2026-11-18T03:00:00.000Z',
  updatedAt: '2026-11-18T03:00:00.000Z',
  ...changes,
})
