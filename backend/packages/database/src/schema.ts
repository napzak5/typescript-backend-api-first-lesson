import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const accountStatus = pgEnum('account_status', [
  'active',
  'unverified',
  'inactive',
  'locked',
  'suspended',
  'deleted',
])

export const allergySeverity = pgEnum('allergy_severity', [
  'mild',
  'moderate',
  'severe',
  'life_threatening',
])

export const allergyType = pgEnum('allergy_type', [
  'chemical',
  'fragrance',
  'metal',
  'latex',
  'plant',
  'other',
])

export const bookingRequirement = pgEnum('booking_requirement', [
  'consultation_required',
  'patch_test_required',
  'advance_booking_required',
  'deposit_required',
])

export const bookingStatus = pgEnum('booking_status', [
  'draft',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
])

export const customerStatus = pgEnum('customer_status', [
  'active',
  'inactive',
  'vip',
  'blacklisted',
])

export const customerVersionOperation = pgEnum('customer_version_operation', [
  'baseline',
  'create',
  'update',
  'delete',
  'restore',
])

export const dayOfWeek = pgEnum('day_of_week', [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
])

export const hairThickness = pgEnum('hair_thickness', [
  'thin',
  'medium',
  'thick',
])

export const hairType = pgEnum('hair_type', [
  'straight',
  'wavy',
  'curly',
  'coily',
])

export const inventoryAlertSeverity = pgEnum('inventory_alert_severity', [
  'info',
  'warning',
  'critical',
])

export const inventoryAlertType = pgEnum('inventory_alert_type', [
  'low_stock',
  'expiring',
  'expired',
  'overstock',
])

export const inventoryTransactionType = pgEnum('inventory_transaction_type', [
  'purchase',
  'sale',
  'use',
  'adjustment',
  'return',
  'disposal',
  'transfer',
])

export const membershipTier = pgEnum('membership_tier', [
  'regular',
  'silver',
  'gold',
  'platinum',
  'vip',
])

export const orderStatus = pgEnum('order_status', [
  'draft',
  'pending',
  'approved',
  'ordered',
  'shipped',
  'delivered',
  'cancelled',
])

export const paymentMethod = pgEnum('payment_method', [
  'cash',
  'credit_card',
  'debit_card',
  'e_money',
  'qr_payment',
  'bank_transfer',
  'point',
])

export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partial_refund',
])

export const pointTransactionType = pgEnum('point_transaction_type', [
  'earned',
  'used',
  'expired',
  'adjusted',
  'transferred',
])

export const pricingStrategy = pgEnum('pricing_strategy', [
  'fixed',
  'variable',
  'tiered',
  'dynamic',
  'consultation_based',
])

export const reviewReportReason = pgEnum('review_report_reason', [
  'inappropriate',
  'false_information',
  'personal_information',
  'spam',
  'other',
])

export const reviewReportStatus = pgEnum('review_report_status', [
  'pending',
  'dismissed',
])

export const salonRole = pgEnum('salon_role', ['owner', 'manager', 'staff'])

export const scalpCondition = pgEnum('scalp_condition', [
  'normal',
  'dry',
  'oily',
  'sensitive',
  'dandruff',
])

export const serviceAvailability = pgEnum('service_availability', [
  'always',
  'weekdays_only',
  'weekends_only',
  'by_appointment_only',
  'seasonal',
])

export const serviceCategory = pgEnum('service_category', [
  'cut',
  'color',
  'perm',
  'treatment',
  'spa',
  'styling',
  'extension',
  'other',
])

export const serviceOptionType = pgEnum('service_option_type', [
  'addon',
  'upgrade',
  'duration_extension',
  'product_choice',
])

export const serviceStatus = pgEnum('service_status', [
  'active',
  'inactive',
  'coming_soon',
  'discontinued',
])

export const staffLevel = pgEnum('staff_level', [
  'junior',
  'stylist',
  'senior',
  'expert',
  'director',
])

export const treatmentPhotoType = pgEnum('treatment_photo_type', [
  'before',
  'during',
  'after',
  'other',
])

export const twoFactorStatus = pgEnum('two_factor_status', [
  'disabled',
  'pending',
  'enabled',
])

export const userRole = pgEnum('user_role', [
  'customer',
  'staff',
  'manager',
  'admin',
  'owner',
])

export const bookingServices = pgTable(
  'booking_services',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    bookingId: uuid().notNull(),
    serviceId: uuid().notNull(),
    staffId: uuid(),
    startTime: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    endTime: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    duration: integer().notNull(),
    price: integer().notNull(),
    discountAmount: integer().default(0).notNull(),
    finalPrice: integer().notNull(),
    isCompleted: boolean().default(false).notNull(),
    completedAt: timestamp({ withTimezone: true, mode: 'string' }),
    notes: text(),
    sortOrder: integer().default(0).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    taxIncluded: boolean().notNull(),
  },
  (table) => [
    check(
      'booking_services_completed_has_time',
      sql`"isCompleted" = ("completedAt" IS NOT NULL)`,
    ),
    check(
      'booking_services_discount_within_price',
      sql`("discountAmount" >= 0) AND ("discountAmount" <= price)`,
    ),
    check(
      'booking_services_duration_is_the_span',
      sql`((duration * 60))::numeric = EXTRACT(epoch FROM ("endTime" - "startTime"))`,
    ),
    check('booking_services_end_after_start', sql`"startTime" < "endTime"`),
    check(
      'booking_services_final_price_is_the_difference',
      sql`"finalPrice" = (price - "discountAmount")`,
    ),
    check('booking_services_sort_order_not_negative', sql`"sortOrder" >= 0`),
    foreignKey({
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
      name: 'booking_services_booking_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.serviceId],
      foreignColumns: [services.id],
      name: 'booking_services_service_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [staff.id],
      name: 'booking_services_staff_id_fk',
    }).onDelete('restrict'),
    index('idx_booking_services_booking_id').using(
      'btree',
      table.bookingId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_booking_services_service_id').using(
      'btree',
      table.serviceId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_booking_services_staff_start').using(
      'btree',
      table.staffId.asc().nullsLast().op('uuid_ops'),
      table.startTime.asc().nullsLast().op('timestamptz_ops'),
    ),
    unique('booking_services_order_unique').on(
      table.bookingId,
      table.sortOrder,
    ),
  ],
)

export const bookingStatusHistories = pgTable(
  'booking_status_histories',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    bookingId: uuid().notNull(),
    fromStatus: bookingStatus(),
    toStatus: bookingStatus().notNull(),
    changedBy: uuid(),
    reason: text(),
    metadata: jsonb(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
      name: 'booking_status_histories_booking_id_fk',
    }).onDelete('cascade'),
    index('idx_booking_status_histories_booking_id').using(
      'btree',
      table.bookingId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_booking_status_histories_created_at').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
  ],
)

