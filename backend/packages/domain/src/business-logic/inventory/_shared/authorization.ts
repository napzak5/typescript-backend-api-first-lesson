import type { InventoryTransactionType } from '@beauty-salon-backend/generated'
import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { LedgerReach } from '../../../models/booking'
import type { StaffId } from '../../../models/staff'
import { isKeepersMovement } from './movements'

/**
 * The stock of a salon is where its products are and how many of them
 * there are, with their lots and when they expire. Like the products, it is
 * not shown to customers, and it is reached as the ledgers are: by the
 * platform's administrators for every salon, and by the members of a salon
 * for their salon.
 */

/**
 * The stock rows an actor reads; null for an actor who reads none. A staff
 * member takes the products of a treatment from the shelves and sells those
 * at the counter.
 */
export const inventoryReachOf = (actor: Actor): LedgerReach | null =>
  match(actor.scope)
    .returnType<LedgerReach | null>()
    .with({ type: 'platform' }, () => ({ type: 'everySalon' }))
    .with({ type: 'salon' }, ({ salonId }) => ({ type: 'salon', salonId }))
    .with({ type: 'customer' }, { type: 'none' }, () => null)
    .exhaustive()

/**
 * The stock rows an actor keeps (adds, changes and deletes); null for an
 * actor who keeps none. Within a salon they are the owner's and the
 * managers', who keep its products as well.
 */
export const inventoryKeeperReachOf = (actor: Actor): LedgerReach | null =>
  match(actor.scope)
    .returnType<LedgerReach | null>()
    .with({ type: 'platform' }, () => ({ type: 'everySalon' }))
    .with(
      { type: 'salon', role: P.union('owner', 'manager') },
      ({ salonId }) => ({ type: 'salon', salonId }),
    )
    .with(
      { type: 'salon', role: 'staff' },
      { type: 'customer' },
      { type: 'none' },
      () => null,
    )
    .exhaustive()

/**
 * The stock rows an actor records a movement of the kind on; null for an
 * actor who records none of it. Every member of a salon records what moves
 * day to day; the other kinds are the keepers' (`isKeepersMovement`).
 */
export const movementReachOf = (
  actor: Actor,
  transactionType: InventoryTransactionType,
): LedgerReach | null =>
  isKeepersMovement(transactionType)
    ? inventoryKeeperReachOf(actor)
    : inventoryReachOf(actor)

/**
 * The staff member a movement is recorded by: the member of the salon the
 * actor is. An administrator of the platform is no member of a salon.
 */
export const performerOf = (actor: Actor): StaffId | null =>
  match(actor.scope)
    .returnType<StaffId | null>()
    .with({ type: 'salon' }, ({ staffId }) => staffId)
    .with(
      { type: 'platform' },
      { type: 'customer' },
      { type: 'none' },
      () => null,
    )
    .exhaustive()
