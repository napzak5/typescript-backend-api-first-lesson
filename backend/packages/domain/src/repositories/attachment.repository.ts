import type { Result } from '@beauty-salon-backend/utility'
import type {
  AttachmentId,
  DbAttachment,
  DbNewAttachment,
} from '../models/attachment'
import type { LedgerReach } from '../models/booking'
import type { SalonId } from '../models/salon'
import type { DomainError } from '../shared'

/** Which attachments a list returns. A null filter does not restrict the list. */
export type AttachmentListCriteria = {
  reach: LedgerReach
  limit: number
  /** Return the attachments that follow this one; null starts from the first. */
  after: AttachmentId | null
  salonId: SalonId | null
}

export type AttachmentList = {
  attachments: DbAttachment[]
  /** Number of attachments that match the filters, across all pages. */
  total: number
  hasMore: boolean
}

/** What became of an attachment that was to be purged. */
export type AttachmentPurge =
  | { type: 'purged' }
  /** It is no longer to be purged: its upload was completed, or it is gone. */
  | { type: 'kept' }

/**
 * Persistence of the attachments: what is known of a file, not the file.
 * An attachment that was deleted is one that does not exist, to every
 * method but the two of the purge; its row stays until the purge removes
 * it, because the URL that took its upload may still work.
 *
 * `findById` and `list` are given the reach of the reader: an attachment
 * outside it is one that does not exist. The files of no salon are within
 * the reach of every salon only.
 */
export interface IAttachmentRepository {
  /**
   * Writes a pending attachment whose upload URL runs out the minutes
   * given after it is written.
   */
  create(
    attachment: DbNewAttachment,
    uploadMinutes: number,
  ): Promise<Result<DbAttachment, DomainError>>

  findById(
    reach: LedgerReach,
    id: AttachmentId,
  ): Promise<Result<DbAttachment | null, DomainError>>

  /**
   * The uploaded attachments, the one uploaded last first, and of two
   * uploaded at the same moment the one with the greater ID. Resolves to
   * null when the cursor (`after`) names no attachment the list holds.
   */
  list(
    criteria: AttachmentListCriteria,
  ): Promise<Result<AttachmentList | null, DomainError>>

  /**
   * Marks a pending attachment uploaded, with the time. Resolves to the
   * attachment as it is then, also when it was uploaded already, and to
   * null when it is gone.
   */
  markUploaded(
    id: AttachmentId,
  ): Promise<Result<DbAttachment | null, DomainError>>

  /**
   * Marks the attachment deleted, with the time. Resolves to false when it
   * is gone already.
   */
  markDeleted(id: AttachmentId): Promise<Result<boolean, DomainError>>

  /**
   * The IDs of the attachments to purge, in their order: those deleted
   * whose upload URL has run out, and those still pending the hours given
   * after theirs did. No attachment is named by a request of a user, so
   * the IDs are those the database gave.
   */
  purgeable(
    pendingKeptHours: number,
  ): Promise<Result<DbAttachment['id'][], DomainError>>

  /**
   * Removes the row of an attachment that is still to be purged, after its
   * file: the row is held while `removeFile` runs, so that no upload is
   * completed meanwhile, and stays when `removeFile` fails.
   */
  purge(
    id: DbAttachment['id'],
    pendingKeptHours: number,
    removeFile: (
      attachment: DbAttachment,
    ) => Promise<Result<null, DomainError>>,
  ): Promise<Result<AttachmentPurge, DomainError>>
}