export const bookings = pgTable(
  'bookings',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    bookingNumber: varchar({ length: 50 }).notNull(),
    salonId: uuid().notNull(),
    customerId: uuid().notNull(),
    staffId: uuid().notNull(),
    bookingDate: date().notNull(),
    startTime: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    endTime: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    duration: integer().notNull(),
    status: bookingStatus().default('pending').notNull(),
    subtotal: integer().notNull(),
    discountAmount: integer().default(0).notNull(),
    taxAmount: integer().default(0).notNull(),
    totalAmount: integer().notNull(),
    depositAmount: integer(),
    pointsUsed: integer(),
    pointsEarned: integer(),
    customerRequest: text(),
    internalNotes: text(),
    reminderSent: boolean().default(false).notNull(),
    reminderSentAt: timestamp({ withTimezone: true, mode: 'string' }),
    cancelledAt: timestamp({ withTimezone: true, mode: 'string' }),
    cancelledBy: uuid(),
    cancellationReason: text(),
    cancellationFee: integer(),
    completedAt: timestamp({ withTimezone: true, mode: 'string' }),
    actualStartTime: timestamp({ withTimezone: true, mode: 'string' }),
    actualEndTime: timestamp({ withTimezone: true, mode: 'string' }),
    source: varchar({ length: 50 }),
    ipAddress: varchar({ length: 50 }),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'bookings_actual_end_after_start',
      sql`("actualStartTime" IS NULL) OR ("actualEndTime" IS NULL) OR ("actualStartTime" < "actualEndTime")`,
    ),
    check(
      'bookings_amounts_not_negative',
      sql`(subtotal >= 0) AND ("discountAmount" >= 0) AND ("taxAmount" >= 0) AND ("totalAmount" >= 0) AND (("depositAmount" IS NULL) OR ("depositAmount" >= 0)) AND (("pointsUsed" IS NULL) OR ("pointsUsed" >= 0)) AND (("pointsEarned" IS NULL) OR ("pointsEarned" >= 0)) AND (("cancellationFee" IS NULL) OR ("cancellationFee" >= 0))`,
    ),
    check(
      'bookings_cancellation_only_when_cancelled',
      sql`(status = 'cancelled'::booking_status) OR (("cancelledBy" IS NULL) AND ("cancellationReason" IS NULL) AND ("cancellationFee" IS NULL))`,
    ),
    check(
      'bookings_cancelled_has_time',
      sql`(status = 'cancelled'::booking_status) = ("cancelledAt" IS NOT NULL)`,
    ),
    check(
      'bookings_completed_has_time',
      sql`(status = 'completed'::booking_status) = ("completedAt" IS NOT NULL)`,
    ),
    check(
      'bookings_discount_within_subtotal',
      sql`"discountAmount" <= subtotal`,
    ),
    check(
      'bookings_duration_is_the_span',
      sql`((duration * 60))::numeric = EXTRACT(epoch FROM ("endTime" - "startTime"))`,
    ),
    check('bookings_end_after_start', sql`"startTime" < "endTime"`),
    check(
      'bookings_in_progress_has_start',
      sql`(status <> 'in_progress'::booking_status) OR ("actualStartTime" IS NOT NULL)`,
    ),
    check(
      'bookings_total_is_the_sum',
      sql`"totalAmount" = ((subtotal - "discountAmount") + "taxAmount")`,
    ),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'bookings_customer_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'bookings_salon_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [staff.id],
      name: 'bookings_staff_id_fk',
    }).onDelete('restrict'),
    index('idx_bookings_booking_date').using(
      'btree',
      table.bookingDate.asc().nullsLast().op('date_ops'),
    ),
    index('idx_bookings_booking_number').using(
      'btree',
      table.bookingNumber.asc().nullsLast().op('text_ops'),
    ),
    index('idx_bookings_customer_id').using(
      'btree',
      table.customerId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_bookings_salon_start').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
      table.startTime.asc().nullsLast().op('timestamptz_ops'),
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_bookings_staff_id').using(
      'btree',
      table.staffId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_bookings_start_time').using(
      'btree',
      table.startTime.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_bookings_status').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops'),
    ),
    unique('bookings_booking_number_unique').on(table.bookingNumber),
  ],
)

export const customerAllergies = pgTable(
  'customer_allergies',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    customerId: uuid().notNull(),
    allergyType: allergyType().notNull(),
    allergenName: varchar({ length: 255 }).notNull(),
    symptoms: text(),
    notes: text(),
    confirmedDate: date(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    severityType: allergySeverity().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'customer_allergies_customer_id_fk',
    }).onDelete('cascade'),
    unique('customer_allergies_customer_allergen_unique').on(
      table.customerId,
      table.allergenName,
    ),
  ],
)

export const customerPoints = pgTable(
  'customer_points',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    customerId: uuid().notNull(),
    transactionType: pointTransactionType().notNull(),
    points: integer().notNull(),
    balance: integer().notNull(),
    description: text(),
    referenceType: varchar({ length: 50 }),
    referenceId: uuid(),
    expiryDate: date(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check('customer_points_balance_not_negative', sql`balance >= 0`),
    check(
      'customer_points_expiry_of_earned',
      sql`("expiryDate" IS NULL) OR ("transactionType" = 'earned'::point_transaction_type)`,
    ),
    check(
      'customer_points_points_of_type',
      sql`(("transactionType" <> 'earned'::point_transaction_type) OR (points >= 1)) AND (("transactionType" <> ALL (ARRAY['used'::point_transaction_type, 'expired'::point_transaction_type])) OR (points <= '-1'::integer)) AND (("transactionType" <> ALL (ARRAY['adjusted'::point_transaction_type, 'transferred'::point_transaction_type])) OR (points <> 0))`,
    ),
    check(
      'customer_points_reference_pair',
      sql`("referenceType" IS NULL) = ("referenceId" IS NULL)`,
    ),
    check(
      'customer_points_reference_type_known',
      sql`("referenceType" IS NULL) OR (("referenceType")::text = ANY (ARRAY['sale'::text, 'booking'::text]))`,
    ),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'customer_points_customer_id_fk',
    }).onDelete('cascade'),
    index('idx_customer_points_created_at').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_customer_points_customer_time').using(
      'btree',
      table.customerId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_customer_points_expiry_date').using(
      'btree',
      table.expiryDate.asc().nullsLast().op('date_ops'),
    ),
    uniqueIndex('customer_points_reference_unique')
      .using(
        'btree',
        table.referenceType.asc().nullsLast().op('text_ops'),
        table.referenceId.asc().nullsLast().op('uuid_ops'),
        table.transactionType.asc().nullsLast().op('enum_ops'),
      )
      .where(
        sql`(("transactionType" = ANY (ARRAY['earned'::point_transaction_type, 'used'::point_transaction_type])) AND ("referenceId" IS NOT NULL))`,
      ),
  ],
)

export const customerPreferences = pgTable(
  'customer_preferences',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    customerId: uuid().notNull(),
    preferredStaffId: uuid(),
    preferredTimeSlots: jsonb().notNull(),
    avoidStaffIds: uuid().array().notNull(),
    stylePreferences: jsonb(),
    communicationStyle: varchar({ length: 100 }),
    specialRequests: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'customer_preferences_preferred_staff_not_avoided',
      sql`"preferredStaffId" <> ALL ("avoidStaffIds")`,
    ),
    check(
      'customer_preferences_style_is_an_object',
      sql`jsonb_typeof("stylePreferences") = 'object'::text`,
    ),
    check(
      'customer_preferences_time_slots_is_an_array',
      sql`jsonb_typeof("preferredTimeSlots") = 'array'::text`,
    ),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'customer_preferences_customer_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.preferredStaffId],
      foreignColumns: [staff.id],
      name: 'customer_preferences_staff_id_fk',
    }).onDelete('set null'),
    unique('customer_preferences_unique').on(table.customerId),
  ],
)

export const customerVersions = pgTable(
  'customer_versions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    customerId: uuid().notNull(),
    version: integer().notNull(),
    operation: customerVersionOperation().notNull(),
    changedBy: uuid(),
    changedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    firstName: varchar({ length: 100 }).notNull(),
    lastName: varchar({ length: 100 }).notNull(),
    firstNameKana: varchar({ length: 100 }),
    lastNameKana: varchar({ length: 100 }),
    email: varchar({ length: 255 }).notNull(),
    phoneNumber: varchar({ length: 20 }).notNull(),
    alternativePhone: varchar({ length: 20 }),
    postalCode: varchar({ length: 10 }),
    prefecture: varchar({ length: 50 }),
    city: varchar({ length: 100 }),
    address: varchar({ length: 255 }),
    building: varchar({ length: 255 }),
    birthDate: date(),
    gender: varchar({ length: 20 }),
    occupation: varchar({ length: 100 }),
    membershipTier: membershipTier().notNull(),
    preferences: jsonb(),
    notes: text(),
    internalNotes: text(),
    tags: text().array().notNull(),
    referredBy: uuid(),
    referralCode: varchar({ length: 50 }),
    allowMarketing: boolean().notNull(),
    allowSms: boolean().notNull(),
    allowEmail: boolean().notNull(),
    isActive: boolean().notNull(),
    hairType: hairType(),
    hairThickness: hairThickness(),
    scalpCondition: scalpCondition(),
    customerStatus: customerStatus().notNull(),
  },
  (table) => [
    check(
      'customer_versions_changed_by_unless_baseline',
      sql`(operation = 'baseline'::customer_version_operation) = ("changedBy" IS NULL)`,
    ),
    check('customer_versions_version_positive', sql`version > 0`),
    foreignKey({
      columns: [table.changedBy],
      foreignColumns: [users.id],
      name: 'customer_versions_changed_by_fk',
    }),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'customer_versions_customer_id_fk',
    }).onDelete('cascade'),
    unique('customer_versions_customer_version_unique').on(
      table.customerId,
      table.version,
    ),
  ],
)

