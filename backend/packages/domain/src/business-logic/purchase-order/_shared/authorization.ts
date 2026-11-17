import type { Actor } from '../../../models/auth'
import type { LedgerReach } from '../../../models/booking'
import type { StaffId } from '../../../models/staff'
import {
  inventoryKeeperReachOf,
  inventoryReachOf,
  performerOf,
} from '../../inventory/_shared/authorization'

/**
 * The purchase orders of a salon are what it orders of the products it
 * keeps in stock, and are reached as its stock is: by the platform's
 * administrators for every salon, and by the members of a salon for their
 * salon. Customers reach none.
 */

/**
 * The orders an actor reads, drafts and moves on step by step (`refusalOfUpdate`);
 * null for an actor who reaches none. Every member of a salon orders
 * what runs short and records what the supplier does with an order.
 */
export const purchaseOrderReachOf = (actor: Actor): LedgerReach | null =>
  inventoryReachOf(actor)

/**
 * The orders an actor approves and cancels; null for an actor who does
 * neither. An approval decides that the money is spent, and is the
 * keepers' of the stock, the owner's and the managers' within a salon; so
 * is calling an order off.
 */
export const purchaseOrderApproverReachOf = (
  actor: Actor,
): LedgerReach | null => inventoryKeeperReachOf(actor)

/**
 * The staff member who creates or approves an order: the member of the
 * salon the actor is. An administrator of the platform is no member of a
 * salon.
 */
export const actingStaffOf = (actor: Actor): StaffId | null =>
  performerOf(actor)
