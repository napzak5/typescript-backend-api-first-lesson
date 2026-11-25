import { attachments, shareLinks } from '@beauty-salon-backend/database'
import type {
  DbNewShareLink,
  DbShareLink,
  DomainError,
  IShareLinkRepository,
  LedgerReach,
  SharedAttachment,
  ShareLinkId,
  ShareLinkList,
  ShareLinkListCriteria,
  ShareLinkLockRule,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  count,
  desc,
  eq,
  exists,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import { totalOf } from '../database/count'
import type { Database } from '../database/index'
import { rowWritten } from '../database/written'

/**
 * The attachment of a link, when it is one that exists: a link goes with
 * its attachment, and the link of a deleted one is no link.
 */
const ITS_ATTACHMENT = and(
  eq(attachments.id, shareLinks.attachmentId),
  isNull(attachments.deletedAt),
)

/**
 * The condition that keeps a query to the links of the attachments a
 * manager reaches. A file of no salon is within the reach of every salon
 * only.
 */
const within = (reach: LedgerReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(attachments.salonId, salonId))
    .exhaustive()

/**
 * A link that has not run out at the moment given and may issue another
 * download.
 */
const works = (now: Date) =>
  and(
    sql`${shareLinks.expiresAt} > ${now.toISOString()}::timestamptz`,
    or(
      isNull(shareLinks.maxDownloads),
      lt(shareLinks.downloadCount, shareLinks.maxDownloads),
    ),
  )

export class ShareLinkRepository implements IShareLinkRepository {
  constructor(private readonly db: Database) {}

  async create(
    shareLink: DbNewShareLink,
  ): Promise<Result<DbShareLink, DomainError>> {
    const created = await attempt('Failed to create share link', () =>
      this.db.insert(shareLinks).values(shareLink).returning(),
    )

    return Result.flatMap(created, rowWritten('Insert of share link'))
  }

  async findById(
    reach: LedgerReach,
    id: ShareLinkId,
  ): Promise<Result<DbShareLink | null, DomainError>> {
    return attempt('Failed to find share link', async () => {
      const [found] = await this.db
        .select({ shareLink: shareLinks })
        .from(shareLinks)
        .innerJoin(attachments, ITS_ATTACHMENT)
        .where(and(eq(shareLinks.id, id), within(reach)))
        .limit(1)

      return found?.shareLink ?? null
    })
  }

  async list({
    attachmentId,
    limit,
    after,
  }: ShareLinkListCriteria): Promise<
    Result<ShareLinkList | null, DomainError>
  > {
    const ofAttachment = eq(shareLinks.attachmentId, attachmentId)

    return attempt('Failed to list share links', async () => {
      // Keyset pagination on (createdAt, id), downwards: the page starts
      // after the link the cursor names, which has to be one of the
      // attachment.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ createdAt: shareLinks.createdAt })
              .from(shareLinks)
              .where(and(eq(shareLinks.id, after), ofAttachment))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        after === null || cursor === undefined
          ? undefined
          : sql`(${shareLinks.createdAt}, ${shareLinks.id}) < (${cursor.createdAt}::timestamptz, ${after}::uuid)`

      const [found, counted] = await Promise.all([
        this.db
          .select()
          .from(shareLinks)
          .where(and(ofAttachment, afterCursor))
          .orderBy(desc(shareLinks.createdAt), desc(shareLinks.id))
          // One extra link tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(shareLinks).where(ofAttachment),
      ])

      return {
        shareLinks: found.slice(0, limit),
        total: totalOf(counted),
        hasMore: found.length > limit,
      }
    })
  }

  async remove(
    reach: LedgerReach,
    id: ShareLinkId,
  ): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to delete share link', async () => {
      const removed = await this.db
        .delete(shareLinks)
        .where(
          and(
            eq(shareLinks.id, id),
            exists(
              this.db
                .select({ id: attachments.id })
                .from(attachments)
                .where(and(ITS_ATTACHMENT, within(reach))),
            ),
          ),
        )
        .returning({ id: shareLinks.id })

      return removed.length > 0
    })
  }

  async findWorking(
    tokenHash: string,
    now: Date,
  ): Promise<Result<SharedAttachment | null, DomainError>> {
    return attempt('Failed to find shared file', async () => {
      const [found] = await this.db
        .select({ shareLink: shareLinks, attachment: attachments })
        .from(shareLinks)
        .innerJoin(attachments, ITS_ATTACHMENT)
        .where(
          and(
            eq(shareLinks.tokenHash, tokenHash),
            works(now),
            eq(attachments.status, 'uploaded'),
          ),
        )
        .limit(1)

      return found ?? null
    })
  }

  async recordWrongPassword(
    id: DbShareLink['id'],
    { threshold, lockedUntil }: ShareLinkLockRule,
  ): Promise<Result<null, DomainError>> {
    // The count this password brings the link to, read and written by one
    // statement.
    const reachesThreshold = sql`${shareLinks.failedAttempts} + 1 >= ${threshold}`

    return attempt(
      'Failed to record wrong password of share link',
      async () => {
        await this.db
          .update(shareLinks)
          .set({
            failedAttempts: sql`${shareLinks.failedAttempts} + 1`,
            lockedUntil: sql`case when ${reachesThreshold} then ${lockedUntil}::timestamptz else ${shareLinks.lockedUntil} end`,
            updatedAt: CLOCK,
          })
          .where(eq(shareLinks.id, id))

        return null
      },
    )
  }

  async recordRightPassword(
    id: DbShareLink['id'],
  ): Promise<Result<null, DomainError>> {
    return attempt(
      'Failed to record right password of share link',
      async () => {
        await this.db
          .update(shareLinks)
          .set({ failedAttempts: 0, lockedUntil: null, updatedAt: CLOCK })
          .where(eq(shareLinks.id, id))

        return null
      },
    )
  }

  async countDownload(
    id: DbShareLink['id'],
    now: Date,
  ): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to count download of share link', async () => {
      // A statement that waited for another count looks at the row as
      // that one left it, so the limit holds for requests at the same
      // moment.
      const counted = await this.db
        .update(shareLinks)
        .set({
          downloadCount: sql`${shareLinks.downloadCount} + 1`,
          updatedAt: CLOCK,
        })
        .where(
          and(
            eq(shareLinks.id, id),
            works(now),
            exists(
              this.db
                .select({ id: attachments.id })
                .from(attachments)
                .where(and(ITS_ATTACHMENT, eq(attachments.status, 'uploaded'))),
            ),
          ),
        )
        .returning({ id: shareLinks.id })

      return counted.length > 0
    })
  }
}
