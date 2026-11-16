import type { ModelRule } from './api-consistency'

/**
 * Which API model is backed by which table.
 *
 * Every rule lists the columns its model leaves out (`omittedColumns`), so
 * that every column is either exposed or deliberately hidden. A property
 * that has only some of the values of the enum type of its column is listed
 * too (`narrowed`). Salon is the reference. A model that is not backed by
 * a table (computed reports, action requests, features whose tables do not
 * exist yet) has no rule, unless its values are those of columns of a row
 * that is not written yet: then it has the rule of that table, and leaves
 * out every other column.
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

/**
 * The salon of a category comes from the path of the request, and a category
 * cannot move to another salon.
 */
const serviceCategoryManagedColumns = [
  'id',
  'salonId',
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
    embedded: ['options'],
    omittedColumns: serviceManagedColumns,
  },
  {
    model: 'Models.ServiceUpdateRequest',
    table: 'services',
    kind: 'update',
    embedded: ['options'],
    omittedColumns: serviceManagedColumns,
  },
  {
    model: 'Models.ServiceOption',
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
    omittedColumns: serviceCategoryManagedColumns,
  },
  {
    model: 'Models.ServiceCategoryUpdateRequest',
    table: 'serviceCategories',
    kind: 'update',
    omittedColumns: serviceCategoryManagedColumns,
  },
]

/**
 * Columns of `customers` that a request never writes. The login link
 * (`userId`) is set by the auth domain; the points, lifetime value and visit
 * counters are maintained by other features.
 */
const customerManagedColumns = [
  'id',
  'userId',
  'loyaltyPoints',
  'lifetimeValue',
  'firstVisitDate',
  'lastVisitDate',
  'visitCount',
  'noShowCount',
  'cancellationCount',
  'deletedAt',
  'createdAt',
  'updatedAt',
]

/**
 * Columns of `customers` that the staff keep for themselves. The customer's
 * own profile does not show them.
 */
const customerStaffColumns = [
  'notes',
  'internalNotes',
  'tags',
  'referredBy',
  'isActive',
  'customerStatus',
  'lifetimeValue',
  'noShowCount',
  'cancellationCount',
]

/**
 * Columns of `customers` that the customer's own profile never writes: the
 * managed ones, the email (it is the account's), and what the salon decides
 * or records.
 */
const customerProfileManagedColumns = [
  ...customerManagedColumns,
  'email',
  'membershipTier',
  'notes',
  'internalNotes',
  'tags',
  'referredBy',
  'referralCode',
  'isActive',
  'hairType',
  'hairThickness',
  'scalpCondition',
  'customerStatus',
]

/**
 * Columns of `customer_preferences` that no model exposes. The row is
 * addressed through its customer, and a customer without a row has
 * preferences too: empty ones. So the row itself, with its ID and its
 * times, is not shown.
 */
const customerPreferencesOmittedColumns = [
  'id',
  'customerId',
  'createdAt',
  'updatedAt',
]

/** Customers and their preferences. */
const customerRules: ModelRule[] = [
  {
    model: 'Models.CustomerResponse',
    table: 'customers',
    kind: 'response',
    omittedColumns: ['deletedAt'],
  },
  {
    model: 'Models.CustomerCreateRequest',
    table: 'customers',
    kind: 'create',
    omittedColumns: customerManagedColumns,
  },
  {
    model: 'Models.CustomerUpdateRequest',
    table: 'customers',
    kind: 'update',
    omittedColumns: customerManagedColumns,
  },
  {
    model: 'Models.CustomerProfileResponse',
    table: 'customers',
    kind: 'response',
    omittedColumns: [...customerStaffColumns, 'userId', 'deletedAt'],
  },
  {
    model: 'Models.CustomerProfileCreateRequest',
    table: 'customers',
    kind: 'create',
    omittedColumns: customerProfileManagedColumns,
  },
  {
    model: 'Models.CustomerProfileUpdateRequest',
    table: 'customers',
    kind: 'update',
    omittedColumns: customerProfileManagedColumns,
  },
  {
    model: 'Models.CustomerPreferencesResponse',
    table: 'customerPreferences',
    kind: 'response',
    omittedColumns: customerPreferencesOmittedColumns,
  },
  {
    model: 'Models.CustomerPreferencesUpdateRequest',
    table: 'customerPreferences',
    kind: 'update',
    omittedColumns: customerPreferencesOmittedColumns,
  },
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
      'twoFactorSecret',
      'twoFactorLastUsedStep',
      'backupCodes',
      'emailVerificationTokenHash',
      'emailVerificationExpiry',
      'passwordResetTokenHash',
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
    // Whether the session is the one of the request that lists it.
    computed: ['current'],
    omittedColumns: ['tokenHash', 'refreshTokenHash'],
  },
]

