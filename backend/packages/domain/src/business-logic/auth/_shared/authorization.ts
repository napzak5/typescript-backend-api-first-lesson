import type { Actor } from '../../../models/auth'

/**
 * Who may look at and repair the accounts of other users: the platform's
 * administrators. Every user reaches their own account without this.
 */
export const mayAdministerAccounts = (actor: Actor): boolean =>
  actor.scope.type === 'platform'
