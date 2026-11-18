import type { Result } from '@beauty-salon-backend/utility'
import type { AttachmentId, DbAttachment } from '../models/attachment'
import type { LedgerReach } from '../models/booking'
import type {
  DbNewShareLink,
  DbShareLink,
  ShareLinkId,
} from '../models/share-link'
import type { DomainError } from '../shared'

/** Which share links of an attachment a list returns. */
export type ShareLinkListCriteria = {
  attachmentId: AttachmentId
  limit: number
  /** Return the links that follow this one; null starts from the first. */
  after: ShareLinkId | null
}

export type ShareLinkList = {
  shareLinks: DbShareLink[]
  /** Number of links of the attachment, across all pages. */
  total: number
  hasMore: boolean
}

/** A link that works, and the attachment it shows. */
export type SharedAttachment = {
  shareLink: DbShareLink
  attachment: DbAttachment
}

/** When a wrong password locks a link. */
export type ShareLinkLockRule = {
  /** The wrong password that reaches this count locks the link. */
  threshold: number
  lockedUntil: string
}

/**
 * Persistence of the share links. A link goes with its attachment: the
 * link of an attachment that was deleted is one that does not exist, and
 * its row is removed with the row of the attachment.
 *
 * `findById` and `remove` are given the reach of whoever manages the
 * links: a link whose attachment is outside it is one that does not
 * exist. The two methods a viewer's request leads to, `findWorking` and
 * `countDownload`, are given the moment the request is answered at.
 */
export interface IShareLinkRepository {
  create(shareLink: DbNewShareLink): Promise<Result<DbShareLink, DomainError>>

  findById(
    reach: LedgerReach,
    id: ShareLinkId,
  ): Promise<Result<DbShareLink | null, DomainError>>

  /**
   * The links of an attachment, the one created last first, and of two
   * created at the same moment the one with the greater ID. Those that
   * have run out or issued every download they may are among them.
   * Resolves to null when the cursor (`after`) names no link of the
   * attachment.
   */
  list(
    criteria: ShareLinkListCriteria,
  ): Promise<Result<ShareLinkList | null, DomainError>>

  /** Removes the row. Resolves to false when the link is gone already. */
  remove(
    reach: LedgerReach,
    id: ShareLinkId,
  ): Promise<Result<boolean, DomainError>>

  /**
   * The link whose token has this hash, when it works at the moment
   * given: it has not run out, it may issue another download, and its
   * attachment is uploaded and not deleted. Null otherwise, whatever the
   * reason.
   */
  findWorking(
    tokenHash: string,
    now: Date,
  ): Promise<Result<SharedAttachment | null, DomainError>>

  /**
   * Counts one wrong password, read and written by one statement, and
   * locks the link when the count reaches the threshold.
   */
  recordWrongPassword(
    id: DbShareLink['id'],
    rule: ShareLinkLockRule,
  ): Promise<Result<null, DomainError>>

  /** Forgets the wrong passwords and the lock that has run out. */
  recordRightPassword(id: DbShareLink['id']): Promise<Result<null, DomainError>>

  /**
   * Counts one download when the link still works at the moment given,
   * in one statement, so that requests at the same moment do not take the
   * count over its limit. Resolves to false when the link works no more.
   */
  countDownload(
    id: DbShareLink['id'],
    now: Date,
  ): Promise<Result<boolean, DomainError>>
}
