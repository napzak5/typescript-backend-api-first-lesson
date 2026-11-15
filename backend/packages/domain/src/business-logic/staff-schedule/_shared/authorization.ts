import { match, P } from 'ts-pattern'
import type { Actor } from '../../../models/auth'
import type { SalonId } from '../../../models/salon'
import type { StaffId } from '../../../models/staff'

/**
 * The schedules of a salon's staff say who works when. They hold neither
 * pay nor contact details, and changing them changes nobody's account, so
 * they are not kept as closely as the staff ledger: the managers of the
 * salon plan the shifts, as its owner and the platform's administrators
 * may.
 */
export const mayPlanSchedules = (actor: Actor, salonId: SalonId): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon', role: P.union('owner', 'manager') },
      (scope) => scope.salonId === salonId,
    )
    .with(
      { type: 'salon', role: 'staff' },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()

/**
 * Whether the actor may read schedules of the salon at all: those who plan
 * them, and the staff of the salon. Which schedules a staff member reads
 * is `mayReadScheduleOf`'s to say.
 */
export const mayReadSchedules = (actor: Actor, salonId: SalonId): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with({ type: 'salon' }, (scope) => scope.salonId === salonId)
    .with({ type: 'customer' }, { type: 'none' }, () => false)
    .exhaustive()

/**
 * Whether an actor who may read schedules of the salon may read the one of
 * this staff member. A staff member reads their own: the notes of a
 * schedule say why somebody is away, which is between them and those who
 * plan the shifts.
 */
export const mayReadScheduleOf = (actor: Actor, staffId: StaffId): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with({ type: 'salon', role: P.union('owner', 'manager') }, () => true)
    .with(
      { type: 'salon', role: 'staff' },
      (scope) => scope.staffId === staffId,
    )
    .with({ type: 'customer' }, { type: 'none' }, () => false)
    .exhaustive()
