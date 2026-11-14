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

/** Users and their sessions. */
const authRules: ModelRule[] = [
  { model: 'Models.User', table: 'users', kind: 'response' },
  { model: 'Models.Session', table: 'sessions', kind: 'response' },
]

/** Staff and their schedules. */
const staffRules: ModelRule[] = [
  { model: 'Models.Staff', table: 'staff', kind: 'response' },
  { model: 'Models.StaffSchedule', table: 'staffSchedules', kind: 'response' },
]

/** Bookings (the booking and reservation operations). */
const bookingRules: ModelRule[] = [
  { model: 'Models.Booking', table: 'bookings', kind: 'response' },
]

/** Payments, points and sales. */
const paymentRules: ModelRule[] = [
  { model: 'Models.Payment', table: 'paymentTransactions', kind: 'response' },
]

/** Reviews. */
const reviewRules: ModelRule[] = [
  { model: 'Models.Review', table: 'reviews', kind: 'response' },
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

/** Treatment records. */
const treatmentRules: ModelRule[] = [
  {
    model: 'Models.TreatmentRecord',
    table: 'treatmentRecords',
    kind: 'response',
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
