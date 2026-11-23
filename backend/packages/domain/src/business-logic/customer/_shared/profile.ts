import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { CustomerId } from '../../../models/customer'
import { type DomainError, DomainErrors } from '../../../shared'

/**
 * What an actor has to do with "my profile". Only a customer account has
 * one: the customer record of the account, once the user has created it.
 * Administrators and the members of a salon reach customers through the
 * ledger.
 */
export type ProfileAccess =
  | { type: 'ownProfile'; customerId: CustomerId }
  | { type: 'withoutProfile' }
  | { type: 'notACustomer' }

export const profileAccessOf = (actor: Actor): ProfileAccess =>
  match(actor.scope)
    .returnType<ProfileAccess>()
    .with({ type: 'customer', customerId: P.string }, ({ customerId }) => ({
      type: 'ownProfile',
      customerId,
    }))
    .with({ type: 'customer', customerId: null }, () => ({
      type: 'withoutProfile',
    }))
    .with({ type: 'platform' }, { type: 'salon' }, { type: 'none' }, () => ({
      type: 'notACustomer',
    }))
    .exhaustive()

/**
 * The account has no profile: none was created, or the staff deleted the
 * customer. The two are answered alike.
 */
export const profileNotFound = (actor: Actor): DomainError =>
  DomainErrors.notFound(entityMessages.customerProfileOfUser, actor.userId)