/**
 * Columns of `staff` that a request never writes. The salon comes from the
 * path; the login account (`userId`) is not the ledger's to link, because
 * linking writes the user as well; `awards` is a jsonb column without a
 * defined structure.
 */
const staffManagedColumns = [
  'id',
  'salonId',
  'userId',
  'awards',
  'deletedAt',
  'createdAt',
  'updatedAt',
]

/**
 * Columns of `staff` that customers are not shown: the person, how to
 * reach them, and what the salon keeps as an employer.
 */
const staffProfileHiddenColumns = [
  'userId',
  'firstName',
  'lastName',
  'firstNameKana',
  'lastNameKana',
  'email',
  'phoneNumber',
  'alternativePhone',
  'staffCode',
  'awards',
  'hireDate',
  'employmentType',
  'baseSalary',
  'commissionRate',
  'maxConcurrentBookings',
  'bufferTimeBefore',
  'bufferTimeAfter',
  'isActive',
  'deletedAt',
  'createdAt',
  'updatedAt',
]

/**
 * Columns of `users` that the salon is not shown of the account of a staff
 * member: what authenticates the account, the mailed tokens, the counters
 * and traces of the login, and what the account is besides the account of
 * this staff member.
 */
const staffAccountHiddenColumns = [
  'passwordHash',
  'permissions',
  'emailVerified',
  'emailVerificationTokenHash',
  'emailVerificationExpiry',
  'passwordResetTokenHash',
  'passwordResetExpiry',
  'lastPasswordChange',
  'twoFactorSecret',
  'backupCodes',
  'twoFactorLastUsedStep',
  'failedLoginAttempts',
  'lockedUntil',
  'lastLoginIp',
  'customerId',
  'staffId',
  'metadata',
  'deletedAt',
]

/**
 * Staff, their schedules, their invitations and their accounts. A schedule
 * is read and written as a whole: writing replaces all rows of a staff
 * member.
 */
