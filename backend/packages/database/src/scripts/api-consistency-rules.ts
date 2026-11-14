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

/**
 * Models of the domains that have a specification but no implementation yet.
 * Their known differences are recorded in the baseline; a new difference
 * fails the check.
 */
const specifiedOnlyRules: ModelRule[] = [
  { model: 'Models.Booking', table: 'bookings', kind: 'response' },
  { model: 'Models.Customer', table: 'customers', kind: 'response' },
  { model: 'Models.InventoryItem', table: 'inventory', kind: 'response' },
  {
    model: 'Models.InventoryTransaction',
    table: 'inventoryTransactions',
    kind: 'response',
  },
  { model: 'Models.Payment', table: 'paymentTransactions', kind: 'response' },
  { model: 'Models.Review', table: 'reviews', kind: 'response' },
  { model: 'Models.Service', table: 'services', kind: 'response' },
  {
    model: 'Models.CategoryModel',
    table: 'serviceCategories',
    kind: 'response',
  },
  { model: 'Models.Session', table: 'sessions', kind: 'response' },
  { model: 'Models.Staff', table: 'staff', kind: 'response' },
  { model: 'Models.StaffSchedule', table: 'staffSchedules', kind: 'response' },
  {
    model: 'Models.TreatmentRecord',
    table: 'treatmentRecords',
    kind: 'response',
  },
  { model: 'Models.User', table: 'users', kind: 'response' },
]

export const modelRules: ModelRule[] = [...salonRules, ...specifiedOnlyRules]
