import type { RequireSessionProps } from '@beauty-salon-frontend/session'

/**
 * Anybody with an account signs in to the portal; a screen for customers
 * alone asks for that role itself. What an account may do is decided by the
 * API, on every request.
 */
export const EVERY_ROLE: RequireSessionProps['roles'] = [
  'customer',
  'staff',
  'manager',
  'owner',
  'admin',
]

/** The screens of a booking are for customers: the staff of a salon books in the ledger of the salon. */
export const CUSTOMERS: RequireSessionProps['roles'] = ['customer']
