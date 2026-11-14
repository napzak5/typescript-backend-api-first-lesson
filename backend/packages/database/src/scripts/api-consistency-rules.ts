import type { ModelRule } from './api-consistency'

/**
 * Which API model is backed by which table.
 *
 * A domain that is implemented lists the columns it leaves out
 * (`omittedColumns`), so that every column is either exposed or deliberately
 * hidden, and has no entry in the baseline. Salon is the reference.
 */

/** Columns of `salons` that a request never writes. */
const salonManagedColumns = [
  'id',
  'rating',
  'reviewCount',
  'cancellationPolicy',
  'bookingPolicy',
  'deletedAt',
  'createdAt',
  'updatedAt',
]

const salonRules: ModelRule[] = [
  {
    model: 'Models.SalonResponse',
    table: 'salons',
    kind: 'response',
    embedded: ['openingHours'],
    omittedColumns: ['cancellationPolicy', 'bookingPolicy', 'deletedAt'],
  },
  {
    model: 'Models.SalonCreateRequest',
    table: 'salons',
    kind: 'create',
    embedded: ['openingHours'],
    omittedColumns: salonManagedColumns,
  },
  {
    model: 'Models.SalonUpdateRequest',
    table: 'salons',
    kind: 'update',
    embedded: ['openingHours'],
    omittedColumns: salonManagedColumns,
  },
  {
    model: 'Models.OpeningHours',
    table: 'openingHours',
    kind: 'response',
    omittedColumns: ['id', 'salonId', 'createdAt', 'updatedAt'],
  },
]

/*
 * The domains below have a specification but no implementation yet. Their
 * known differences are recorded in the baseline; a new difference fails the
 * check.
 */

/**
 * Columns of `services` that a request never writes. The salon comes from
 * the path; `requiredProducts` is a jsonb column without a defined structure.
 */
const serviceManagedColumns = [
  'id',
  'salonId',
  'requiredProducts',
  'deletedAt',
  'createdAt',
  'updatedAt',
]

/** Services, their categories and options. */
const serviceRules: ModelRule[] = [
  {
    model: 'Models.ServiceResponse',
    table: 'services',
    kind: 'response',
    embedded: ['options'],
    omittedColumns: ['requiredProducts', 'deletedAt'],
  },
  {
    model: 'Models.ServiceCreateRequest',
    table: 'services',
    kind: 'create',
    omittedColumns: serviceManagedColumns,
  },
  {
    model: 'Models.ServiceUpdateRequest',
    table: 'services',
    kind: 'update',
    omittedColumns: serviceManagedColumns,
  },
  {
    model: 'Models.ServiceOptionResponse',
    table: 'serviceOptions',
    kind: 'response',
    omittedColumns: ['id', 'serviceId', 'createdAt', 'updatedAt'],
  },
  {
    model: 'Models.ServiceCategoryResponse',
    table: 'serviceCategories',
    kind: 'response',
    omittedColumns: [],
  },
  {
    model: 'Models.ServiceCategoryCreateRequest',
    table: 'serviceCategories',
    kind: 'create',
    omittedColumns: ['id', 'createdAt', 'updatedAt'],
  },
  {
    model: 'Models.ServiceCategoryUpdateRequest',
    table: 'serviceCategories',
    kind: 'update',
    // A category cannot move to another salon.
    omittedColumns: ['id', 'salonId', 'createdAt', 'updatedAt'],
  },
]

/** Customers. */
const customerRules: ModelRule[] = [
  { model: 'Models.Customer', table: 'customers', kind: 'response' },
]

/**
 * Users and their sessions. Secrets are never part of a response: a token is
 * returned only by the action that issues it. Registration, login and the
 * other flows use action models, which are not backed by a table.
 */
const authRules: ModelRule[] = [
  {
    model: 'Models.UserResponse',
    table: 'users',
    kind: 'response',
    omittedColumns: [
      'passwordHash',
      'passwordHistory',
      'twoFactorSecret',
      'backupCodes',
      'emailVerificationToken',
      'emailVerificationExpiry',
      'passwordResetToken',
      'passwordResetExpiry',
      // a jsonb object without a defined structure
      'metadata',
      'deletedAt',
    ],
  },
  {
    model: 'Models.SessionResponse',
    table: 'sessions',
    kind: 'response',
    omittedColumns: ['token', 'refreshToken'],
  },
]

