import { match } from 'ts-pattern'
import type { Actor } from '../../../models/auth'

/**
 * Who handles the reports of reviews: the administrators alone. They keep
 * the reviews of every salon to the rules of the platform, and remove a
 * review that breaks them; a salon is a party to the reviews of its
 * salon, and reports them like a customer does.
 */
export const mayHandleReviewReports = (actor: Actor): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon' },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()
