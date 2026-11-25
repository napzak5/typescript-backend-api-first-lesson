import { attachments, shareLinks } from '@beauty-salon-backend/database'
import {
  type AttachmentId,
  attachmentIdSchema,
  type DbNewShareLink,
  type LedgerReach,
  type SalonId,
  salonIdSchema,
  shareLinkIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { ShareLinkRepository } from '../share-link.repository.impl'
import {
  insertAttachment,
  insertSalon,
  insertShareLink,
  insertUser,
  UPLOADED,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new ShareLinkRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const reachOf = (salonId: SalonId): LedgerReach => ({ type: 'salon', salonId })

/** 2026-12-10 at noon in Tokyo: a link of the builder works until 16 December. */
const NOW = new Date('2026-12-10T03:00:00Z')

/** When a link of the builder was last written, before any repository wrote it. */
const MADE_AT = '2026-12-09T03:00:00Z'

/** A fixed ID, so that a test decides which of two links of one moment comes first. */
const idOf = (place: number): string =>
  `00000000-0000-4000-8000-${String(place).padStart(12, '0')}`

const storedSalon = async (): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database())).id)

const storedUser = async (): Promise<string> =>
  (await insertUser(databases.database(), { role: 'admin' })).id

type FileOverrides = Parameters<typeof insertAttachment>[2]

/** An uploaded file of the salon, or of no salon. */
const storedFile = async (
  salonId: SalonId | null,
  overrides: FileOverrides = {},
): Promise<AttachmentId> =>
  attachmentIdSchema.parse(
    (
      await insertAttachment(databases.database(), await storedUser(), {
        salonId,
        ...UPLOADED,
        ...overrides,
      })
    ).id,
  )

const storedLink = async (
  attachmentId: AttachmentId,
  overrides: Parameters<typeof insertShareLink>[3] = {},
) =>
  insertShareLink(databases.database(), attachmentId, await storedUser(), {
    updatedAt: MADE_AT,
    ...overrides,
  })

const linkIdOf = (link: { id: string }) => shareLinkIdSchema.parse(link.id)

/** The row of the link in the table, or undefined when there is none. */
const rowOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.id, id))
  return row
}

/** A salon with an uploaded file of its own, and the link of it. */
const storedShare = async (overrides: FileOverrides = {}) => {
  const salonId = await storedSalon()
  const attachmentId = await storedFile(salonId, overrides)
  const link = await storedLink(attachmentId)
  return { salonId, attachmentId, link }
}