export const customers = pgTable(
  'customers',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid(),
    firstName: varchar({ length: 100 }).notNull(),
    lastName: varchar({ length: 100 }).notNull(),
    firstNameKana: varchar({ length: 100 }),
    lastNameKana: varchar({ length: 100 }),
    email: varchar({ length: 255 }).notNull(),
    phoneNumber: varchar({ length: 20 }).notNull(),
    alternativePhone: varchar({ length: 20 }),
    postalCode: varchar({ length: 10 }),
    prefecture: varchar({ length: 50 }),
    city: varchar({ length: 100 }),
    address: varchar({ length: 255 }),
    building: varchar({ length: 255 }),
    birthDate: date(),
    gender: varchar({ length: 20 }),
    occupation: varchar({ length: 100 }),
    membershipTier: membershipTier().default('regular').notNull(),
    loyaltyPoints: integer().default(0).notNull(),
    preferences: jsonb(),
    notes: text(),
    internalNotes: text(),
    tags: text().array().notNull(),
    referredBy: uuid(),
    referralCode: varchar({ length: 50 }),
    allowMarketing: boolean().default(true).notNull(),
    allowSms: boolean().default(true).notNull(),
    allowEmail: boolean().default(true).notNull(),
    firstVisitDate: date(),
    lastVisitDate: date(),
    visitCount: integer().default(0).notNull(),
    noShowCount: integer().default(0).notNull(),
    cancellationCount: integer().default(0).notNull(),
    isActive: boolean().default(true).notNull(),
    deletedAt: timestamp({ withTimezone: true, mode: 'string' }),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    hairType: hairType(),
    hairThickness: hairThickness(),
    scalpCondition: scalpCondition(),
    customerStatus: customerStatus().default('active').notNull(),
  },
  (table) => [
    check(
      'customers_counts_not_negative',
      sql`("visitCount" >= 0) AND ("noShowCount" >= 0) AND ("cancellationCount" >= 0)`,
    ),
    check(
      'customers_email_lower_case',
      sql`(email)::text = lower((email)::text)`,
    ),
    check(
      'customers_gender_known',
      sql`(gender)::text = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text])`,
    ),
    check('customers_loyalty_points_not_negative', sql`"loyaltyPoints" >= 0`),
    check('customers_not_referred_by_itself', sql`"referredBy" <> id`),
    check(
      'customers_preferences_is_an_object',
      sql`jsonb_typeof(preferences) = 'object'::text`,
    ),
    check(
      'customers_visit_days_go_with_visits',
      sql`(("visitCount" = 0) = ("firstVisitDate" IS NULL)) AND (("firstVisitDate" IS NULL) = ("lastVisitDate" IS NULL)) AND (("firstVisitDate" IS NULL) OR ("firstVisitDate" <= "lastVisitDate"))`,
    ),
    foreignKey({
      columns: [table.referredBy],
      foreignColumns: [table.id],
      name: 'customers_referred_by_fk',
    }).onDelete('set null'),
    index('idx_customers_customer_status').using(
      'btree',
      table.customerStatus.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_customers_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_customers_email').using(
      'btree',
      table.email.asc().nullsLast().op('text_ops'),
    ),
    index('idx_customers_hair_type').using(
      'btree',
      table.hairType.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_customers_membership_tier').using(
      'btree',
      table.membershipTier.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_customers_phone_number').using(
      'btree',
      table.phoneNumber.asc().nullsLast().op('text_ops'),
    ),
    unique('customers_referral_code_unique').on(table.referralCode),
    uniqueIndex('customers_email_unique')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`("deletedAt" IS NULL)`),
    uniqueIndex('customers_user_unique')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`("deletedAt" IS NULL)`),
  ],
)

export const inventory = pgTable(
  'inventory',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    productId: uuid().notNull(),
    currentStock: numeric({ precision: 10, scale: 2 }).notNull(),
    availableStock: numeric({ precision: 10, scale: 2 }).notNull(),
    reservedStock: numeric({ precision: 10, scale: 2 }).default('0').notNull(),
    lotNumber: varchar({ length: 100 }),
    expiryDate: date(),
    location: varchar({ length: 100 }),
    shelf: varchar({ length: 50 }),
    lastCountedAt: timestamp({ withTimezone: true, mode: 'string' }),
    lastCountedBy: uuid(),
    notes: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'inventory_stock',
      sql`("currentStock" >= (0)::numeric) AND ("reservedStock" >= (0)::numeric) AND ("reservedStock" <= "currentStock") AND ("availableStock" = ("currentStock" - "reservedStock"))`,
    ),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: 'inventory_product_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'inventory_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_inventory_expiry_date').using(
      'btree',
      table.expiryDate.asc().nullsLast().op('date_ops'),
    ),
    index('idx_inventory_lot_number').using(
      'btree',
      table.lotNumber.asc().nullsLast().op('text_ops'),
    ),
    index('idx_inventory_product_id').using(
      'btree',
      table.productId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_inventory_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
    unique('inventory_unique').on(
      table.salonId,
      table.productId,
      table.lotNumber,
    ),
    uniqueIndex('inventory_unique_without_lot')
      .using(
        'btree',
        table.salonId.asc().nullsLast().op('uuid_ops'),
        table.productId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`("lotNumber" IS NULL)`),
  ],
)

export const inventoryAlertAcknowledgements = pgTable(
  'inventory_alert_acknowledgements',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    productId: uuid().notNull(),
    inventoryId: uuid(),
    alert: inventoryAlertType().notNull(),
    severity: inventoryAlertSeverity().notNull(),
    threshold: numeric({ precision: 10, scale: 2 }),
    expiryDate: date(),
    notes: text(),
    acknowledgedBy: uuid(),
    acknowledgedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'inventory_alert_acknowledgements_severity',
      sql`((alert <> 'low_stock'::inventory_alert_type) OR (severity = ANY (ARRAY['warning'::inventory_alert_severity, 'critical'::inventory_alert_severity]))) AND ((alert <> 'overstock'::inventory_alert_type) OR (severity = 'info'::inventory_alert_severity)) AND ((alert <> 'expiring'::inventory_alert_type) OR (severity = 'warning'::inventory_alert_severity)) AND ((alert <> 'expired'::inventory_alert_type) OR (severity = 'critical'::inventory_alert_severity))`,
    ),
    check(
      'inventory_alert_acknowledgements_subject',
      sql`((alert = ANY (ARRAY['low_stock'::inventory_alert_type, 'overstock'::inventory_alert_type])) AND ("inventoryId" IS NULL) AND ("expiryDate" IS NULL) AND (threshold IS NOT NULL) AND (threshold >= (0)::numeric)) OR ((alert = ANY (ARRAY['expiring'::inventory_alert_type, 'expired'::inventory_alert_type])) AND ("inventoryId" IS NOT NULL) AND ("expiryDate" IS NOT NULL) AND (threshold IS NULL))`,
    ),
    foreignKey({
      columns: [table.inventoryId],
      foreignColumns: [inventory.id],
      name: 'inventory_alert_acknowledgements_inventory_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: 'inventory_alert_acknowledgements_product_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'inventory_alert_acknowledgements_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_inventory_alert_acknowledgements_inventory_id').using(
      'btree',
      table.inventoryId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_inventory_alert_acknowledgements_product_time').using(
      'btree',
      table.productId.asc().nullsLast().op('uuid_ops'),
      table.acknowledgedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_inventory_alert_acknowledgements_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
  ],
)

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    productId: uuid().notNull(),
    inventoryId: uuid(),
    transactionType: inventoryTransactionType().notNull(),
    quantity: numeric({ precision: 10, scale: 2 }).notNull(),
    balanceBefore: numeric({ precision: 10, scale: 2 }).notNull(),
    balanceAfter: numeric({ precision: 10, scale: 2 }).notNull(),
    unitCost: integer(),
    totalCost: integer(),
    referenceType: varchar({ length: 50 }),
    referenceId: uuid(),
    lotNumber: varchar({ length: 100 }),
    expiryDate: date(),
    reason: text(),
    performedBy: uuid(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'inventory_transactions_balance',
      sql`("balanceBefore" >= (0)::numeric) AND ("balanceAfter" >= (0)::numeric) AND ("balanceAfter" = ("balanceBefore" + quantity))`,
    ),
    check(
      'inventory_transactions_cost',
      sql`(("unitCost" IS NULL) AND ("totalCost" IS NULL)) OR (("unitCost" IS NOT NULL) AND ("totalCost" IS NOT NULL) AND ("unitCost" >= 0) AND (("totalCost")::numeric = round((("unitCost")::numeric * abs(quantity)))))`,
    ),
    check(
      'inventory_transactions_quantity_of_type',
      sql`(quantity <> (0)::numeric) AND (("transactionType" <> 'purchase'::inventory_transaction_type) OR (quantity > (0)::numeric)) AND (("transactionType" <> ALL (ARRAY['sale'::inventory_transaction_type, 'use'::inventory_transaction_type, 'disposal'::inventory_transaction_type])) OR (quantity < (0)::numeric))`,
    ),
    check(
      'inventory_transactions_reason_of_type',
      sql`("transactionType" <> ALL (ARRAY['adjustment'::inventory_transaction_type, 'disposal'::inventory_transaction_type])) OR (reason IS NOT NULL)`,
    ),
    check(
      'inventory_transactions_reference_pair',
      sql`("referenceType" IS NULL) = ("referenceId" IS NULL)`,
    ),
    foreignKey({
      columns: [table.inventoryId],
      foreignColumns: [inventory.id],
      name: 'inventory_transactions_inventory_id_fk',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: 'inventory_transactions_product_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'inventory_transactions_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_inventory_transactions_created_at').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_inventory_transactions_inventory_time').using(
      'btree',
      table.inventoryId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_inventory_transactions_product_time').using(
      'btree',
      table.productId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_inventory_transactions_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_inventory_transactions_transaction_type').using(
      'btree',
      table.transactionType.asc().nullsLast().op('enum_ops'),
    ),
  ],
)

