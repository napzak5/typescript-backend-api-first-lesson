import { match } from 'ts-pattern'
import type { DbAttachment } from '../../../models/attachment'
import type { Actor } from '../../../models/auth'
import type { LedgerReach } from '../../../models/booking'
import {
  bookingReachOf,
  bookingRemovalReachOf,
} from '../../booking/_shared/authorization'

/**
 * An attachment is the salon's: a photo of a treatment, a document it
 * keeps. It is reached as the booking ledger is, by the platform's
 * administrators for every salon and by the members of a salon for their
 * salon. A file that belongs to no salon is the platform's, and only its
 * administrators reach it. A customer reaches none.
 */

/**
 * The attachments an actor uploads, reads and downloads; null for an actor
 * who reaches none.
 */
export const attachmentReachOf = (actor: Actor): LedgerReach | null =>
  bookingReachOf(actor)

/**
 * Whether the files of a salon are within a reach, or, for null, those of
 * no salon.
 */
export const reachesFilesOf = (
  reach: LedgerReach,
  salonId: DbAttachment['salonId'],
): boolean =>
  match(reach)
    .with({ type: 'everySalon' }, () => true)
    .with({ type: 'salon' }, (own) => own.salonId === salonId)
    .exhaustive()

/**
 * Whether an actor removes an attachment they reach: those who remove
 * bookings do, the platform's administrators and the owner and the
 * managers of the salon, and so does whoever uploaded it, who takes back
 * their own upload.
 */
export const mayRemoveAttachment = (
  actor: Actor,
  attachment: DbAttachment,
): boolean => {
  const removal = bookingRemovalReachOf(actor)

  return (
    attachment.uploadedBy === actor.userId ||
    (removal !== null && reachesFilesOf(removal, attachment.salonId))
  )
}

/**
 * Only administrators purge: it is run for the whole platform, as the
 * expiry of points and the erasure of customers are.
 */
export const mayPurgeAttachments = (actor: Actor): boolean =>
  match(actor.scope)
    .with({ type: 'platform' }, () => true)
    .with(
      { type: 'salon' },
      { type: 'customer' },
      { type: 'none' },
      () => false,
    )
    .exhaustive()