describe('ShareLinkRepository', () => {
  describe('create', () => {
    const newLink = async (
      attachmentId: AttachmentId,
    ): Promise<DbNewShareLink> => ({
      attachmentId,
      tokenHash: 'hash-of-a-new-token',
      passwordHash: 'hash-of-a-password',
      expiresAt: '2026-12-16T03:00:00.000Z',
      maxDownloads: 3,
      createdBy: await storedUser(),
      createdAt: '2026-12-09T03:00:00.000Z',
      updatedAt: '2026-12-09T03:00:00.000Z',
    })

    it('should write the link as it is given, with no download and no wrong password, and answer with the row', async () => {
      // Arrange
      const attachmentId = await storedFile(await storedSalon())
      const link = await newLink(attachmentId)

      // Act
      const created = await repository().create(link)

      // Assert
      expect(created.type).toBe('success')
      const id = created.type === 'success' ? created.data.id : UNKNOWN_ID
      const row = await rowOf(id)
      expect(created).toEqual({ type: 'success', data: row })
      expect(row).toMatchObject({
        attachmentId,
        tokenHash: 'hash-of-a-new-token',
        passwordHash: 'hash-of-a-password',
        expiresAt: '2026-12-16 03:00:00+00',
        maxDownloads: 3,
        downloadCount: 0,
        failedAttempts: 0,
        lockedUntil: null,
        createdBy: link.createdBy,
        createdAt: '2026-12-09 03:00:00+00',
        updatedAt: '2026-12-09 03:00:00+00',
      })
    })

    it('should write no link of the hash of the token of another', async () => {
      // Arrange
      const attachmentId = await storedFile(await storedSalon())
      await storedLink(attachmentId, { tokenHash: 'hash-of-a-new-token' })

      // Act
      const created = await repository().create(await newLink(attachmentId))

      // Assert
      expect(created).toMatchObject({
        type: 'error',
        error: { type: 'database', message: 'Failed to create share link' },
      })
    })

    it('should answer that the insert returned no row when a trigger skips it', async () => {
      // Arrange
      const attachmentId = await storedFile(await storedSalon())
      await databases.skipWrites('share_links', 'INSERT')

      // Act
      const created = await repository().create(await newLink(attachmentId))

      // Assert
      expect(created).toEqual({
        type: 'error',
        error: {
          type: 'database',
          message: 'Insert of share link returned no row',
          cause: null,
        },
      })
    })
  })

  describe('findById', () => {
    it.each<[string, (salonId: SalonId) => LedgerReach]>([
      ['the salon of its file', reachOf],
      ['every salon', () => EVERY_SALON],
    ])('should find the link for a manager of %s', async (_reach, reach) => {
      // Arrange
      const { salonId, link } = await storedShare()

      // Act
      const found = await repository().findById(reach(salonId), linkIdOf(link))

      // Assert
      expect(found).toEqual({ type: 'success', data: link })
    })

    it('should find the link of a file of no salon for a manager of every salon only', async () => {
      // Arrange
      const link = await storedLink(await storedFile(null))

      // Act
      const ofEverySalon = await repository().findById(
        EVERY_SALON,
        linkIdOf(link),
      )
      const ofASalon = await repository().findById(
        reachOf(await storedSalon()),
        linkIdOf(link),
      )

      // Assert
      expect(ofEverySalon).toEqual({ type: 'success', data: link })
      expect(ofASalon).toEqual({ type: 'success', data: null })
    })

    it.each<[string, () => Promise<{ reach: LedgerReach; id: string }>]>([
      [
        'of a file of another salon',
        async () => {
          const { link } = await storedShare()
          return { reach: reachOf(await storedSalon()), id: link.id }
        },
      ],
      [
        'of a file that was deleted',
        async () => {
          const { salonId, link } = await storedShare({
            deletedAt: '2026-12-09T05:00:00Z',
          })
          return { reach: reachOf(salonId), id: link.id }
        },
      ],
      [
        'of an ID that names none',
        async () => ({ reach: EVERY_SALON, id: UNKNOWN_ID }),
      ],
    ])('should find no link %s', async (_case, arrange) => {
      // Arrange
      const { reach, id } = await arrange()

      // Act
      const found = await repository().findById(
        reach,
        shareLinkIdSchema.parse(id),
      )

      // Assert
      expect(found).toEqual({ type: 'success', data: null })
    })
  })

  describe('list', () => {
    /**
     * A file with four links: one made on 9 December, two made a day
     * later at one moment, of which the one with the greater ID comes
     * first, and one that has run out and issued every download it may,
     * made last. Another file has a link of its own.
     */
    const storedLinks = async () => {
      const attachmentId = await storedFile(await storedSalon())
      const first = await storedLink(attachmentId, { id: idOf(4) })
      const sameLesser = await storedLink(attachmentId, {
        id: idOf(1),
        createdAt: '2026-12-10T03:00:00Z',
        expiresAt: '2026-12-17T03:00:00Z',
      })
      const sameGreater = await storedLink(attachmentId, {
        id: idOf(2),
        createdAt: '2026-12-10T03:00:00Z',
        expiresAt: '2026-12-17T03:00:00Z',
      })
      const spent = await storedLink(attachmentId, {
        id: idOf(3),
        createdAt: '2026-12-11T03:00:00Z',
        expiresAt: '2026-12-11T04:00:00Z',
        maxDownloads: 1,
        downloadCount: 1,
      })
      const other = await storedLink(await storedFile(await storedSalon()))
      return { attachmentId, first, sameLesser, sameGreater, spent, other }
    }

    it('should list the links of the file, the latest first and then the greatest ID, those that work no more among them', async () => {
      // Arrange
      const { attachmentId, first, sameLesser, sameGreater, spent } =
        await storedLinks()

      // Act
      const listed = await repository().list({
        attachmentId,
        limit: 20,
        after: null,
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: {
          shareLinks: [spent, sameGreater, sameLesser, first],
          total: 4,
          hasMore: false,
        },
      })
    })

    it('should list a page at a time, from the link after the cursor', async () => {
      // Arrange
      const { attachmentId, first, sameLesser, sameGreater } =
        await storedLinks()

      // Act
      const second = await repository().list({
        attachmentId,
        limit: 1,
        after: linkIdOf(sameGreater),
      })
      const last = await repository().list({
        attachmentId,
        limit: 1,
        after: linkIdOf(sameLesser),
      })

      // Assert
      expect(second).toEqual({
        type: 'success',
        data: { shareLinks: [sameLesser], total: 4, hasMore: true },
      })
      expect(last).toEqual({
        type: 'success',
        data: { shareLinks: [first], total: 4, hasMore: false },
      })
    })

    it.each<[string, (other: { id: string }) => string]>([
      ['a link of another file', (other) => other.id],
      ['an ID that names no link', () => UNKNOWN_ID],
    ])('should list no page after %s', async (_cursor, cursorOf) => {
      // Arrange
      const { attachmentId, other } = await storedLinks()

      // Act
      const listed = await repository().list({
        attachmentId,
        limit: 20,
        after: shareLinkIdSchema.parse(cursorOf(other)),
      })

      // Assert
      expect(listed).toEqual({ type: 'success', data: null })
    })
  })

  describe('remove', () => {
    it.each<[string, (salonId: SalonId) => LedgerReach]>([
      ['the salon of its file', reachOf],
      ['every salon', () => EVERY_SALON],
    ])(
      'should remove the link for a manager of %s, and leave the others',
      async (_reach, reach) => {
        // Arrange
        const { salonId, attachmentId, link } = await storedShare()
        const kept = await storedLink(attachmentId)

        // Act
        const removed = await repository().remove(
          reach(salonId),
          linkIdOf(link),
        )

        // Assert
        expect(removed).toEqual({ type: 'success', data: true })
        expect(await rowOf(link.id)).toBeUndefined()
        expect(await rowOf(kept.id)).toEqual(kept)
      },
    )

    it.each<[string, () => Promise<{ reach: LedgerReach; id: string }>]>([
      [
        'of a file of another salon',
        async () => {
          const { link } = await storedShare()
          return { reach: reachOf(await storedSalon()), id: link.id }
        },
      ],
      [
        'of a file of no salon, for a manager of a salon',
        async () => {
          const link = await storedLink(await storedFile(null))
          return { reach: reachOf(await storedSalon()), id: link.id }
        },
      ],
      [
        'of a file that was deleted',
        async () => {
          const { salonId, link } = await storedShare({
            deletedAt: '2026-12-09T05:00:00Z',
          })
          return { reach: reachOf(salonId), id: link.id }
        },
      ],
    ])('should remove no link %s', async (_case, arrange) => {
      // Arrange
      const { reach, id } = await arrange()
      const before = await rowOf(id)

      // Act
      const removed = await repository().remove(
        reach,
        shareLinkIdSchema.parse(id),
      )

      // Assert
      expect(removed).toEqual({ type: 'success', data: false })
      expect(await rowOf(id)).toEqual(before)
    })

    it('should remove no link of an ID that names none', async () => {
      // Act
      const removed = await repository().remove(
        EVERY_SALON,
        shareLinkIdSchema.parse(UNKNOWN_ID),
      )

      // Assert
      expect(removed).toEqual({ type: 'success', data: false })
    })
  })

  describe('findWorking', () => {
    it.each<[string, Parameters<typeof insertShareLink>[3]]>([
      [
        'a link that runs out a millisecond later',
        {
          expiresAt: '2026-12-10T03:00:00.001Z',
        },
      ],
      ['a link with one download left', { maxDownloads: 2, downloadCount: 1 }],
      ['a link without a limit of downloads', { downloadCount: 40 }],
    ])('should find %s with its file', async (_link, overrides) => {
      // Arrange
      const attachmentId = await storedFile(await storedSalon())
      const link = await storedLink(attachmentId, {
        tokenHash: 'hash-of-the-token',
        ...overrides,
      })
      const [attachment] = await databases
        .database()
        .select()
        .from(attachments)
        .where(eq(attachments.id, attachmentId))

      // Act
      const found = await repository().findWorking('hash-of-the-token', NOW)

      // Assert
      expect(found).toEqual({
        type: 'success',
        data: { shareLink: link, attachment },
      })
    })

    it.each<[string, FileOverrides, Parameters<typeof insertShareLink>[3]]>([
      ['that runs out at the moment', {}, { expiresAt: NOW.toISOString() }],
      [
        'that issued every download it may',
        {},
        { maxDownloads: 2, downloadCount: 2 },
      ],
      [
        'whose file is still pending',
        { status: 'pending', uploadedAt: null },
        {},
      ],
      ['whose file was deleted', { deletedAt: '2026-12-09T05:00:00Z' }, {}],
    ])('should find no link %s', async (_case, file, link) => {
      // Arrange
      const attachmentId = await storedFile(await storedSalon(), file)
      await storedLink(attachmentId, {
        tokenHash: 'hash-of-the-token',
        ...link,
      })

      // Act
      const found = await repository().findWorking('hash-of-the-token', NOW)

      // Assert
      expect(found).toEqual({ type: 'success', data: null })
    })

    it('should find no link of a hash of no token', async () => {
      // Arrange
      await storedShare()

      // Act
      const found = await repository().findWorking('hash-of-no-token', NOW)

      // Assert
      expect(found).toEqual({ type: 'success', data: null })
    })
  })

  describe('recordWrongPassword', () => {
    const LOCKED_UNTIL = '2026-12-10T03:15:00.000Z'

    it.each<[string, number, string | null, string | null]>([
      ['below the threshold, without a lock', 0, null, null],
      [
        'below the threshold, with the lock that ran out',
        1,
        '2026-12-09T04:00:00Z',
        '2026-12-09 04:00:00+00',
      ],
      ['that reaches the threshold', 2, null, '2026-12-10 03:15:00+00'],
      [
        'that goes over the threshold',
        4,
        '2026-12-09T04:00:00Z',
        '2026-12-10 03:15:00+00',
      ],
    ])(
      'should count a wrong password %s, and lock the link from the threshold on',
      async (_case, failedAttempts, lockedUntil, locked) => {
        // Arrange
        const { attachmentId, link } = await storedShare()
        await databases
          .database()
          .update(shareLinks)
          .set({ failedAttempts, lockedUntil })
          .where(eq(shareLinks.id, link.id))
        const other = await storedLink(attachmentId)

        // Act
        const recorded = await repository().recordWrongPassword(link.id, {
          threshold: 3,
          lockedUntil: LOCKED_UNTIL,
        })

        // Assert
        expect(recorded).toEqual({ type: 'success', data: null })
        expect(await rowOf(link.id)).toMatchObject({
          failedAttempts: failedAttempts + 1,
          lockedUntil: locked,
        })
        expect((await rowOf(link.id))?.updatedAt).not.toBe(other.updatedAt)
        expect(await rowOf(other.id)).toEqual(other)
      },
    )
  })

  describe('recordRightPassword', () => {
    it('should forget the wrong passwords and the lock of the link, and of no other', async () => {
      // Arrange
      const { attachmentId, link } = await storedShare()
      await databases
        .database()
        .update(shareLinks)
        .set({ failedAttempts: 2, lockedUntil: '2026-12-09T04:00:00Z' })
        .where(eq(shareLinks.id, link.id))
      const other = await rowOf(
        (await storedLink(attachmentId, { failedAttempts: 1 })).id,
      )

      // Act
      const recorded = await repository().recordRightPassword(link.id)

      // Assert
      expect(recorded).toEqual({ type: 'success', data: null })
      expect(await rowOf(link.id)).toMatchObject({
        failedAttempts: 0,
        lockedUntil: null,
      })
      expect((await rowOf(link.id))?.updatedAt).not.toBe(other?.updatedAt)
      expect(await rowOf(other?.id ?? UNKNOWN_ID)).toEqual(other)
    })
  })

  describe('countDownload', () => {
    it.each<[string, Parameters<typeof insertShareLink>[3]]>([
      ['with one download left', { maxDownloads: 2, downloadCount: 1 }],
      ['without a limit of downloads', { downloadCount: 40 }],
    ])('should count a download of a link %s', async (_link, overrides) => {
      // Arrange
      const attachmentId = await storedFile(await storedSalon())
      const link = await storedLink(attachmentId, overrides)
      const other = await storedLink(attachmentId)

      // Act
      const counted = await repository().countDownload(link.id, NOW)

      // Assert
      expect(counted).toEqual({ type: 'success', data: true })
      expect(await rowOf(link.id)).toMatchObject({
        downloadCount: link.downloadCount + 1,
      })
      expect((await rowOf(link.id))?.updatedAt).not.toBe(other.updatedAt)
      expect(await rowOf(other.id)).toEqual(other)
    })

    it.each<[string, FileOverrides, Parameters<typeof insertShareLink>[3]]>([
      ['that runs out at the moment', {}, { expiresAt: NOW.toISOString() }],
      [
        'that issued every download it may',
        {},
        { maxDownloads: 2, downloadCount: 2 },
      ],
      [
        'whose file is still pending',
        { status: 'pending', uploadedAt: null },
        {},
      ],
      ['whose file was deleted', { deletedAt: '2026-12-09T05:00:00Z' }, {}],
    ])(
      'should count no download of a link %s',
      async (_case, file, overrides) => {
        // Arrange
        const link = await storedLink(
          await storedFile(await storedSalon(), file),
          overrides,
        )

        // Act
        const counted = await repository().countDownload(link.id, NOW)

        // Assert
        expect(counted).toEqual({ type: 'success', data: false })
        expect(await rowOf(link.id)).toEqual(link)
      },
    )

    it('should count no download over the limit by the count it waited for', async () => {
      // Arrange
      const link = await storedLink(await storedFile(await storedSalon()), {
        maxDownloads: 2,
        downloadCount: 1,
      })

      // Act
      const counted = await databases.whileHeld(
        (held) =>
          held`select id from share_links where id = ${link.id} for update`,
        (held) =>
          held`update share_links set "downloadCount" = 2 where id = ${link.id}`,
        () => repository().countDownload(link.id, NOW),
      )

      // Assert
      expect(counted).toEqual({ type: 'success', data: false })
      expect(await rowOf(link.id)).toMatchObject({ downloadCount: 2 })
    })
  })
})