export const medicalCharts = pgTable(
  'medical_charts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    customerId: uuid().notNull(),
    previousTreatments: jsonb().notNull(),
    medicalConditions: text(),
    preferredProducts: text().array().notNull(),
    avoidProducts: text().array().notNull(),
    notes: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'medical_charts_lists',
      sql`(jsonb_typeof("previousTreatments") = 'array'::text) AND (array_position("preferredProducts", NULL::text) IS NULL) AND (array_position("avoidProducts", NULL::text) IS NULL)`,
    ),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'medical_charts_customer_id_fk',
    }).onDelete('cascade'),
    index('idx_medical_charts_created_at').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    unique('medical_charts_customer_id_unique').on(table.customerId),
  ],
)

export const openingHours = pgTable(
  'opening_hours',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    dayOfWeek: dayOfWeek().notNull(),
    date: date().notNull(),
    openTime: time(),
    closeTime: time(),
    isHoliday: boolean().default(false).notNull(),
    holidayName: varchar({ length: 100 }),
    notes: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'opening_hours_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_opening_hours_date').using(
      'btree',
      table.date.asc().nullsLast().op('date_ops'),
    ),
    index('idx_opening_hours_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('opening_hours_salon_date_unique').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
      table.date.asc().nullsLast().op('date_ops'),
    ),
  ],
)

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    method: paymentMethod().notNull(),
    displayName: varchar({ length: 100 }).notNull(),
    description: text(),
    processorName: varchar({ length: 100 }),
    processorConfig: jsonb(),
    fee: numeric({ precision: 5, scale: 2 }),
    minimumAmount: integer(),
    maximumAmount: integer(),
    isOnlineEnabled: boolean().default(false).notNull(),
    isOfflineEnabled: boolean().default(true).notNull(),
    sortOrder: integer().default(0).notNull(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'payment_methods_amount_limits',
      sql`(("minimumAmount" IS NULL) OR ("minimumAmount" >= 1)) AND (("maximumAmount" IS NULL) OR ("maximumAmount" >= 1)) AND (("minimumAmount" IS NULL) OR ("maximumAmount" IS NULL) OR ("minimumAmount" <= "maximumAmount"))`,
    ),
    check(
      'payment_methods_fee_is_a_percentage',
      sql`(fee IS NULL) OR ((fee >= (0)::numeric) AND (fee <= (100)::numeric))`,
    ),
    check('payment_methods_sort_order_not_negative', sql`"sortOrder" >= 0`),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'payment_methods_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_payment_methods_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
  ],
)

export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    saleId: uuid().notNull(),
    paymentMethodId: uuid().notNull(),
    transactionNumber: varchar({ length: 100 }).notNull(),
    amount: integer().notNull(),
    status: paymentStatus().notNull(),
    processorTransactionId: varchar({ length: 255 }),
    processorResponse: jsonb(),
    cardLastFour: varchar({ length: 4 }),
    cardBrand: varchar({ length: 50 }),
    errorCode: varchar({ length: 100 }),
    errorMessage: text(),
    processedAt: timestamp({ withTimezone: true, mode: 'string' }),
    failedAt: timestamp({ withTimezone: true, mode: 'string' }),
    refundedAt: timestamp({ withTimezone: true, mode: 'string' }),
    refundAmount: integer(),
    refundReason: text(),
    metadata: jsonb(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check('payment_transactions_amount_positive', sql`amount >= 1`),
    check(
      'payment_transactions_card_last_four_digits',
      sql`("cardLastFour" IS NULL) OR (("cardLastFour")::text ~ '^[0-9]{4}$'::text)`,
    ),
    check(
      'payment_transactions_failure_of_failed',
      sql`((status = 'failed'::payment_status) = ("failedAt" IS NOT NULL)) AND ((status = 'failed'::payment_status) OR (("errorCode" IS NULL) AND ("errorMessage" IS NULL)))`,
    ),
    check(
      'payment_transactions_received_has_time',
      sql`(status = ANY (ARRAY['completed'::payment_status, 'refunded'::payment_status, 'partial_refund'::payment_status])) = ("processedAt" IS NOT NULL)`,
    ),
    check(
      'payment_transactions_refund_amount',
      sql`((status <> 'refunded'::payment_status) OR ("refundAmount" = amount)) AND ((status <> 'partial_refund'::payment_status) OR (("refundAmount" >= 1) AND ("refundAmount" < amount)))`,
    ),
    check(
      'payment_transactions_refund_of_refunded',
      sql`((status = ANY (ARRAY['refunded'::payment_status, 'partial_refund'::payment_status])) = ("refundedAt" IS NOT NULL)) AND ((status = ANY (ARRAY['refunded'::payment_status, 'partial_refund'::payment_status])) = ("refundAmount" IS NOT NULL)) AND ((status = ANY (ARRAY['refunded'::payment_status, 'partial_refund'::payment_status])) OR ("refundReason" IS NULL))`,
    ),
    foreignKey({
      columns: [table.paymentMethodId],
      foreignColumns: [paymentMethods.id],
      name: 'payment_transactions_payment_method_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.saleId],
      foreignColumns: [sales.id],
      name: 'payment_transactions_sale_id_fk',
    }).onDelete('cascade'),
    index('idx_payment_transactions_payment_method_id').using(
      'btree',
      table.paymentMethodId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_payment_transactions_sale_id').using(
      'btree',
      table.saleId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_payment_transactions_status').using(
      'btree',
      table.status.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_payment_transactions_transaction_number').using(
      'btree',
      table.transactionNumber.asc().nullsLast().op('text_ops'),
    ),
    unique('payment_transactions_transaction_number_unique').on(
      table.transactionNumber,
    ),
  ],
)