/**
 * Columns of `staff` that a request never writes. The salon comes from the
 * path; `awards` is a jsonb column without a defined structure.
 */
const staffManagedColumns = [
  'id',
  'salonId',
  'awards',
  'deletedAt',
  'createdAt',
  'updatedAt',
]

/**
 * Staff and their schedules. The schedules are written by the availability
 * operation, which replaces all rows of a staff member.
 */
const staffRules: ModelRule[] = [
  {
    model: 'Models.StaffResponse',
    table: 'staff',
    kind: 'response',
    embedded: ['schedules'],
    omittedColumns: ['awards', 'deletedAt'],
  },
  {
    model: 'Models.StaffCreateRequest',
    table: 'staff',
    kind: 'create',
    omittedColumns: staffManagedColumns,
  },
  {
    model: 'Models.StaffUpdateRequest',
    table: 'staff',
    kind: 'update',
    omittedColumns: staffManagedColumns,
  },
  {
    model: 'Models.StaffSchedule',
    table: 'staffSchedules',
    kind: 'response',
    omittedColumns: ['id', 'staffId', 'createdAt', 'updatedAt'],
  },
]

/**
 * Columns of `bookings` that a request never writes. The system numbers the
 * booking, derives its times and amounts from the service lines, records the
 * request's IP address and user agent, and the actions (confirm, cancel,
 * complete, reschedule) set the status and the columns of each transition.
 */
const bookingSystemColumns = [
  'id',
  'bookingNumber',
  'bookingDate',
  'startTime',
  'endTime',
  'duration',
  'status',
  'subtotal',
  'discountAmount',
  'taxAmount',
  'totalAmount',
  'pointsUsed',
  'pointsEarned',
  'reminderSent',
  'reminderSentAt',
  'cancelledAt',
  'cancelledBy',
  'cancellationReason',
  'cancellationFee',
  'completedAt',
  'actualStartTime',
  'actualEndTime',
  'ipAddress',
  'userAgent',
  'createdAt',
  'updatedAt',
]

/**
 * Columns of `booking_services` that a request never writes: the end time,
 * duration and prices come from the service, the order from the position of
 * the line, completion from the complete action. `selectedOptions` is a jsonb
 * column without a defined structure.
 */
const bookingServiceSystemColumns = [
  'id',
  'bookingId',
  'endTime',
  'duration',
  'price',
  'discountAmount',
  'finalPrice',
  'selectedOptions',
  'isCompleted',
  'completedAt',
  'sortOrder',
  'createdAt',
  'updatedAt',
]

/**
 * Bookings and their service lines. The status history
 * (`bookingStatusHistories`) is written by the actions and not exposed.
 */
const bookingRules: ModelRule[] = [
  {
    model: 'Models.BookingResponse',
    table: 'bookings',
    kind: 'response',
    embedded: ['services'],
    omittedColumns: ['ipAddress', 'userAgent'],
  },
  {
    model: 'Models.BookingCreateRequest',
    table: 'bookings',
    kind: 'create',
    embedded: ['services'],
    omittedColumns: bookingSystemColumns,
  },
  {
    model: 'Models.BookingUpdateRequest',
    table: 'bookings',
    kind: 'update',
    // A booking keeps its salon and customer; reschedule changes the staff.
    omittedColumns: [
      ...bookingSystemColumns,
      'salonId',
      'customerId',
      'staffId',
    ],
  },
  {
    model: 'Models.BookingServiceResponse',
    table: 'bookingServices',
    kind: 'response',
    omittedColumns: ['bookingId', 'selectedOptions', 'createdAt', 'updatedAt'],
  },
  {
    model: 'Models.BookingServiceCreateRequest',
    table: 'bookingServices',
    kind: 'create',
    omittedColumns: bookingServiceSystemColumns,
  },
]

/** Payments, points and sales. */
const paymentRules: ModelRule[] = [
  { model: 'Models.Payment', table: 'paymentTransactions', kind: 'response' },
]

/**
 * Columns of `reviews` that a request never writes. The system sets
 * `isVerified`, the helpful and report actions change `helpfulCount` and
 * `reportCount`, and no operation writes the owner response yet.
 */
const reviewManagedColumns = [
  'id',
  'isVerified',
  'helpfulCount',
  'reportCount',
  'ownerResponse',
  'ownerRespondedAt',
  'createdAt',
  'updatedAt',
]