describe('ShareLinkRepository when the database is gone', () => {
  const id = shareLinkIdSchema.parse(UNKNOWN_ID)

  it.each<[string, string, (gone: ShareLinkRepository) => Promise<unknown>]>([
    [
      'a creation',
      'Failed to create share link',
      (gone) =>
        gone.create({
          attachmentId: UNKNOWN_ID,
          tokenHash: 'hash-of-a-new-token',
          passwordHash: null,
          expiresAt: '2026-12-16T03:00:00.000Z',
          maxDownloads: null,
          createdBy: UNKNOWN_ID,
          createdAt: '2026-12-09T03:00:00.000Z',
          updatedAt: '2026-12-09T03:00:00.000Z',
        }),
    ],
    [
      'a link',
      'Failed to find share link',
      (gone) => gone.findById(EVERY_SALON, id),
    ],
    [
      'the links of a file',
      'Failed to list share links',
      (gone) =>
        gone.list({
          attachmentId: attachmentIdSchema.parse(UNKNOWN_ID),
          limit: 20,
          after: null,
        }),
    ],
    [
      'a removal',
      'Failed to delete share link',
      (gone) => gone.remove(EVERY_SALON, id),
    ],
    [
      'a shared file',
      'Failed to find shared file',
      (gone) => gone.findWorking('hash-of-the-token', NOW),
    ],
    [
      'a wrong password',
      'Failed to record wrong password of share link',
      (gone) =>
        gone.recordWrongPassword(id, {
          threshold: 3,
          lockedUntil: '2026-12-10T03:15:00.000Z',
        }),
    ],
    [
      'a right password',
      'Failed to record right password of share link',
      (gone) => gone.recordRightPassword(id),
    ],
    [
      'a download',
      'Failed to count download of share link',
      (gone) => gone.countDownload(id, NOW),
    ],
  ])('should answer for %s: %s', async (_subject, message, call) => {
    // Arrange
    const gone = new ShareLinkRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
