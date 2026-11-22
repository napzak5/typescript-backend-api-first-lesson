import { describe, expect, it } from 'vitest'
import { AttachmentReadMapper } from '../mappers/read/attachment.mapper'
import { AttachmentWriteMapper } from '../mappers/write/attachment.mapper'
import { attachmentIdSchema } from '../models/attachment'
import { userIdSchema } from '../models/auth'
import type { LedgerReach } from '../models/booking'
import { salonIdSchema } from '../models/salon'
import {
  ATTACHMENT_ID,
  apiAttachment,
  DOWNLOAD_URL,
  dbAttachment,
  OTHER_ATTACHMENT_ID,
  UPLOAD_URL,
} from './attachment-fixtures'
import { USER_ID } from './auth-fixtures'
import { SALON_ID } from './fixtures'

const salonId = salonIdSchema.parse(SALON_ID)

describe('AttachmentReadMapper.toApiAttachmentPage', () => {
  it('answers with the attachments of the list and where the list goes on', () => {
    const result = AttachmentReadMapper.toApiAttachmentPage(
      {
        attachments: [
          dbAttachment(),
          dbAttachment({ id: OTHER_ATTACHMENT_ID }),
        ],
        total: 9,
        hasMore: true,
      },
      { limit: 2, after: null },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: ATTACHMENT_ID }, { id: OTHER_ATTACHMENT_ID }],
        meta: {
          total: 9,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: OTHER_ATTACHMENT_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('fails as a whole when one stored attachment is invalid', () => {
    const result = AttachmentReadMapper.toApiAttachmentPage(
      {
        attachments: [dbAttachment({ updatedAt: 'recently' })],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('the answers of AttachmentReadMapper that are no attachment', () => {
  it('answers a pending attachment with where its file is sent and the headers to send it with', () => {
    expect(
      AttachmentReadMapper.toApiUploadUrl(apiAttachment(), {
        url: UPLOAD_URL,
        headers: { 'Content-Type': 'image/png', 'Content-Length': '64' },
      }),
    ).toStrictEqual({
      attachment: apiAttachment(),
      uploadUrl: UPLOAD_URL,
      uploadHeaders: { 'Content-Type': 'image/png', 'Content-Length': '64' },
    })
  })

  it('answers a URL that downloads a file with the moment it stops working, in ISO 8601 UTC', () => {
    expect(
      AttachmentReadMapper.toApiDownloadUrl(
        DOWNLOAD_URL,
        new Date('2026-11-18T11:10:00.250+09:00'),
      ),
    ).toStrictEqual({
      downloadUrl: DOWNLOAD_URL,
      expiresAt: '2026-11-18T02:10:00.250Z',
    })
  })

  it.each([0, 3])('answers a purge that removed %i attachments', (count) => {
    expect(AttachmentReadMapper.toApiPurge(count)).toStrictEqual({
      purgedCount: count,
    })
  })
})

describe('AttachmentWriteMapper.fromUploadUrlRequest', () => {
  const uploadedBy = userIdSchema.parse(USER_ID)

  it('writes what the request states of the file, and who asks', () => {
    expect(
      AttachmentWriteMapper.fromUploadUrlRequest(
        { filename: '施術前.png', contentType: 'image/png', size: 64, salonId },
        uploadedBy,
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      filename: '施術前.png',
      contentType: 'image/png',
      size: 64,
      uploadedBy: USER_ID,
    })
  })

  it('keeps the file of no salon as that', () => {
    expect(
      AttachmentWriteMapper.fromUploadUrlRequest(
        {
          filename: 'terms.pdf',
          contentType: 'application/pdf',
          size: 1,
          salonId: null,
        },
        uploadedBy,
      ),
    ).toMatchObject({ salonId: null })
  })
})

describe('AttachmentWriteMapper.fromSearchRequest', () => {
  const everySalon: LedgerReach = { type: 'everySalon' }
  const ownSalon: LedgerReach = { type: 'salon', salonId }

  it('asks for the first 20 attachments within the reach when the request names nothing', () => {
    expect(
      AttachmentWriteMapper.fromSearchRequest({}, everySalon),
    ).toStrictEqual({
      reach: { type: 'everySalon' },
      limit: 20,
      after: null,
      salonId: null,
    })
  })

  it('takes the place and the salon the request names', () => {
    expect(
      AttachmentWriteMapper.fromSearchRequest(
        {
          limit: 50,
          cursor: attachmentIdSchema.parse(ATTACHMENT_ID),
          salonId,
        },
        ownSalon,
      ),
    ).toStrictEqual({
      reach: { type: 'salon', salonId: SALON_ID },
      limit: 50,
      after: ATTACHMENT_ID,
      salonId: SALON_ID,
    })
  })
})

describe('AttachmentWriteMapper.fromDownloadUrlRequest', () => {
  it('saves the file under its name unless the request asks to show it', () => {
    expect(AttachmentWriteMapper.fromDownloadUrlRequest({})).toStrictEqual({
      inline: false,
    })
  })

  it.each([true, false])('takes inline=%s as the request says it', (inline) => {
    expect(
      AttachmentWriteMapper.fromDownloadUrlRequest({ inline }),
    ).toStrictEqual({ inline })
  })
})
