import { attachments } from '@beauty-salon-backend/database'
import {
  type AttachmentId,
  type AttachmentList,
  type AttachmentListCriteria,
  type AttachmentPurge,
  type DbAttachment,
  type DbNewAttachment,
  type DomainError,
  DomainErrors,
  type IAttachmentRepository,
  type LedgerReach,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import {
  and,
  asc,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database } from '../database/index'

/**
 * The purge reads what is committed at each statement, so that it sees an
 * upload that was completed while it waited for the row.
 */
const WRITE: PgTransactionConfig = { isolationLevel: 'read committed' }

/**
 * The condition that keeps a query to the attachments a reader reaches.
 * A file of no salon is within the reach of every salon only.
 */
const within = (reach: LedgerReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(attachments.salonId, salonId))
    .exhaustive()

/** An attachment that is not deleted. */
const kept = (id: string) =>
  and(eq(attachments.id, id), isNull(attachments.deletedAt))

/** The attachments a list holds: uploaded and not deleted. */
const LISTED = and(
  eq(attachments.status, 'uploaded'),
  isNull(attachments.deletedAt),
)

/**
 * What is to be purged at the moment a statement gets to the row: a
 * deleted attachment whose upload URL has run out, and one that is still
 * pending the hours given after its URL did.
 */
const toPurge = (pendingKeptHours: number) =>
  or(
    and(
      isNotNull(attachments.deletedAt),
      sql`${attachments.uploadExpiresAt} <= ${CLOCK}`,
    ),
    and(
      isNull(attachments.deletedAt),
      eq(attachments.status, 'pending'),
      sql`${attachments.uploadExpiresAt} + make_interval(hours => ${pendingKeptHours}) <= ${CLOCK}`,
    ),
  )

export class AttachmentRepository implements IAttachmentRepository {
  constructor(private readonly db: Database) {}

  async create(
    attachment: DbNewAttachment,
    uploadMinutes: number,
  ): Promise<Result<DbAttachment, DomainError>> {
    const created = await attempt('Failed to create attachment', () =>
      this.db
        .insert(attachments)
        .values({
          ...attachment,
          // The moment the statement began, which `createdAt` is too.
          uploadExpiresAt: sql`now() + make_interval(mins => ${uploadMinutes})`,
        })
        .returning(),
    )

    return Result.flatMap(created, ([inserted]) =>
      inserted === undefined
        ? Result.error(
            DomainErrors.database('Insert of attachment returned no row', null),
          )
        : Result.success(inserted),
    )
  }

  async findById(
    reach: LedgerReach,
    id: AttachmentId,
  ): Promise<Result<DbAttachment | null, DomainError>> {
    return attempt('Failed to find attachment', async () => {
      const [attachment] = await this.db
        .select()
        .from(attachments)
        .where(and(kept(id), within(reach)))
        .limit(1)

      return attachment ?? null
    })
  }

  async list({
    reach,
    limit,
    after,
    salonId,
  }: AttachmentListCriteria): Promise<
    Result<AttachmentList | null, DomainError>
  > {
    const filters = and(
      LISTED,
      within(reach),
      salonId === null ? undefined : eq(attachments.salonId, salonId),
    )

    return attempt('Failed to list attachments', async () => {
      // Keyset pagination on (uploadedAt, id), downwards: the page starts
      // after the attachment the cursor names, which has to be one the
      // list holds.
      const [cursor] =
        after === null
          ? []
          : await this.db
              .select({ uploadedAt: attachments.uploadedAt })
              .from(attachments)
              .where(and(eq(attachments.id, after), filters))
      if (after !== null && cursor === undefined) {
        return null
      }
      const afterCursor =
        after === null || cursor === undefined
          ? undefined
          : sql`(${attachments.uploadedAt}, ${attachments.id}) < (${cursor.uploadedAt}::timestamptz, ${after}::uuid)`

      const [found, [matching]] = await Promise.all([
        this.db
          .select()
          .from(attachments)
          .where(and(filters, afterCursor))
          .orderBy(desc(attachments.uploadedAt), desc(attachments.id))
          // One extra attachment tells whether another page follows.
          .limit(limit + 1),
        this.db.select({ total: count() }).from(attachments).where(filters),
      ])

      return {
        attachments: found.slice(0, limit),
        total: matching?.total ?? 0,
        hasMore: found.length > limit,
      }
    })
  }

  async markUploaded(
    id: AttachmentId,
  ): Promise<Result<DbAttachment | null, DomainError>> {
    return attempt('Failed to complete attachment', async () => {
      const [marked] = await this.db
        .update(attachments)
        .set({ status: 'uploaded', uploadedAt: CLOCK, updatedAt: CLOCK })
        .where(and(kept(id), eq(attachments.status, 'pending')))
        .returning()
      if (marked !== undefined) {
        return marked
      }
      // Not pending any more: uploaded by a request at the same moment,
      // or gone.
      const [current] = await this.db.select().from(attachments).where(kept(id))

      return current ?? null
    })
  }

  async markDeleted(id: AttachmentId): Promise<Result<boolean, DomainError>> {
    return attempt('Failed to delete attachment', async () => {
      const deleted = await this.db
        .update(attachments)
        .set({ deletedAt: CLOCK, updatedAt: CLOCK })
        .where(kept(id))
        .returning({ id: attachments.id })

      return deleted.length > 0
    })
  }

  async purgeable(
    pendingKeptHours: number,
  ): Promise<Result<DbAttachment['id'][], DomainError>> {
    return attempt('Failed to find the attachments to purge', async () => {
      const found = await this.db
        .select({ id: attachments.id })
        .from(attachments)
        .where(toPurge(pendingKeptHours))
        .orderBy(asc(attachments.id))

      return found.map(({ id }) => id)
    })
  }

  async purge(
    id: DbAttachment['id'],
    pendingKeptHours: number,
    removeFile: (
      attachment: DbAttachment,
    ) => Promise<Result<null, DomainError>>,
  ): Promise<Result<AttachmentPurge, DomainError>> {
    const purged = await attempt('Failed to purge attachment', () =>
      this.db.transaction(
        async (tx): Promise<Result<AttachmentPurge, DomainError>> => {
          // Held while its file is removed: an upload that is being
          // completed waits, and finds the attachment gone.
          const [held] = await tx
            .select()
            .from(attachments)
            .where(and(eq(attachments.id, id), toPurge(pendingKeptHours)))
            .for('update')
          if (held === undefined) {
            return Result.success({ type: 'kept' })
          }
          const removed = await removeFile(held)
          if (removed.type === 'error') {
            // Nothing was written: the row stays for the next run.
            return removed
          }
          await tx.delete(attachments).where(eq(attachments.id, id))

          return Result.success({ type: 'purged' })
        },
        WRITE,
      ),
    )

    return Result.flatMap(purged, (outcome) => outcome)
  }
}
