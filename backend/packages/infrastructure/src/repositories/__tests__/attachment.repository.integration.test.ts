import { attachments } from '@beauty-salon-backend/database'
import {
  type AttachmentId,
  attachmentIdSchema,
  type DbAttachment,
  type DbNewAttachment,
  DomainErrors,
  type LedgerReach,
  type SalonId,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { eq, sql } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { AttachmentRepository } from '../attachment.repository.impl'
import {
  insertAttachment,
  insertSalon,
  insertUser,
  UPLOADED,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new AttachmentRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const reachOf = (salonId: SalonId): LedgerReach => ({ type: 'salon', salonId })

/** How long a pending file is kept after its upload URL ran out. */
const PENDING_KEPT_HOURS = 24

/** A fixed ID, so that a test decides which of two files comes first. */
const idOf = (place: number): string =>
  `00000000-0000-4000-8000-${String(place).padStart(12, '0')}`

/** The moment the hours given before now, as the database writes it. */
const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

const storedSalon = async (): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database())).id)

const storedUser = async (): Promise<string> =>
  (await insertUser(databases.database(), { role: 'admin' })).id

type FileOverrides = Parameters<typeof insertAttachment>[2]

/** A file of the salon, or of no salon: pending unless the test says otherwise. */
const storedFile = async (
  salonId: SalonId | null,
  overrides: FileOverrides = {},
) =>
  insertAttachment(databases.database(), await storedUser(), {
    salonId,
    ...overrides,
  })

const fileIdOf = (file: { id: string }): AttachmentId =>
  attachmentIdSchema.parse(file.id)

/** The row of the file in the table, or undefined when there is none. */
const rowOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(attachments)
    .where(eq(attachments.id, id))
  return row
}

/** The columns of a file that was deleted on 9 December 2026. */
const DELETED: FileOverrides = { deletedAt: '2026-12-09T05:00:00Z' }

/** The columns of a file whose upload URL ran out the hours given before now. */
const ranOut = (hours: number): FileOverrides => ({
  createdAt: hoursAgo(hours + 1),
  uploadExpiresAt: hoursAgo(hours),
})