const staffRules: ModelRule[] = [
  {
    model: 'Models.StaffResponse',
    table: 'staff',
    kind: 'response',
    omittedColumns: ['awards', 'deletedAt'],
  },
  {
    // What customers are shown of a staff member: the name the salon chose
    // for them and what describes the work, nothing of the person or the
    // employment.
    model: 'Models.StaffProfileResponse',
    table: 'staff',
    kind: 'response',
    omittedColumns: staffProfileHiddenColumns,
  },
  {
    // What a staff member writes of their own profile: what describes
    // them. The name customers are shown, the level, the position and
    // whether the staff member takes bookings are the salon's to decide,
    // in the ledger.
    model: 'Models.StaffProfileUpdateRequest',
    table: 'staff',
    kind: 'update',
    omittedColumns: [
      'id',
      'salonId',
      'displayName',
      'level',
      'position',
      'canReceiveBookings',
      ...staffProfileHiddenColumns,
    ],
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
  // An entry of a schedule is the same in a request and in a response.
  // The check of a response is the one that fits both: every property is
  // required, and nullable exactly where the column is.
  {
    model: 'Models.StaffSchedule',
    table: 'staffSchedules',
    kind: 'response',
    omittedColumns: ['id', 'staffId', 'createdAt', 'updatedAt'],
  },
  // The mailed token is shown nowhere, and neither is its hash.
  {
    model: 'Models.StaffInvitationResponse',
    table: 'staffInvitations',
    kind: 'response',
    omittedColumns: ['tokenHash'],
  },
  // An invitation states the role. The staff member comes from the path
  // and the address from the ledger; the token and its end are the
  // server's.
  {
    model: 'Models.StaffInvitationCreateRequest',
    table: 'staffInvitations',
    kind: 'create',
    omittedColumns: [
      'id',
      'staffId',
      'email',
      'tokenHash',
      'expiresAt',
      'createdAt',
    ],
  },
  // The account of a staff member is a user that names the staff member,
  // and such a user has a role of a salon (`users_staff_needs_salon_role`):
  // of the roles of `user_role`, never 'customer' or 'admin'.
  {
    model: 'Models.StaffAccountResponse',
    table: 'users',
    kind: 'response',
    narrowed: ['role'],
    omittedColumns: staffAccountHiddenColumns,
  },
  // The salon changes the role of the account and nothing else of it.
  {
    model: 'Models.StaffAccountUpdateRequest',
    table: 'users',
    kind: 'update',
    narrowed: ['role'],
    omittedColumns: [
      'id',
      'email',
      'status',
      'twoFactorStatus',
      'lastLoginAt',
      'createdAt',
      'updatedAt',
      ...staffAccountHiddenColumns,
    ],
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
 * the duration, the prices and whether they include the tax come from the
 * service, the order from the position of the line, completion from the
 * complete action. `selectedOptions` is a jsonb column without a defined
 * structure.
 */
const bookingServiceSystemColumns = [
  'id',
  'bookingId',
  'endTime',
  'duration',
  'price',
  'discountAmount',
  'finalPrice',
  'taxIncluded',
  'selectedOptions',
  'isCompleted',
  'completedAt',
  'sortOrder',
  'createdAt',
  'updatedAt',
]

/**
 * Columns of `bookings` that the customer of a booking is not shown: what
 * the salon notes for itself and records of the visit, and who cancelled
 * and why, which the staff do not write for the customer to read.
 */
const bookingColumnsOfTheSalon = [
  'internalNotes',
  'source',
  'reminderSent',
  'reminderSentAt',
  'actualStartTime',
  'actualEndTime',
  'cancelledBy',
  'cancellationReason',
]

/**
 * Bookings and their service lines, as the ledger shows them and as the
 * customer of a booking is shown them. The status history
 * (`bookingStatusHistories`) is written with the booking and by the
 * actions, and not exposed. What a customer sends to book a slot names
 * the slot, and has no rule.
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
  {
    model: 'Models.CustomerBookingResponse',
    table: 'bookings',
    kind: 'response',
    embedded: ['services'],
    omittedColumns: [
      'ipAddress',
      'userAgent',
      ...bookingColumnsOfTheSalon,
      // The customer reads their own bookings.
      'customerId',
    ],
  },
  {
    model: 'Models.CustomerBookingServiceResponse',
    table: 'bookingServices',
    kind: 'response',
    omittedColumns: [
      'bookingId',
      'selectedOptions',
      'createdAt',
      'updatedAt',
      // What the salon notes of the line and records of the visit.
      'notes',
      'isCompleted',
      'completedAt',
    ],
  },
]

/**
 * Columns of `sales` that a request never writes: set by the system
 * (`saleNumber`, and `saleDate` from `saleTime`), computed from the lines
 * (`subtotal`, `discountAmount`, `taxAmount`, `totalAmount`) or set by the
 * process, void and refund actions.
 */
const saleManagedColumns = [
  'id',
  'saleNumber',
  'saleDate',
  'subtotal',
  'discountAmount',
  'taxAmount',
  'totalAmount',
  'paymentStatus',
  'isVoid',
  'voidedAt',
  'voidReason',
  'createdAt',
  'updatedAt',
]

/**
 * Columns of `customer_points` that the point actions set: the type comes
 * from the action and the balance is computed.
 */
const pointManagedColumns = ['id', 'transactionType', 'balance', 'createdAt']

/**
 * Columns of `payment_methods` that no request writes: the database assigns
 * the ID and the timestamps, the path names the salon, and nothing reads or
 * writes the settings of a payment processor (`processorConfig`, a jsonb
 * column without a defined structure that may hold credentials).
 */
const paymentMethodManagedColumns = [
  'id',
  'salonId',
  'processorConfig',
  'createdAt',
  'updatedAt',
]

/**
 * Sales, their payments, the payment methods of a salon, and points.
 * `daily_summaries` backs no model: the daily report returns values that it
 * does not hold.
 */
const paymentRules: ModelRule[] = [
  {
    model: 'Models.PaymentMethodResponse',
    table: 'paymentMethods',
    kind: 'response',
    omittedColumns: ['processorConfig'],
  },
  {
    model: 'Models.PaymentMethodCreateRequest',
    table: 'paymentMethods',
    kind: 'create',
    omittedColumns: paymentMethodManagedColumns,
  },
  {
    // A payment method keeps the method it was created with.
    model: 'Models.PaymentMethodUpdateRequest',
    table: 'paymentMethods',
    kind: 'update',
    omittedColumns: [...paymentMethodManagedColumns, 'method'],
  },
  {
    model: 'Models.SaleResponse',
    table: 'sales',
    kind: 'response',
    embedded: ['details', 'payments'],
    omittedColumns: [],
  },
  {
    model: 'Models.SaleCreateRequest',
    table: 'sales',
    kind: 'create',
    embedded: ['details'],
    omittedColumns: saleManagedColumns,
  },
  {
    model: 'Models.SaleUpdateRequest',
    table: 'sales',
    kind: 'update',
    embedded: ['details'],
    // A sale does not move to another salon.
    omittedColumns: [...saleManagedColumns, 'salonId'],
  },
  {
    // What a sale would come to, worked out before it is entered: the
    // amounts it would have, under the names of the columns that would
    // hold them, and nothing else of a sale.
    model: 'Models.SaleBreakdownResponse',
    table: 'sales',
    kind: 'response',
    omittedColumns: [
      'id',
      'saleNumber',
      'salonId',
      'customerId',
      'staffId',
      'bookingId',
      'saleDate',
      'saleTime',
      'pointsUsed',
      'pointsEarned',
      'paymentStatus',
      'isVoid',
      'voidedAt',
      'voidReason',
      'notes',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    model: 'Models.SalesDetail',
    table: 'salesDetails',
    kind: 'response',
    omittedColumns: ['id', 'saleId', 'createdAt'],
  },
  {
    model: 'Models.PaymentResponse',
    table: 'paymentTransactions',
    kind: 'response',
    // jsonb columns without a defined structure.
    omittedColumns: ['processorResponse', 'metadata'],
  },
  {
    // Inserts one payment transaction for the sale in the path.
    model: 'Models.SaleProcessRequest',
    table: 'paymentTransactions',
    kind: 'create',
    omittedColumns: [
      'id',
      'saleId',
      'transactionNumber',
      'status',
      'processorTransactionId',
      'processorResponse',
      'errorCode',
      'errorMessage',
      'processedAt',
      'failedAt',
      'refundedAt',
      'refundAmount',
      'refundReason',
      'metadata',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    model: 'Models.PointTransactionResponse',
    table: 'customerPoints',
    kind: 'response',
    omittedColumns: [],
  },
  {
    // The balance of the latest row of the customer, which their
    // loyaltyPoints equal.
    model: 'Models.PointBalanceResponse',
    table: 'customerPoints',
    kind: 'response',
    omittedColumns: [
      'id',
      'transactionType',
      'points',
      'description',
      'referenceType',
      'referenceId',
      'expiryDate',
      'createdAt',
    ],
  },
  {
    model: 'Models.PointEarnRequest',
    table: 'customerPoints',
    kind: 'create',
    omittedColumns: pointManagedColumns,
  },
  {
    // Used points do not expire.
    model: 'Models.PointUseRequest',
    table: 'customerPoints',
    kind: 'create',
    omittedColumns: [...pointManagedColumns, 'expiryDate'],
  },
  {
    model: 'Models.PointAdjustRequest',
    table: 'customerPoints',
    kind: 'create',
    omittedColumns: [...pointManagedColumns, 'expiryDate'],
  },
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
  {
    model: 'Models.ReviewReportResponse',
    table: 'reviewReports',
    kind: 'response',
    omittedColumns: [],
  },
  {
    model: 'Models.ReviewReportRequest',
    table: 'reviewReports',
    kind: 'create',
    // The review comes from the path and the account from the session;
    // a report is pending until an administrator dismisses it.
    omittedColumns: [
      'id',
      'reviewId',
      'reportedBy',
      'status',
      'resolvedBy',
      'resolvedAt',
      'createdAt',
      'updatedAt',
    ],
  },
]

/**
 * Columns of `inventory` that a request never writes. The stock levels and
 * the last count change only through stock movements and stock counts.
 */
const inventoryManagedColumns = [
  'id',
  'currentStock',
  'availableStock',
  'reservedStock',
  'lastCountedAt',
  'lastCountedBy',
  'createdAt',
  'updatedAt',
]

/**
 * Inventory (the stock of a product at a salon) and its stock movements.
 * `products` has no API model: no operation creates or returns product rows.
 * Stock movements are written by actions (movement, stock count, receiving a
 * purchase order), so `inventoryTransactions` has only a response model.
 */
const inventoryRules: ModelRule[] = [
  {
    model: 'Models.InventoryResponse',
    table: 'inventory',
    kind: 'response',
    omittedColumns: [],
  },
  {
    model: 'Models.InventoryCreateRequest',
    table: 'inventory',
    kind: 'create',
    omittedColumns: inventoryManagedColumns,
  },
  {
    model: 'Models.InventoryUpdateRequest',
    table: 'inventory',
    kind: 'update',
    // A stock row does not move to another salon or product.
    omittedColumns: [...inventoryManagedColumns, 'salonId', 'productId'],
  },
  {
    model: 'Models.InventoryTransactionResponse',
    table: 'inventoryTransactions',
    kind: 'response',
    omittedColumns: [],
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