export const products = pgTable(
  'products',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    productCode: varchar({ length: 100 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    category: varchar({ length: 100 }),
    brand: varchar({ length: 100 }),
    purchasePrice: integer(),
    retailPrice: integer(),
    salonPrice: integer(),
    unit: varchar({ length: 20 }).notNull(),
    minimumStock: numeric({ precision: 10, scale: 2 }).default('0').notNull(),
    maximumStock: numeric({ precision: 10, scale: 2 }),
    reorderPoint: numeric({ precision: 10, scale: 2 }),
    supplierProductCode: varchar({ length: 100 }),
    leadTimeDays: integer(),
    imageUrl: varchar({ length: 500 }),
    barcode: varchar({ length: 100 }),
    isForSale: boolean().default(false).notNull(),
    isForTreatment: boolean().default(true).notNull(),
    requiresLotTracking: boolean().default(false).notNull(),
    expiryMonths: integer(),
    storageConditions: text(),
    safetyDataSheet: varchar({ length: 500 }),
    isActive: boolean().default(true).notNull(),
    deletedAt: timestamp({ withTimezone: true, mode: 'string' }),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    supplier: varchar({ length: 255 }),
  },
  (table) => [
    check(
      'products_expiry_months_positive',
      sql`("expiryMonths" IS NULL) OR ("expiryMonths" >= 1)`,
    ),
    check(
      'products_lead_time_not_negative',
      sql`("leadTimeDays" IS NULL) OR ("leadTimeDays" >= 0)`,
    ),
    check(
      'products_prices_not_negative',
      sql`(("purchasePrice" IS NULL) OR ("purchasePrice" >= 0)) AND (("retailPrice" IS NULL) OR ("retailPrice" >= 0)) AND (("salonPrice" IS NULL) OR ("salonPrice" >= 0))`,
    ),
    check(
      'products_stock_levels',
      sql`("minimumStock" >= (0)::numeric) AND (("reorderPoint" IS NULL) OR ("reorderPoint" >= "minimumStock")) AND (("maximumStock" IS NULL) OR ("maximumStock" >= "minimumStock")) AND (("reorderPoint" IS NULL) OR ("maximumStock" IS NULL) OR ("reorderPoint" <= "maximumStock"))`,
    ),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'products_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_products_barcode').using(
      'btree',
      table.barcode.asc().nullsLast().op('text_ops'),
    ),
    index('idx_products_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_products_product_code').using(
      'btree',
      table.productCode.asc().nullsLast().op('text_ops'),
    ),
    index('idx_products_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('products_code_salon_unique')
      .using(
        'btree',
        table.salonId.asc().nullsLast().op('uuid_ops'),
        table.productCode.asc().nullsLast().op('text_ops'),
      )
      .where(sql`("deletedAt" IS NULL)`),
  ],
)

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    purchaseOrderId: uuid().notNull(),
    inventoryId: uuid(),
    productCode: varchar({ length: 100 }).notNull(),
    productName: varchar({ length: 255 }).notNull(),
    quantity: numeric({ precision: 10, scale: 2 }).notNull(),
    unit: varchar({ length: 20 }).notNull(),
    unitPrice: integer().notNull(),
    totalPrice: integer().notNull(),
    notes: text(),
    sortOrder: integer().notNull(),
  },
  (table) => [
    check(
      'purchase_order_items_amounts',
      sql`(quantity > (0)::numeric) AND ("unitPrice" >= 0) AND ("sortOrder" >= 0) AND (("totalPrice")::numeric = round((("unitPrice")::numeric * quantity)))`,
    ),
    foreignKey({
      columns: [table.inventoryId],
      foreignColumns: [inventory.id],
      name: 'purchase_order_items_inventory_id_fk',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.purchaseOrderId],
      foreignColumns: [purchaseOrders.id],
      name: 'purchase_order_items_purchase_order_id_fk',
    }).onDelete('cascade'),
    index('idx_purchase_order_items_inventory_id').using(
      'btree',
      table.inventoryId.asc().nullsLast().op('uuid_ops'),
    ),
    unique('purchase_order_items_order_inventory_unique').on(
      table.purchaseOrderId,
      table.inventoryId,
    ),
    unique('purchase_order_items_order_sort_unique').on(
      table.purchaseOrderId,
      table.sortOrder,
    ),
  ],
)

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    orderNumber: varchar({ length: 50 }).notNull(),
    supplier: varchar({ length: 255 }).notNull(),
    status: orderStatus().default('draft').notNull(),
    subtotal: integer().notNull(),
    taxAmount: integer().notNull(),
    shippingCost: integer(),
    totalAmount: integer().notNull(),
    orderDate: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    expectedDelivery: timestamp({ withTimezone: true, mode: 'string' }),
    actualDelivery: timestamp({ withTimezone: true, mode: 'string' }),
    deliveryNotes: text(),
    paymentTerms: text(),
    notes: text(),
    approvedBy: uuid(),
    approvedAt: timestamp({ withTimezone: true, mode: 'string' }),
    cancelledAt: timestamp({ withTimezone: true, mode: 'string' }),
    cancellationReason: text(),
    createdBy: uuid(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'purchase_orders_amounts',
      sql`(subtotal >= 0) AND ("taxAmount" >= 0) AND (("shippingCost" IS NULL) OR ("shippingCost" >= 0)) AND (("totalAmount")::bigint = (((subtotal)::bigint + ("taxAmount")::bigint) + (COALESCE("shippingCost", 0))::bigint))`,
    ),
    check(
      'purchase_orders_approval',
      sql`(("approvedBy" IS NULL) OR ("approvedAt" IS NOT NULL)) AND ((status <> ALL (ARRAY['draft'::order_status, 'pending'::order_status])) OR ("approvedAt" IS NULL)) AND ((status <> ALL (ARRAY['approved'::order_status, 'ordered'::order_status, 'shipped'::order_status, 'delivered'::order_status])) OR ("approvedAt" IS NOT NULL))`,
    ),
    check(
      'purchase_orders_cancellation',
      sql`((status = 'cancelled'::order_status) = ("cancelledAt" IS NOT NULL)) AND (("cancelledAt" IS NULL) = ("cancellationReason" IS NULL))`,
    ),
    check(
      'purchase_orders_delivery',
      sql`(status = 'delivered'::order_status) = ("actualDelivery" IS NOT NULL)`,
    ),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'purchase_orders_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_purchase_orders_salon_order_date').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
      table.orderDate.asc().nullsLast().op('timestamptz_ops'),
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    unique('purchase_orders_order_number_unique').on(table.orderNumber),
  ],
)

export const reviewHelpfulVotes = pgTable(
  'review_helpful_votes',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    reviewId: uuid().notNull(),
    customerId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'review_helpful_votes_customer_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.reviewId],
      foreignColumns: [reviews.id],
      name: 'review_helpful_votes_review_id_fk',
    }).onDelete('cascade'),
    unique('review_helpful_votes_review_customer_unique').on(
      table.reviewId,
      table.customerId,
    ),
  ],
)

export const reviewReports = pgTable(
  'review_reports',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    reviewId: uuid().notNull(),
    reportedBy: uuid().notNull(),
    reason: reviewReportReason().notNull(),
    details: varchar({ length: 2000 }),
    status: reviewReportStatus().default('pending').notNull(),
    resolvedBy: uuid(),
    resolvedAt: timestamp({ withTimezone: true, mode: 'string' }),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'review_reports_other_has_details',
      sql`(reason <> 'other'::review_report_reason) OR (details IS NOT NULL)`,
    ),
    check(
      'review_reports_resolved_when_dismissed',
      sql`((status = 'pending'::review_report_status) AND ("resolvedBy" IS NULL) AND ("resolvedAt" IS NULL)) OR ((status = 'dismissed'::review_report_status) AND ("resolvedBy" IS NOT NULL) AND ("resolvedAt" IS NOT NULL))`,
    ),
    foreignKey({
      columns: [table.reviewId],
      foreignColumns: [reviews.id],
      name: 'review_reports_review_id_fk',
    }).onDelete('cascade'),
    index('idx_review_reports_created_at').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    unique('review_reports_review_reporter_unique').on(
      table.reviewId,
      table.reportedBy,
    ),
  ],
)

export const reviews = pgTable(
  'reviews',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    customerId: uuid().notNull(),
    bookingId: uuid().notNull(),
    staffId: uuid(),
    overallRating: integer().notNull(),
    serviceRating: integer(),
    staffRating: integer(),
    atmosphereRating: integer(),
    cleanlinessRating: integer(),
    valueRating: integer(),
    title: varchar({ length: 255 }),
    comment: text(),
    imageUrls: jsonb().default([]).notNull(),
    isVerified: boolean().default(false).notNull(),
    helpfulCount: integer().default(0).notNull(),
    reportCount: integer().default(0).notNull(),
    ownerResponse: text(),
    ownerRespondedAt: timestamp({ withTimezone: true, mode: 'string' }),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'reviews_counts_not_negative',
      sql`("helpfulCount" >= 0) AND ("reportCount" >= 0)`,
    ),
    check(
      'reviews_image_urls_array',
      sql`jsonb_typeof("imageUrls") = 'array'::text`,
    ),
    check(
      'reviews_owner_response_pair',
      sql`("ownerResponse" IS NULL) = ("ownerRespondedAt" IS NULL)`,
    ),
    check(
      'reviews_ratings_in_range',
      sql`("overallRating" >= 1) AND ("overallRating" <= 5) AND (("serviceRating" IS NULL) OR (("serviceRating" >= 1) AND ("serviceRating" <= 5))) AND (("staffRating" IS NULL) OR (("staffRating" >= 1) AND ("staffRating" <= 5))) AND (("atmosphereRating" IS NULL) OR (("atmosphereRating" >= 1) AND ("atmosphereRating" <= 5))) AND (("cleanlinessRating" IS NULL) OR (("cleanlinessRating" >= 1) AND ("cleanlinessRating" <= 5))) AND (("valueRating" IS NULL) OR (("valueRating" >= 1) AND ("valueRating" <= 5)))`,
    ),
    foreignKey({
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
      name: 'reviews_booking_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'reviews_customer_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'reviews_salon_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [staff.id],
      name: 'reviews_staff_id_fk',
    }).onDelete('set null'),
    index('idx_reviews_booking_id').using(
      'btree',
      table.bookingId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_reviews_customer_id').using(
      'btree',
      table.customerId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_reviews_overall_rating').using(
      'btree',
      table.overallRating.asc().nullsLast().op('int4_ops'),
    ),
    index('idx_reviews_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_reviews_staff_id').using(
      'btree',
      table.staffId.asc().nullsLast().op('uuid_ops'),
    ),
    unique('reviews_booking_unique').on(table.bookingId),
  ],
)