describe('AttachmentRepository', () => {
  describe('create', () => {
    const newFile = async (
      salonId: SalonId | null,
    ): Promise<DbNewAttachment> => ({
      salonId,
      filename: '同意書.pdf',
      contentType: 'application/pdf',
      size: 2048,
      uploadedBy: await storedUser(),
    })

    it.each<[string, () => Promise<SalonId | null>]>([
      ['of a salon', storedSalon],
      ['of no salon', async () => null],
    ])(
      'should write a pending file %s whose upload URL runs out the minutes given after it is written',
      async (_file, salonOf) => {
        // Arrange
        const file = await newFile(await salonOf())

        // Act
        const created = await repository().create(file, 15)

        // Assert
        expect(created.type).toBe('success')
        const id = created.type === 'success' ? created.data.id : UNKNOWN_ID
        expect(created).toEqual({ type: 'success', data: await rowOf(id) })
        expect(await rowOf(id)).toMatchObject({
          ...file,
          status: 'pending',
          uploadedAt: null,
          deletedAt: null,
        })
        const [minutes] = await databases
          .database()
          .select({
            after:
              sql<number>`extract(epoch from ${attachments.uploadExpiresAt} - ${attachments.createdAt}) / 60`.mapWith(
                Number,
              ),
          })
          .from(attachments)
          .where(eq(attachments.id, id))
        expect(minutes).toEqual({ after: 15 })
      },
    )

    it('should write no file larger than a file may be', async () => {
      // Arrange
      const file = { ...(await newFile(null)), size: 10485761 }

      // Act
      const created = await repository().create(file, 15)

      // Assert
      expect(created).toMatchObject({
        type: 'error',
        error: { type: 'database', message: 'Failed to create attachment' },
      })
    })

    it('should answer that the insert returned no row when a trigger skips it', async () => {
      // Arrange
      const file = await newFile(null)
      await databases.skipWrites('attachments', 'INSERT')

      // Act
      const created = await repository().create(file, 15)

      // Assert
      expect(created).toEqual({
        type: 'error',
        error: {
          type: 'database',
          message: 'Insert of attachment returned no row',
          cause: null,
        },
      })
    })
  })

  describe('findById', () => {
    it.each<[string, FileOverrides, (salonId: SalonId) => LedgerReach]>([
      ['uploaded, for a reader of its salon', UPLOADED, reachOf],
      ['pending, for a reader of its salon', {}, reachOf],
      ['uploaded, for a reader of every salon', UPLOADED, () => EVERY_SALON],
    ])('should find a file %s', async (_case, overrides, reach) => {
      // Arrange
      const salonId = await storedSalon()
      const file = await storedFile(salonId, overrides)

      // Act
      const found = await repository().findById(reach(salonId), fileIdOf(file))

      // Assert
      expect(found).toEqual({ type: 'success', data: file })
    })

    it('should find a file of no salon for a reader of every salon only', async () => {
      // Arrange
      const file = await storedFile(null, UPLOADED)

      // Act
      const ofEverySalon = await repository().findById(
        EVERY_SALON,
        fileIdOf(file),
      )
      const ofASalon = await repository().findById(
        reachOf(await storedSalon()),
        fileIdOf(file),
      )

      // Assert
      expect(ofEverySalon).toEqual({ type: 'success', data: file })
      expect(ofASalon).toEqual({ type: 'success', data: null })
    })

    it.each<[string, () => Promise<{ reach: LedgerReach; id: string }>]>([
      [
        'of another salon',
        async () => ({
          reach: reachOf(await storedSalon()),
          id: (await storedFile(await storedSalon(), UPLOADED)).id,
        }),
      ],
      [
        'that was deleted',
        async () => ({
          reach: EVERY_SALON,
          id: (await storedFile(null, { ...UPLOADED, ...DELETED })).id,
        }),
      ],
      [
        'of an ID that names none',
        async () => ({ reach: EVERY_SALON, id: UNKNOWN_ID }),
      ],
    ])('should find no file %s', async (_case, arrange) => {
      // Arrange
      const { reach, id } = await arrange()

      // Act
      const found = await repository().findById(
        reach,
        attachmentIdSchema.parse(id),
      )

      // Assert
      expect(found).toEqual({ type: 'success', data: null })
    })
  })

  describe('list', () => {
    /**
     * Two salons and the files of no salon. The salon has three uploaded
     * files: one uploaded on 1 December, and two uploaded a day later at
     * one moment, of which the one with the greater ID comes first; and a
     * pending file and a deleted one, which no list holds. The other
     * salon and no salon have an uploaded file each.
     */
    const storedFiles = async () => {
      const salonId = await storedSalon()
      const otherSalon = await storedSalon()
      const first = await storedFile(salonId, { id: idOf(4), ...UPLOADED })
      const later: FileOverrides = {
        status: 'uploaded',
        uploadedAt: '2026-12-02T03:00:00Z',
      }
      const sameLesser = await storedFile(salonId, { id: idOf(1), ...later })
      const sameGreater = await storedFile(salonId, { id: idOf(2), ...later })
      const pending = await storedFile(salonId, { id: idOf(5) })
      const deleted = await storedFile(salonId, {
        id: idOf(6),
        status: 'uploaded',
        uploadedAt: '2026-12-03T03:00:00Z',
        ...DELETED,
      })
      const ofOtherSalon = await storedFile(otherSalon, {
        id: idOf(3),
        status: 'uploaded',
        uploadedAt: '2026-12-04T03:00:00Z',
      })
      const ofNoSalon = await storedFile(null, {
        id: idOf(7),
        status: 'uploaded',
        uploadedAt: '2026-12-05T03:00:00Z',
      })
      return {
        salonId,
        otherSalon,
        first,
        sameLesser,
        sameGreater,
        pending,
        deleted,
        ofOtherSalon,
        ofNoSalon,
      }
    }

    it('should list the uploaded files the reader reaches, the latest upload first and then the greatest ID', async () => {
      // Arrange
      const files = await storedFiles()

      // Act
      const ofTheSalon = await repository().list({
        reach: reachOf(files.salonId),
        limit: 20,
        after: null,
        salonId: null,
      })
      const ofEverySalon = await repository().list({
        reach: EVERY_SALON,
        limit: 20,
        after: null,
        salonId: null,
      })

      // Assert
      expect(ofTheSalon).toEqual({
        type: 'success',
        data: {
          attachments: [files.sameGreater, files.sameLesser, files.first],
          total: 3,
          hasMore: false,
        },
      })
      expect(ofEverySalon).toEqual({
        type: 'success',
        data: {
          attachments: [
            files.ofNoSalon,
            files.ofOtherSalon,
            files.sameGreater,
            files.sameLesser,
            files.first,
          ],
          total: 5,
          hasMore: false,
        },
      })
    })

    it.each<[string, (salonId: SalonId, otherSalon: SalonId) => LedgerReach]>([
      ['every salon', () => EVERY_SALON],
      ['another salon', (_salonId, otherSalon) => reachOf(otherSalon)],
    ])(
      'should list the files of the salon named, for a reader of %s, and count them',
      async (_reach, reach) => {
        // Arrange
        const files = await storedFiles()

        // Act
        const listed = await repository().list({
          reach: reach(files.salonId, files.otherSalon),
          limit: 2,
          after: null,
          salonId: files.otherSalon,
        })

        // Assert
        expect(listed).toEqual({
          type: 'success',
          data: { attachments: [files.ofOtherSalon], total: 1, hasMore: false },
        })
      },
    )

    it('should list no file of the salon named for a reader of another salon', async () => {
      // Arrange
      const files = await storedFiles()

      // Act
      const listed = await repository().list({
        reach: reachOf(files.salonId),
        limit: 20,
        after: null,
        salonId: files.otherSalon,
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: { attachments: [], total: 0, hasMore: false },
      })
    })

    it('should list a page at a time, from the file after the cursor', async () => {
      // Arrange
      const files = await storedFiles()
      const reach = reachOf(files.salonId)

      // Act
      const firstPage = await repository().list({
        reach,
        limit: 1,
        after: null,
        salonId: null,
      })
      const secondPage = await repository().list({
        reach,
        limit: 1,
        after: fileIdOf(files.sameGreater),
        salonId: null,
      })
      const lastPage = await repository().list({
        reach,
        limit: 1,
        after: fileIdOf(files.sameLesser),
        salonId: null,
      })

      // Assert
      expect(firstPage).toEqual({
        type: 'success',
        data: { attachments: [files.sameGreater], total: 3, hasMore: true },
      })
      expect(secondPage).toEqual({
        type: 'success',
        data: { attachments: [files.sameLesser], total: 3, hasMore: true },
      })
      expect(lastPage).toEqual({
        type: 'success',
        data: { attachments: [files.first], total: 3, hasMore: false },
      })
    })

    it.each<
      [string, (files: Awaited<ReturnType<typeof storedFiles>>) => string]
    >([
      ['a pending file', (files) => files.pending.id],
      ['a deleted file', (files) => files.deleted.id],
      [
        'a file of a salon the reader does not reach',
        (files) => files.ofOtherSalon.id,
      ],
      ['an ID that names no file', () => UNKNOWN_ID],
    ])('should list no page after %s', async (_cursor, cursorOf) => {
      // Arrange
      const files = await storedFiles()

      // Act
      const listed = await repository().list({
        reach: reachOf(files.salonId),
        limit: 20,
        after: attachmentIdSchema.parse(cursorOf(files)),
        salonId: null,
      })

      // Assert
      expect(listed).toEqual({ type: 'success', data: null })
    })
  })

  describe('markUploaded', () => {
    it('should mark the pending file uploaded, with the time, and answer with it', async () => {
      // Arrange
      const file = await storedFile(null, { updatedAt: '2026-12-01T00:00:00Z' })
      const other = await storedFile(null)

      // Act
      const marked = await repository().markUploaded(fileIdOf(file))

      // Assert
      const row = await rowOf(file.id)
      expect(marked).toEqual({ type: 'success', data: row })
      expect(row).toMatchObject({ status: 'uploaded' })
      expect(row?.uploadedAt).not.toBeNull()
      expect(row?.updatedAt).not.toBe(file.updatedAt)
      expect(await rowOf(other.id)).toEqual(other)
    })

    it('should answer with the file as it is, when its upload was completed already', async () => {
      // Arrange
      const file = await storedFile(null, UPLOADED)

      // Act
      const marked = await repository().markUploaded(fileIdOf(file))

      // Assert
      expect(marked).toEqual({ type: 'success', data: file })
      expect(await rowOf(file.id)).toEqual(file)
    })

    it('should answer with the upload a request completed while this one waited for the file', async () => {
      // Arrange
      const file = await storedFile(null)

      // Act
      const marked = await databases.whileHeld(
        (held) =>
          held`select id from attachments where id = ${file.id} for update`,
        (held) =>
          held`update attachments set status = 'uploaded', "uploadedAt" = '2026-12-01T03:00:00Z' where id = ${file.id}`,
        () => repository().markUploaded(fileIdOf(file)),
      )

      // Assert
      expect(marked).toEqual({ type: 'success', data: await rowOf(file.id) })
      expect(await rowOf(file.id)).toMatchObject({
        uploadedAt: '2026-12-01 03:00:00+00',
        updatedAt: file.updatedAt,
      })
    })

    it.each<[string, () => Promise<string>]>([
      ['that was deleted', async () => (await storedFile(null, DELETED)).id],
      ['of an ID that names none', async () => UNKNOWN_ID],
    ])('should answer with no file %s', async (_case, idOfFile) => {
      // Arrange
      const id = await idOfFile()
      const before = await rowOf(id)

      // Act
      const marked = await repository().markUploaded(
        attachmentIdSchema.parse(id),
      )

      // Assert
      expect(marked).toEqual({ type: 'success', data: null })
      expect(await rowOf(id)).toEqual(before)
    })
  })

  describe('markDeleted', () => {
    it('should mark the file deleted, with the time, and leave the others', async () => {
      // Arrange
      const file = await storedFile(null, {
        ...UPLOADED,
        updatedAt: '2026-12-01T00:00:00Z',
      })
      const other = await storedFile(null, UPLOADED)

      // Act
      const deleted = await repository().markDeleted(fileIdOf(file))

      // Assert
      expect(deleted).toEqual({ type: 'success', data: true })
      const row = await rowOf(file.id)
      expect(row?.deletedAt).not.toBeNull()
      expect(row?.updatedAt).not.toBe(file.updatedAt)
      expect(await rowOf(other.id)).toEqual(other)
    })

    it.each<[string, () => Promise<string>]>([
      [
        'that was deleted already',
        async () => (await storedFile(null, DELETED)).id,
      ],
      ['of an ID that names none', async () => UNKNOWN_ID],
    ])('should mark no file %s', async (_case, idOfFile) => {
      // Arrange
      const id = await idOfFile()
      const before = await rowOf(id)

      // Act
      const deleted = await repository().markDeleted(
        attachmentIdSchema.parse(id),
      )

      // Assert
      expect(deleted).toEqual({ type: 'success', data: false })
      expect(await rowOf(id)).toEqual(before)
    })
  })

  describe('purgeable', () => {
    it('should name the deleted files whose upload URL ran out, and the files pending longer than the hours given after theirs did, in the order of their IDs', async () => {
      // Arrange
      const deletedRanOut = await storedFile(null, {
        id: idOf(3),
        ...DELETED,
        ...ranOut(1),
      })
      const pendingLong = await storedFile(null, {
        id: idOf(1),
        ...ranOut(PENDING_KEPT_HOURS + 1),
      })
      const deletedPending = await storedFile(null, {
        id: idOf(2),
        ...DELETED,
        ...ranOut(PENDING_KEPT_HOURS + 1),
      })
      // Deleted, and its upload URL still works.
      await storedFile(null, { id: idOf(4), ...DELETED })
      // Pending, its upload URL ran out within the hours given.
      await storedFile(null, { id: idOf(5), ...ranOut(PENDING_KEPT_HOURS - 1) })
      // Uploaded long ago, and not deleted.
      await storedFile(null, {
        id: idOf(6),
        ...UPLOADED,
        ...ranOut(PENDING_KEPT_HOURS + 1),
      })

      // Act
      const purgeable = await repository().purgeable(PENDING_KEPT_HOURS)

      // Assert
      expect(purgeable).toEqual({
        type: 'success',
        data: [pendingLong.id, deletedPending.id, deletedRanOut.id],
      })
    })
  })

  describe('purge', () => {
    /** A file of no salon that was deleted, and whose upload URL ran out. */
    const storedPurgeable = () =>
      storedFile(null, { ...UPLOADED, ...DELETED, ...ranOut(1) })

    it('should remove the file and then the row of a file still to be purged', async () => {
      // Arrange
      const file = await storedPurgeable()
      const other = await storedPurgeable()
      const removeFile = vi.fn(async (_held: DbAttachment) =>
        Result.success(null),
      )

      // Act
      const purged = await repository().purge(
        file.id,
        PENDING_KEPT_HOURS,
        removeFile,
      )

      // Assert
      expect(purged).toEqual({ type: 'success', data: { type: 'purged' } })
      expect(removeFile).toHaveBeenCalledExactlyOnceWith(file)
      expect(await rowOf(file.id)).toBeUndefined()
      expect(await rowOf(other.id)).toEqual(other)
    })

    it.each<[string, () => Promise<string>]>([
      [
        'that is not deleted',
        async () => (await storedFile(null, { ...UPLOADED, ...ranOut(1) })).id,
      ],
      [
        'whose upload URL still works',
        async () => (await storedFile(null, { ...UPLOADED, ...DELETED })).id,
      ],
      ['that is gone', async () => UNKNOWN_ID],
    ])('should keep a file %s, and remove nothing', async (_case, idOfFile) => {
      // Arrange
      const id = await idOfFile()
      const before = await rowOf(id)
      const removeFile = vi.fn(async (_held: DbAttachment) =>
        Result.success(null),
      )

      // Act
      const purged = await repository().purge(
        id,
        PENDING_KEPT_HOURS,
        removeFile,
      )

      // Assert
      expect(purged).toEqual({ type: 'success', data: { type: 'kept' } })
      expect(removeFile).not.toHaveBeenCalled()
      expect(await rowOf(id)).toEqual(before)
    })

    it('should keep the row of a file whose removal failed, for the next run', async () => {
      // Arrange
      const file = await storedPurgeable()
      const failure = DomainErrors.storage('Failed to remove file', null)

      // Act
      const purged = await repository().purge(
        file.id,
        PENDING_KEPT_HOURS,
        async () => Result.error(failure),
      )

      // Assert
      expect(purged).toEqual({ type: 'error', error: failure })
      expect(await rowOf(file.id)).toEqual(file)
    })

    it('should keep a pending file whose upload was completed while the purge waited for it', async () => {
      // Arrange
      const file = await storedFile(null, ranOut(PENDING_KEPT_HOURS + 1))
      const removeFile = vi.fn(async (_held: DbAttachment) =>
        Result.success(null),
      )

      // Act
      const purged = await databases.whileHeld(
        (held) =>
          held`select id from attachments where id = ${file.id} for update`,
        (held) =>
          held`update attachments set status = 'uploaded', "uploadedAt" = '2026-12-01T03:00:00Z' where id = ${file.id}`,
        () => repository().purge(file.id, PENDING_KEPT_HOURS, removeFile),
      )

      // Assert
      expect(purged).toEqual({ type: 'success', data: { type: 'kept' } })
      expect(removeFile).not.toHaveBeenCalled()
      expect(await rowOf(file.id)).toMatchObject({ status: 'uploaded' })
    })

    it('should answer that the delete returned no row when a trigger skips it', async () => {
      // Arrange
      const file = await storedPurgeable()
      await databases.skipWrites('attachments', 'DELETE')

      // Act
      const purged = await repository().purge(
        file.id,
        PENDING_KEPT_HOURS,
        async () => Result.success(null),
      )

      // Assert
      expect(purged).toEqual({
        type: 'error',
        error: {
          type: 'database',
          message: 'Delete of purged attachment returned no row',
          cause: null,
        },
      })
    })
  })
})

