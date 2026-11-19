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
