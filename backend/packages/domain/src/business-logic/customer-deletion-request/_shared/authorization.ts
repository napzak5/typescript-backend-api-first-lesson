import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'

/**
 * Only administrators carry out the requests that are due: an erasure
 * changes what every salon sees of the customer, and it is run for the
 * whole platform, as the expiry of points is. Requests are taken, read
 * and cancelled by those who may delete a customer.
 */
export const mayEraseCustomers = (actor: Actor): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon' },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()