describe('AttachmentRepository when the database is gone', () => {
  const id = attachmentIdSchema.parse(UNKNOWN_ID)

  it.each<[string, string, (gone: AttachmentRepository) => Promise<unknown>]>([
    [
      'a creation',
      'Failed to create attachment',
      (gone) =>
        gone.create(
          {
            salonId: null,
            filename: '同意書.pdf',
            contentType: 'application/pdf',
            size: 2048,
            uploadedBy: UNKNOWN_ID,
          },
          15,
        ),
    ],
    [
      'a file',
      'Failed to find attachment',
      (gone) => gone.findById(EVERY_SALON, id),
    ],
    [
      'the files',
      'Failed to list attachments',
      (gone) =>
        gone.list({
          reach: EVERY_SALON,
          limit: 20,
          after: null,
          salonId: null,
        }),
    ],
    [
      'an upload',
      'Failed to complete attachment',
      (gone) => gone.markUploaded(id),
    ],
    [
      'a deletion',
      'Failed to delete attachment',
      (gone) => gone.markDeleted(id),
    ],
    [
      'the files to purge',
      'Failed to find the attachments to purge',
      (gone) => gone.purgeable(PENDING_KEPT_HOURS),
    ],
    [
      'a purge',
      'Failed to purge attachment',
      (gone) =>
        gone.purge(id, PENDING_KEPT_HOURS, async () => Result.success(null)),
    ],
  ])('should answer for %s: %s', async (_subject, message, call) => {
    // Arrange
    const gone = new AttachmentRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