/** Reviews. */
const reviewRules: ModelRule[] = [
  {
    model: 'Models.ReviewResponse',
    table: 'reviews',
    kind: 'response',
    omittedColumns: [],
  },
  {
    model: 'Models.ReviewCreateRequest',
    table: 'reviews',
    kind: 'create',
    omittedColumns: reviewManagedColumns,
  },
  {
    model: 'Models.ReviewUpdateRequest',
    table: 'reviews',
    kind: 'update',
    // A review does not move to another salon, customer, booking or staff
    // member.
    omittedColumns: [
      ...reviewManagedColumns,
      'salonId',
      'customerId',
      'bookingId',
      'staffId',
    ],
  },
  {
    model: 'Models.ReviewHelpfulResponse',
    table: 'reviews',
    kind: 'response',
    // The helpful action returns only the counter it changed.
    omittedColumns: [
      'id',
      'salonId',
      'customerId',
      'bookingId',
      'staffId',
      'overallRating',
      'serviceRating',
      'staffRating',
      'atmosphereRating',
      'cleanlinessRating',
      'valueRating',
      'title',
      'comment',
      'imageUrls',
      'isVerified',
      'reportCount',
      'ownerResponse',
      'ownerRespondedAt',
      'createdAt',
      'updatedAt',
    ],
  },
]

/** Inventory and products. */
const inventoryRules: ModelRule[] = [
  { model: 'Models.InventoryItem', table: 'inventory', kind: 'response' },
  {
    model: 'Models.InventoryTransaction',
    table: 'inventoryTransactions',
    kind: 'response',
  },
]

/**
 * jsonb columns of `treatment_records` without a defined structure. They are
 * left out of every model until their structure is defined.
 */
const treatmentRecordUndefinedJsonColumns = [
  'techniques',
  'scalpCondition',
  'hairCondition',
  'colorFormula',
  'beforePhotos',
  'afterPhotos',
  'nextRecommendedServices',
]

/** Columns of `treatment_records` that a create request never writes. */
const treatmentRecordManagedColumns = [
  'id',
  ...treatmentRecordUndefinedJsonColumns,
  'createdAt',
  'updatedAt',
]

/** Columns of a child row of a treatment record that no model exposes. */
const treatmentChildManagedColumns = ['id', 'treatmentRecordId', 'createdAt']

/** Treatment records, their materials and photos, and customer allergies. */
const treatmentRules: ModelRule[] = [
  {
    model: 'Models.TreatmentRecordResponse',
    table: 'treatmentRecords',
    kind: 'response',
    embedded: ['materials', 'photos'],
    omittedColumns: treatmentRecordUndefinedJsonColumns,
  },
  {
    model: 'Models.TreatmentRecordCreateRequest',
    table: 'treatmentRecords',
    kind: 'create',
    embedded: ['materials'],
    omittedColumns: treatmentRecordManagedColumns,
  },
  {
    model: 'Models.TreatmentRecordUpdateRequest',
    table: 'treatmentRecords',
    kind: 'update',
    embedded: ['materials'],
    // A record does not move to another booking, customer or staff member.
    omittedColumns: [
      ...treatmentRecordManagedColumns,
      'bookingId',
      'customerId',
      'staffId',
    ],
  },
  {
    model: 'Models.TreatmentMaterial',
    table: 'treatmentMaterials',
    kind: 'response',
    omittedColumns: treatmentChildManagedColumns,
  },
  {
    model: 'Models.TreatmentPhotoResponse',
    table: 'treatmentPhotos',
    kind: 'response',
    omittedColumns: treatmentChildManagedColumns,
  },
  {
    model: 'Models.TreatmentPhotoCreateRequest',
    table: 'treatmentPhotos',
    kind: 'create',
    omittedColumns: treatmentChildManagedColumns,
  },
  {
    model: 'Models.CustomerAllergyResponse',
    table: 'customerAllergies',
    kind: 'response',
    // The customer is in the path and no operation addresses one allergy.
    omittedColumns: ['id', 'customerId', 'createdAt'],
  },
]

export const modelRules: ModelRule[] = [
  ...salonRules,
  ...serviceRules,
  ...customerRules,
  ...authRules,
  ...staffRules,
  ...bookingRules,
  ...paymentRules,
  ...reviewRules,
  ...inventoryRules,
  ...treatmentRules,
]
