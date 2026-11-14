import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'

/**
 * The customer ledger is one for the whole platform: a customer does not
 * belong to a salon. It is kept by those who serve customers: the
 * platform's administrators and the members of every salon. A customer does
 * not reach it, not even their own entry, because an entry holds what the
 * staff note for themselves.
 */

/** Administrators, and the owner, the managers and the staff of any salon. */
export const mayHandleCustomers = (actor: Actor): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, { type: 'salon' }, () => true)
    .with({ type: 'customer' }, { type: 'none' }, () => false)
    .exhaustive()

/** Administrators, and the owner and the managers of any salon. */
export const mayDeleteCustomers = (actor: Actor): boolean =>
  match(actor.scope)
    .with(
      { type: 'platform' },
      { type: 'salon', role: P.union('owner', 'manager') },
      () => true,
    )
    .with(
      { type: 'salon', role: 'staff' },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()