export const sales = pgTable(
  'sales',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    saleNumber: varchar({ length: 50 }).notNull(),
    salonId: uuid().notNull(),
    customerId: uuid(),
    staffId: uuid(),
    bookingId: uuid(),
    saleDate: date().notNull(),
    saleTime: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    subtotal: integer().notNull(),
    discountAmount: integer().default(0).notNull(),
    taxAmount: integer().notNull(),
    totalAmount: integer().notNull(),
    pointsUsed: integer(),
    pointsEarned: integer(),
    paymentStatus: paymentStatus().default('pending').notNull(),
    isVoid: boolean().default(false).notNull(),
    voidedAt: timestamp({ withTimezone: true, mode: 'string' }),
    voidReason: text(),
    notes: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'sales_amounts_not_negative',
      sql`(subtotal >= 0) AND ("discountAmount" >= 0) AND ("taxAmount" >= 0) AND ("totalAmount" >= 0) AND (("pointsUsed" IS NULL) OR ("pointsUsed" >= 0)) AND (("pointsEarned" IS NULL) OR ("pointsEarned" >= 0))`,
    ),
    check('sales_discount_within_subtotal', sql`"discountAmount" <= subtotal`),
    check(
      'sales_points_need_customer',
      sql`("customerId" IS NOT NULL) OR (("pointsUsed" IS NULL) AND ("pointsEarned" IS NULL))`,
    ),
    check(
      'sales_total_is_the_sum',
      sql`"totalAmount" = ((subtotal - "discountAmount") + "taxAmount")`,
    ),
    check('sales_void_has_time', sql`"isVoid" = ("voidedAt" IS NOT NULL)`),
    check('sales_void_reason_of_void', sql`("voidReason" IS NULL) OR "isVoid"`),
    foreignKey({
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
      name: 'sales_booking_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'sales_customer_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'sales_salon_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [staff.id],
      name: 'sales_staff_id_fk',
    }).onDelete('restrict'),
    index('idx_sales_booking_id').using(
      'btree',
      table.bookingId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_sales_customer_id').using(
      'btree',
      table.customerId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_sales_sale_date').using(
      'btree',
      table.saleDate.asc().nullsLast().op('date_ops'),
    ),
    index('idx_sales_sale_number').using(
      'btree',
      table.saleNumber.asc().nullsLast().op('text_ops'),
    ),
    index('idx_sales_salon_time').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
      table.saleTime.asc().nullsLast().op('timestamptz_ops'),
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_sales_staff_id').using(
      'btree',
      table.staffId.asc().nullsLast().op('uuid_ops'),
    ),
    unique('sales_sale_number_unique').on(table.saleNumber),
    uniqueIndex('sales_booking_live_unique')
      .using('btree', table.bookingId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(NOT "isVoid")`),
  ],
)

export const salesDetails = pgTable(
  'sales_details',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    saleId: uuid().notNull(),
    itemType: varchar({ length: 50 }).notNull(),
    itemId: uuid(),
    itemName: varchar({ length: 255 }).notNull(),
    quantity: integer().notNull(),
    unitPrice: integer().notNull(),
    discountAmount: integer().default(0).notNull(),
    taxAmount: integer().notNull(),
    totalAmount: integer().notNull(),
    staffId: uuid(),
    commissionRate: numeric({ precision: 5, scale: 2 }),
    commissionAmount: integer(),
    notes: text(),
    sortOrder: integer().default(0).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'sales_details_amounts_not_negative',
      sql`("unitPrice" >= 0) AND ("discountAmount" >= 0) AND ("taxAmount" >= 0) AND ("totalAmount" >= 0) AND (("commissionAmount" IS NULL) OR ("commissionAmount" >= 0))`,
    ),
    check(
      'sales_details_commission_rate_is_a_percentage',
      sql`("commissionRate" IS NULL) OR (("commissionRate" >= (0)::numeric) AND ("commissionRate" <= (100)::numeric))`,
    ),
    check(
      'sales_details_discount_within_price',
      sql`"discountAmount" <= ((quantity)::bigint * "unitPrice")`,
    ),
    check(
      'sales_details_item_of_a_known_type',
      sql`("itemId" IS NULL) OR (("itemType")::text = ANY (ARRAY['service'::text, 'product'::text]))`,
    ),
    check('sales_details_quantity_positive', sql`quantity >= 1`),
    check('sales_details_sort_order_not_negative', sql`"sortOrder" >= 0`),
    check(
      'sales_details_total_is_the_sum',
      sql`"totalAmount" = ((((quantity)::bigint * "unitPrice") - "discountAmount") + "taxAmount")`,
    ),
    foreignKey({
      columns: [table.saleId],
      foreignColumns: [sales.id],
      name: 'sales_details_sale_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [staff.id],
      name: 'sales_details_staff_id_fk',
    }).onDelete('restrict'),
    index('idx_sales_details_sale_id').using(
      'btree',
      table.saleId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_sales_details_staff_id').using(
      'btree',
      table.staffId.asc().nullsLast().op('uuid_ops'),
    ),
    unique('sales_details_order_unique').on(table.saleId, table.sortOrder),
  ],
)

export const salons = pgTable(
  'salons',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: varchar({ length: 255 }).notNull(),
    nameKana: varchar({ length: 255 }),
    description: text(),
    postalCode: varchar({ length: 10 }),
    prefecture: varchar({ length: 50 }).notNull(),
    city: varchar({ length: 100 }).notNull(),
    address: varchar({ length: 255 }).notNull(),
    building: varchar({ length: 255 }),
    latitude: numeric({ precision: 10, scale: 8 }),
    longitude: numeric({ precision: 11, scale: 8 }),
    phoneNumber: varchar({ length: 20 }).notNull(),
    alternativePhone: varchar({ length: 20 }),
    email: varchar({ length: 255 }).notNull(),
    websiteUrl: varchar({ length: 500 }),
    logoUrl: varchar({ length: 500 }),
    imageUrls: text().array().notNull(),
    features: text().array().notNull(),
    amenities: text().array().notNull(),
    businessHours: jsonb(),
    rating: numeric({ precision: 3, scale: 2 }),
    reviewCount: integer().default(0).notNull(),
    timezone: varchar({ length: 50 }).default('Asia/Tokyo').notNull(),
    currency: varchar({ length: 3 }).default('JPY').notNull(),
    taxRate: numeric({ precision: 5, scale: 2 }).default('10.00').notNull(),
    isActive: boolean().default(true).notNull(),
    deletedAt: timestamp({ withTimezone: true, mode: 'string' }),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'salons_rating_in_range',
      sql`(rating IS NULL) OR ((rating >= (1)::numeric) AND (rating <= (5)::numeric))`,
    ),
    check(
      'salons_rating_of_reviews',
      sql`("reviewCount" = 0) = (rating IS NULL)`,
    ),
    check('salons_review_count_not_negative', sql`"reviewCount" >= 0`),
    index('idx_salons_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_salons_email').using(
      'btree',
      table.email.asc().nullsLast().op('text_ops'),
    ),
    index('idx_salons_rating').using(
      'btree',
      table.rating.asc().nullsLast().op('numeric_ops'),
    ),
    index('idx_salons_review_count').using(
      'btree',
      table.reviewCount.asc().nullsLast().op('int4_ops'),
    ),
    uniqueIndex('salons_email_unique')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`("deletedAt" IS NULL)`),
  ],
)

export const serviceCategories = pgTable(
  'service_categories',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    parentId: uuid(),
    category: serviceCategory().notNull(),
    displayOrder: integer().default(0).notNull(),
    iconUrl: varchar({ length: 500 }),
    color: varchar({ length: 7 }),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'service_categories_parent_id_fk',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'service_categories_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_service_categories_parent_id').using(
      'btree',
      table.parentId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_service_categories_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
  ],
)

export const serviceOptions = pgTable(
  'service_options',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    serviceId: uuid().notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    additionalTime: integer().default(0).notNull(),
    additionalPrice: integer().default(0).notNull(),
    maxQuantity: integer().default(1).notNull(),
    isRequired: boolean().default(false).notNull(),
    sortOrder: integer().default(0).notNull(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    optionType: serviceOptionType().default('addon').notNull(),
  },
  (table) => [
    check(
      'service_options_additional_price_not_negative',
      sql`"additionalPrice" >= 0`,
    ),
    check(
      'service_options_additional_time_not_negative',
      sql`"additionalTime" >= 0`,
    ),
    check('service_options_max_quantity_positive', sql`"maxQuantity" > 0`),
    foreignKey({
      columns: [table.serviceId],
      foreignColumns: [services.id],
      name: 'service_options_service_id_fk',
    }).onDelete('cascade'),
    index('idx_service_options_service_id').using(
      'btree',
      table.serviceId.asc().nullsLast().op('uuid_ops'),
    ),
  ],
)

export const services = pgTable(
  'services',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    categoryId: uuid(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    shortDescription: varchar({ length: 500 }),
    duration: integer().notNull(),
    price: integer().notNull(),
    discountPrice: integer(),
    taxIncluded: boolean().default(true).notNull(),
    imageUrl: varchar({ length: 500 }),
    imageUrls: text().array().notNull(),
    requiredStaffLevel: staffLevel(),
    maxBookingsPerDay: integer(),
    requiresConsultation: boolean().default(false).notNull(),
    allowOnlineBooking: boolean().default(true).notNull(),
    isPackage: boolean().default(false).notNull(),
    packageServiceIds: uuid().array().notNull(),
    tags: text().array().notNull(),
    sortOrder: integer().default(0).notNull(),
    isActive: boolean().default(true).notNull(),
    deletedAt: timestamp({ withTimezone: true, mode: 'string' }),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    pricingStrategy: pricingStrategy().default('fixed').notNull(),
    serviceStatus: serviceStatus().default('active').notNull(),
    availability: serviceAvailability().default('always').notNull(),
    bookingRequirements: bookingRequirement().array().notNull(),
  },
  (table) => [
    check(
      'services_discount_price_within_price',
      sql`("discountPrice" IS NULL) OR (("discountPrice" >= 0) AND ("discountPrice" <= price))`,
    ),
    check('services_duration_positive', sql`duration > 0`),
    check(
      'services_max_bookings_per_day_positive',
      sql`("maxBookingsPerDay" IS NULL) OR ("maxBookingsPerDay" > 0)`,
    ),
    check(
      'services_package_members',
      sql`("isPackage" AND ((cardinality("packageServiceIds") >= 2) AND (cardinality("packageServiceIds") <= 20))) OR ((NOT "isPackage") AND (cardinality("packageServiceIds") = 0))`,
    ),
    check('services_price_not_negative', sql`price >= 0`),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [serviceCategories.id],
      name: 'services_category_id_fk',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'services_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_services_availability').using(
      'btree',
      table.availability.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_services_category_id').using(
      'btree',
      table.categoryId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_services_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_services_pricing_strategy').using(
      'btree',
      table.pricingStrategy.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_services_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_services_service_status').using(
      'btree',
      table.serviceStatus.asc().nullsLast().op('enum_ops'),
    ),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid().notNull(),
    tokenHash: text().notNull(),
    refreshTokenHash: text().notNull(),
    ipAddress: varchar({ length: 50 }),
    userAgent: text(),
    expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    refreshExpiresAt: timestamp({
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    lastActivityAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'sessions_user_id_fk',
    }).onDelete('cascade'),
    index('idx_sessions_expires_at').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_sessions_user_id').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
    ),
    unique('sessions_refresh_token_hash_unique').on(table.refreshTokenHash),
    unique('sessions_token_hash_unique').on(table.tokenHash),
  ],
)

export const staff = pgTable(
  'staff',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    salonId: uuid().notNull(),
    userId: uuid(),
    firstName: varchar({ length: 100 }).notNull(),
    lastName: varchar({ length: 100 }).notNull(),
    firstNameKana: varchar({ length: 100 }),
    lastNameKana: varchar({ length: 100 }),
    displayName: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    phoneNumber: varchar({ length: 20 }).notNull(),
    alternativePhone: varchar({ length: 20 }),
    staffCode: varchar({ length: 50 }),
    level: staffLevel().default('stylist').notNull(),
    position: varchar({ length: 100 }),
    specialties: text().array().notNull(),
    bio: text(),
    imageUrl: varchar({ length: 500 }),
    yearsOfExperience: integer(),
    certifications: text().array().notNull(),
    hireDate: date(),
    employmentType: varchar({ length: 50 }),
    baseSalary: integer(),
    commissionRate: numeric({ precision: 5, scale: 2 }),
    canReceiveBookings: boolean().default(true).notNull(),
    maxConcurrentBookings: integer().default(1).notNull(),
    bufferTimeBefore: integer().default(0).notNull(),
    bufferTimeAfter: integer().default(0).notNull(),
    isActive: boolean().default(true).notNull(),
    deletedAt: timestamp({ withTimezone: true, mode: 'string' }),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check('staff_base_salary_not_negative', sql`"baseSalary" >= 0`),
    check(
      'staff_buffer_times_not_negative',
      sql`("bufferTimeBefore" >= 0) AND ("bufferTimeAfter" >= 0)`,
    ),
    check(
      'staff_commission_rate_is_a_percentage',
      sql`("commissionRate" >= (0)::numeric) AND ("commissionRate" <= (100)::numeric)`,
    ),
    check('staff_email_lower_case', sql`(email)::text = lower((email)::text)`),
    check(
      'staff_max_concurrent_bookings_positive',
      sql`"maxConcurrentBookings" >= 1`,
    ),
    check(
      'staff_years_of_experience_not_negative',
      sql`"yearsOfExperience" >= 0`,
    ),
    foreignKey({
      columns: [table.salonId],
      foreignColumns: [salons.id],
      name: 'staff_salon_id_fk',
    }).onDelete('cascade'),
    index('idx_staff_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_staff_email').using(
      'btree',
      table.email.asc().nullsLast().op('text_ops'),
    ),
    index('idx_staff_salon_id').using(
      'btree',
      table.salonId.asc().nullsLast().op('uuid_ops'),
    ),
    unique('staff_code_salon_unique').on(table.salonId, table.staffCode),
    uniqueIndex('staff_email_salon_unique')
      .using(
        'btree',
        table.salonId.asc().nullsLast().op('uuid_ops'),
        table.email.asc().nullsLast().op('text_ops'),
      )
      .where(sql`("deletedAt" IS NULL)`),
    uniqueIndex('staff_user_unique')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`("deletedAt" IS NULL)`),
  ],
)

export const staffInvitations = pgTable(
  'staff_invitations',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    staffId: uuid().notNull(),
    email: varchar({ length: 255 }).notNull(),
    role: salonRole().notNull(),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'staff_invitations_email_lower_case',
      sql`(email)::text = lower((email)::text)`,
    ),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [staff.id],
      name: 'staff_invitations_staff_id_fk',
    }).onDelete('cascade'),
    unique('staff_invitations_staff_unique').on(table.staffId),
    unique('staff_invitations_token_hash_unique').on(table.tokenHash),
  ],
)

export const staffSchedules = pgTable(
  'staff_schedules',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    staffId: uuid().notNull(),
    dayOfWeek: dayOfWeek(),
    date: date(),
    startTime: time(),
    endTime: time(),
    breakStartTime: time(),
    breakEndTime: time(),
    isRecurring: boolean().default(true).notNull(),
    isAvailable: boolean().default(true).notNull(),
    notes: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'staff_schedules_break_has_both_times',
      sql`("breakStartTime" IS NULL) = ("breakEndTime" IS NULL)`,
    ),
    check(
      'staff_schedules_break_inside_working_hours',
      sql`("startTime" < "breakStartTime") AND ("breakStartTime" < "breakEndTime") AND ("breakEndTime" < "endTime")`,
    ),
    check('staff_schedules_end_after_start', sql`"startTime" < "endTime"`),
    check(
      'staff_schedules_times_when_available',
      sql`("isAvailable" AND ("startTime" IS NOT NULL) AND ("endTime" IS NOT NULL)) OR ((NOT "isAvailable") AND ("startTime" IS NULL) AND ("endTime" IS NULL) AND ("breakStartTime" IS NULL) AND ("breakEndTime" IS NULL))`,
    ),
    check(
      'staff_schedules_weekly_or_single_day',
      sql`("isRecurring" AND ("dayOfWeek" IS NOT NULL) AND (date IS NULL)) OR ((NOT "isRecurring") AND ("dayOfWeek" IS NULL) AND (date IS NOT NULL))`,
    ),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [staff.id],
      name: 'staff_schedules_staff_id_fk',
    }).onDelete('cascade'),
    index('idx_staff_schedules_date').using(
      'btree',
      table.date.asc().nullsLast().op('date_ops'),
    ),
    index('idx_staff_schedules_day_of_week').using(
      'btree',
      table.dayOfWeek.asc().nullsLast().op('enum_ops'),
    ),
    index('idx_staff_schedules_staff_id').using(
      'btree',
      table.staffId.asc().nullsLast().op('uuid_ops'),
    ),
    uniqueIndex('staff_schedules_single_day_unique')
      .using(
        'btree',
        table.staffId.asc().nullsLast().op('uuid_ops'),
        table.date.asc().nullsLast().op('date_ops'),
      )
      .where(sql`(NOT "isRecurring")`),
    uniqueIndex('staff_schedules_weekly_unique')
      .using(
        'btree',
        table.staffId.asc().nullsLast().op('uuid_ops'),
        table.dayOfWeek.asc().nullsLast().op('enum_ops'),
      )
      .where(sql`"isRecurring"`),
  ],
)

export const treatmentMaterials = pgTable(
  'treatment_materials',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    treatmentRecordId: uuid().notNull(),
    productId: uuid().notNull(),
    quantity: numeric({ precision: 10, scale: 2 }).notNull(),
    unit: varchar({ length: 20 }).notNull(),
    lotNumber: varchar({ length: 100 }),
    notes: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    sortOrder: integer().notNull(),
  },
  (table) => [
    check(
      'treatment_materials_amounts',
      sql`(quantity > (0)::numeric) AND ("sortOrder" >= 0)`,
    ),
    foreignKey({
      columns: [table.productId],
      foreignColumns: [products.id],
      name: 'treatment_materials_product_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.treatmentRecordId],
      foreignColumns: [treatmentRecords.id],
      name: 'treatment_materials_treatment_record_id_fk',
    }).onDelete('cascade'),
    index('idx_treatment_materials_product_id').using(
      'btree',
      table.productId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_treatment_materials_treatment_record_id').using(
      'btree',
      table.treatmentRecordId.asc().nullsLast().op('uuid_ops'),
    ),
    unique('treatment_materials_record_sort_unique').on(
      table.treatmentRecordId,
      table.sortOrder,
    ),
  ],
)

export const treatmentPhotos = pgTable(
  'treatment_photos',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    treatmentRecordId: uuid().notNull(),
    photoType: treatmentPhotoType().notNull(),
    photoUrl: varchar({ length: 500 }).notNull(),
    thumbnailUrl: varchar({ length: 500 }),
    angle: varchar({ length: 50 }),
    description: text(),
    isPublic: boolean().default(false).notNull(),
    customerConsent: boolean().default(false).notNull(),
    sortOrder: integer().default(0).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'treatment_photos_consent',
      sql`(NOT "isPublic") OR "customerConsent"`,
    ),
    check('treatment_photos_sort_order', sql`"sortOrder" >= 0`),
    foreignKey({
      columns: [table.treatmentRecordId],
      foreignColumns: [treatmentRecords.id],
      name: 'treatment_photos_treatment_record_id_fk',
    }).onDelete('cascade'),
    unique('treatment_photos_record_url_unique').on(
      table.treatmentRecordId,
      table.photoUrl,
    ),
  ],
)

export const treatmentRecords = pgTable(
  'treatment_records',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    bookingId: uuid().notNull(),
    customerId: uuid().notNull(),
    staffId: uuid().notNull(),
    services: jsonb().notNull(),
    techniques: jsonb().default([]).notNull(),
    consultationNotes: text(),
    scalpCondition: text(),
    hairCondition: text(),
    colorFormula: text(),
    processingTime: integer(),
    resultNotes: text(),
    nextRecommendedDate: date(),
    nextRecommendedServices: jsonb().default([]).notNull(),
    homeCareSuggestions: text(),
    customerSatisfaction: integer(),
    staffEvaluation: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'treatment_records_lists',
      sql`(jsonb_typeof(services) = 'array'::text) AND (services <> '[]'::jsonb) AND (jsonb_typeof(techniques) = 'array'::text) AND (jsonb_typeof("nextRecommendedServices") = 'array'::text)`,
    ),
    check(
      'treatment_records_ranges',
      sql`(("processingTime" IS NULL) OR (("processingTime" >= 0) AND ("processingTime" <= 1440))) AND (("customerSatisfaction" IS NULL) OR (("customerSatisfaction" >= 1) AND ("customerSatisfaction" <= 5)))`,
    ),
    foreignKey({
      columns: [table.bookingId],
      foreignColumns: [bookings.id],
      name: 'treatment_records_booking_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'treatment_records_customer_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [staff.id],
      name: 'treatment_records_staff_id_fk',
    }).onDelete('restrict'),
    index('idx_treatment_records_booking_id').using(
      'btree',
      table.bookingId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_treatment_records_created_at').using(
      'btree',
      table.createdAt.asc().nullsLast().op('timestamptz_ops'),
      table.id.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_treatment_records_customer_id').using(
      'btree',
      table.customerId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_treatment_records_staff_id').using(
      'btree',
      table.staffId.asc().nullsLast().op('uuid_ops'),
    ),
    unique('treatment_records_booking_unique').on(table.bookingId),
  ],
)

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    email: varchar({ length: 255 }).notNull(),
    passwordHash: text().notNull(),
    role: userRole().default('customer').notNull(),
    status: accountStatus().default('active').notNull(),
    emailVerified: boolean().default(false).notNull(),
    emailVerificationTokenHash: varchar({ length: 255 }),
    emailVerificationExpiry: timestamp({ withTimezone: true, mode: 'string' }),
    passwordResetTokenHash: varchar({ length: 255 }),
    passwordResetExpiry: timestamp({ withTimezone: true, mode: 'string' }),
    lastPasswordChange: timestamp({ withTimezone: true, mode: 'string' }),
    twoFactorSecret: text(),
    backupCodes: jsonb(),
    failedLoginAttempts: integer().default(0).notNull(),
    lockedUntil: timestamp({ withTimezone: true, mode: 'string' }),
    lastLoginAt: timestamp({ withTimezone: true, mode: 'string' }),
    lastLoginIp: varchar({ length: 50 }),
    customerId: uuid(),
    staffId: uuid(),
    deletedAt: timestamp({ withTimezone: true, mode: 'string' }),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    twoFactorStatus: twoFactorStatus().default('disabled').notNull(),
    twoFactorLastUsedStep: integer(),
  },
  (table) => [
    check(
      'users_backup_codes_are_a_list',
      sql`jsonb_typeof("backupCodes") = 'array'::text`,
    ),
    check(
      'users_backup_codes_match_status',
      sql`("twoFactorStatus" = 'disabled'::two_factor_status) = ("backupCodes" IS NULL)`,
    ),
    check('users_email_lower_case', sql`(email)::text = lower((email)::text)`),
    check(
      'users_email_verification_token_complete',
      sql`("emailVerificationTokenHash" IS NULL) = ("emailVerificationExpiry" IS NULL)`,
    ),
    check(
      'users_password_reset_token_complete',
      sql`("passwordResetTokenHash" IS NULL) = ("passwordResetExpiry" IS NULL)`,
    ),
    check(
      'users_staff_needs_salon_role',
      sql`("staffId" IS NULL) OR (role = ANY (ARRAY['owner'::user_role, 'manager'::user_role, 'staff'::user_role]))`,
    ),
    check(
      'users_two_factor_secret_matches_status',
      sql`("twoFactorStatus" = 'disabled'::two_factor_status) = ("twoFactorSecret" IS NULL)`,
    ),
    check(
      'users_two_factor_step_needs_secret',
      sql`("twoFactorLastUsedStep" IS NULL) OR ("twoFactorSecret" IS NOT NULL)`,
    ),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: 'users_customer_id_fk',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.staffId],
      foreignColumns: [staff.id],
      name: 'users_staff_id_fk',
    }).onDelete('set null'),
    index('idx_users_customer_id').using(
      'btree',
      table.customerId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_users_deleted_at').using(
      'btree',
      table.deletedAt.asc().nullsLast().op('timestamptz_ops'),
    ),
    index('idx_users_staff_id').using(
      'btree',
      table.staffId.asc().nullsLast().op('uuid_ops'),
    ),
    index('idx_users_two_factor_status').using(
      'btree',
      table.twoFactorStatus.asc().nullsLast().op('enum_ops'),
    ),
    uniqueIndex('users_email_unique')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`("deletedAt" IS NULL)`),
    uniqueIndex('users_email_verification_token_hash_unique').using(
      'btree',
      table.emailVerificationTokenHash.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('users_password_reset_token_hash_unique').using(
      'btree',
      table.passwordResetTokenHash.asc().nullsLast().op('text_ops'),
    ),
    uniqueIndex('users_staff_unique')
      .using('btree', table.staffId.asc().nullsLast().op('uuid_ops'))
      .where(sql`("deletedAt" IS NULL)`),
  ],
)
