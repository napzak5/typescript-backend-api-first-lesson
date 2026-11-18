import { describe, expect, it } from 'vitest'
import {
  attachmentReachOf,
  mayPurgeAttachments,
  mayRemoveAttachment,
  reachesFilesOf,
} from '../business-logic/attachment/_shared/authorization'
import {
  beginsAs,
  contentDispositionOf,
  DOWNLOAD_URL_MINUTES,
  extensionsOf,
  hasExtensionOf,
  isRefusedInFilename,
  MOST_FILE_SIZE,
  PENDING_KEPT_HOURS,
  SIGNATURE_LENGTH,
  storageKeyOf,
  UPLOAD_URL_MINUTES,
} from '../business-logic/attachment/_shared/file-rules'
import { AttachmentReadMapper } from '../mappers/read/attachment.mapper'
import type { AttachmentContentType } from '../models/attachment'
import type { Actor } from '../models/auth'
import {
  attachmentDownloadUrlRequestSchema,
  attachmentSearchRequestSchema,
  attachmentUploadUrlRequestSchema,
} from '../schemas/attachment.schema'
import {
  ATTACHMENT_ID,
  apiAttachment,
  apiUploadedAttachment,
  bytesOf,
  dbAttachment,
  OTHER_ATTACHMENT_ID,
  PNG,
  UPLOADED,
} from './attachment-fixtures'
import { actors, USER_ID } from './auth-fixtures'
import { OTHER_SALON_ID, SALON_ID } from './fixtures'

const OTHER_USER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7a03'

const JPEG = [0xff, 0xd8, 0xff, 0xe0]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
const WAVE = [0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
const HTML = [...Buffer.from('<!doctype html>')]

const KINDS: AttachmentContentType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

describe('the limits of an attachment', () => {
  it('takes files of up to 10 MiB, by URLs of 15 and of 5 minutes, and keeps an upload that is not completed for a day', () => {
    expect(MOST_FILE_SIZE).toBe(10_485_760)
    expect(UPLOAD_URL_MINUTES).toBe(15)
    expect(DOWNLOAD_URL_MINUTES).toBe(5)
    expect(PENDING_KEPT_HOURS).toBe(24)
    expect(SIGNATURE_LENGTH).toBe(12)
  })
})

describe('extensionsOf', () => {
  it('names the endings of each kind', () => {
    expect(KINDS.map(extensionsOf)).toEqual([
      ['.jpg', '.jpeg'],
      ['.png'],
      ['.webp'],
      ['.pdf'],
    ])
  })
})

describe('hasExtensionOf', () => {
  it.each<[AttachmentContentType, string]>([
    ['image/jpeg', 'a.jpg'],
    ['image/jpeg', 'a.jpeg'],
    ['image/jpeg', 'IMG_0001.JPG'],
    ['image/jpeg', 'a.JpEg'],
    ['image/png', '施術前.png'],
    ['image/png', 'a.b.c.png'],
    ['image/png', ' .png'],
    ['image/webp', 'a.webp'],
    ['application/pdf', '同意書.PDF'],
  ])('takes %s named %j', (contentType, filename) => {
    expect(hasExtensionOf(contentType, filename)).toBe(true)
  })

  it.each<[AttachmentContentType, string]>([
    ['image/jpeg', 'a.png'],
    ['image/jpeg', 'a.jpe'],
    ['image/jpeg', 'ajpg'],
    ['image/jpeg', '.jpg'],
    ['image/jpeg', '.jpeg'],
    ['image/png', '.png'],
    ['image/png', 'png'],
    ['image/png', ''],
    ['image/png', 'a.png.html'],
    ['image/png', 'a.png '],
    ['image/png', 'a.png.'],
    ['image/png', 'a.jpg'],
    ['image/webp', '.webp'],
    ['image/webp', 'a.web'],
    ['application/pdf', '.pdf'],
    ['application/pdf', 'a.pdf.exe'],
  ])('refuses %s named %j', (contentType, filename) => {
    expect(hasExtensionOf(contentType, filename)).toBe(false)
  })
})

describe('isRefusedInFilename', () => {
  it.each([
    ['NUL', '\u0000'],
    ['a tab', '\t'],
    ['a line feed', '\n'],
    ['a carriage return', '\r'],
    ['the last C0 control character', '\u001f'],
    ['DEL', '\u007f'],
    ['the first C1 control character', '\u0080'],
    ['the last C1 control character', '\u009f'],
    ['a slash', '/'],
    ['a backslash', '\\'],
  ])('refuses %s', (_name, character) => {
    expect(isRefusedInFilename(character)).toBe(true)
  })

  it.each([
    ['a space', ' '],
    ['the character after the C0 control characters', ' '],
    ['a tilde', '~'],
    ['the character after the C1 control characters', ' '],
    ['a letter', 'a'],
    ['a kanji', '施'],
    ['an emoji', '😀'],
    ['a dot', '.'],
    ['a colon', ':'],
    ['a quote', '"'],
    ['a full-width slash', '／'],
  ])('takes %s', (_name, character) => {
    expect(isRefusedInFilename(character)).toBe(false)
  })
})

describe('storageKeyOf', () => {
  it('is made of the ID alone', () => {
    expect(storageKeyOf(ATTACHMENT_ID)).toBe(`attachments/${ATTACHMENT_ID}`)
    expect(storageKeyOf(OTHER_ATTACHMENT_ID)).not.toBe(
      storageKeyOf(ATTACHMENT_ID),
    )
  })
})

describe('beginsAs', () => {
  it.each<[AttachmentContentType, number[]]>([
    ['image/jpeg', JPEG],
    ['image/png', PNG],
    ['image/webp', WEBP],
    ['application/pdf', PDF],
  ])('takes %s by how it begins', (contentType, begin) => {
    expect(beginsAs(contentType, bytesOf(begin, 12))).toBe(true)
    // A file that is no longer than how it begins.
    expect(beginsAs(contentType, new Uint8Array(begin))).toBe(true)
  })

  it.each<[AttachmentContentType, number, number]>([
    ['image/jpeg', 3, 2],
    ['image/png', 8, 7],
    ['image/webp', 12, 11],
    ['application/pdf', 5, 4],
  ])(
    'takes %s of %i bytes that begin so, and refuses one of %i',
    (contentType, enough, short) => {
      const begin = {
        'image/jpeg': JPEG,
        'image/png': PNG,
        'image/webp': WEBP,
        'application/pdf': PDF,
      }[contentType]

      expect(
        beginsAs(contentType, new Uint8Array(begin.slice(0, enough))),
      ).toBe(true)
      expect(beginsAs(contentType, new Uint8Array(begin.slice(0, short)))).toBe(
        false,
      )
    },
  )

  it.each(KINDS)(
    'refuses what begins as another kind does for %s',
    (contentType) => {
      const others: [AttachmentContentType, number[]][] = [
        ['image/jpeg', JPEG],
        ['image/png', PNG],
        ['image/webp', WEBP],
        ['application/pdf', PDF],
      ]

      for (const [other, begin] of others) {
        expect(beginsAs(contentType, bytesOf(begin, 12))).toBe(
          other === contentType,
        )
      }
      expect(beginsAs(contentType, bytesOf(GIF, 12))).toBe(false)
      expect(beginsAs(contentType, bytesOf(HTML, 12))).toBe(false)
      expect(beginsAs(contentType, new Uint8Array())).toBe(false)
      expect(beginsAs(contentType, new Uint8Array(12))).toBe(false)
    },
  )

  it('refuses a RIFF container that is not a WebP image, and a WebP form that is in no RIFF container', () => {
    expect(beginsAs('image/webp', new Uint8Array(WAVE))).toBe(false)
    expect(
      beginsAs('image/webp', new Uint8Array([0, 0, 0, 0, ...WEBP.slice(4)])),
    ).toBe(false)
    // Whatever the four bytes of the length are.
    expect(
      beginsAs(
        'image/webp',
        new Uint8Array([
          ...WEBP.slice(0, 4),
          0xff,
          0xff,
          0xff,
          0xff,
          ...WEBP.slice(8),
        ]),
      ),
    ).toBe(true)
  })

  it('refuses a signature that does not begin the file', () => {
    expect(beginsAs('image/png', new Uint8Array([0, ...PNG]))).toBe(false)
    expect(beginsAs('application/pdf', new Uint8Array([0x0a, ...PDF]))).toBe(
      false,
    )
  })
})

describe('contentDispositionOf', () => {
  it.each([
    ['before.png', `filename="before.png"; filename*=UTF-8''before.png`],
    [
      '施術前 (1).png',
      `filename="___ (1).png"; filename*=UTF-8''%E6%96%BD%E8%A1%93%E5%89%8D%20%281%29.png`,
    ],
    [
      `it's "100%".png`,
      `filename="it's _100__.png"; filename*=UTF-8''it%27s%20%22100%25%22.png`,
    ],
    [
      'a;b,c*d.png',
      `filename="a;b,c*d.png"; filename*=UTF-8''a%3Bb%2Cc%2Ad.png`,
    ],
    ['a:b|c?.png', `filename="a:b|c?.png"; filename*=UTF-8''a%3Ab%7Cc%3F.png`],
    ['😀.png', `filename="_.png"; filename*=UTF-8''%F0%9F%98%80.png`],
    ['ä~!.pdf', `filename="_~!.pdf"; filename*=UTF-8''%C3%A4~!.pdf`],
  ])('names %j in ASCII and in UTF-8', (filename, parameters) => {
    expect(contentDispositionOf(filename, false)).toBe(
      `attachment; ${parameters}`,
    )
    expect(contentDispositionOf(filename, true)).toBe(`inline; ${parameters}`)
  })

  it('keeps what would end the name or begin another header out of both names', () => {
    const header = contentDispositionOf(
      'a"; filename="b.html\r\nX: y.png',
      false,
    )

    expect(header).toBe(
      `attachment; filename="a_; filename=_b.html__X: y.png"; filename*=UTF-8''a%22%3B%20filename%3D%22b.html%0D%0AX%3A%20y.png`,
    )
    expect(header).not.toMatch(/[\r\n]/)
    expect(header.split('"')).toHaveLength(3)
  })

  it('writes a name with half of a surrogate pair instead of failing', () => {
    expect(contentDispositionOf('a\ud83d.png', false)).toBe(
      `attachment; filename="a_.png"; filename*=UTF-8''a%EF%BF%BD.png`,
    )
  })
})

describe('who reaches attachments', () => {
  it('lets an administrator reach those of every salon, and of none', () => {
    const reach = attachmentReachOf(actors.admin)

    expect(reach).toEqual({ type: 'everySalon' })
    expect(reach !== null && reachesFilesOf(reach, SALON_ID)).toBe(true)
    expect(reach !== null && reachesFilesOf(reach, null)).toBe(true)
  })

  it.each<['owner' | 'manager' | 'staff']>([['owner'], ['manager'], ['staff']])(
    'lets the %s of a salon reach those of that salon alone',
    (role) => {
      const reach = attachmentReachOf(actors.ofSalon(role))

      expect(reach).toEqual({ type: 'salon', salonId: SALON_ID })
      expect(reach !== null && reachesFilesOf(reach, SALON_ID)).toBe(true)
      expect(reach !== null && reachesFilesOf(reach, OTHER_SALON_ID)).toBe(
        false,
      )
      expect(reach !== null && reachesFilesOf(reach, null)).toBe(false)
    },
  )

  it.each<[string, Actor]>([
    ['a customer', actors.customer],
    ['a customer without a profile', actors.customerWithoutProfile],
    ['a user of no scope', actors.withoutScope],
  ])('lets %s reach none', (_who, actor) => {
    expect(attachmentReachOf(actor)).toBeNull()
  })
})

describe('mayRemoveAttachment', () => {
  const ofAnother = dbAttachment({ uploadedBy: OTHER_USER_ID })

  it.each<[string, Actor]>([
    ['an administrator', actors.admin],
    ['the owner of the salon', actors.ofSalon('owner')],
    ['a manager of the salon', actors.ofSalon('manager')],
  ])('lets %s remove what someone else uploaded', (_who, actor) => {
    expect(mayRemoveAttachment(actor, ofAnother)).toBe(true)
  })

  it('lets a staff member remove what they uploaded, and nothing else', () => {
    const staff = actors.ofSalon('staff')

    expect(
      mayRemoveAttachment(staff, dbAttachment({ uploadedBy: USER_ID })),
    ).toBe(true)
    expect(mayRemoveAttachment(staff, ofAnother)).toBe(false)
  })

  it.each<['owner' | 'manager']>([['owner'], ['manager']])(
    'does not let the %s of another salon remove it, nor one of no salon',
    (role) => {
      const stranger = actors.ofSalon(role, OTHER_SALON_ID)

      expect(mayRemoveAttachment(stranger, ofAnother)).toBe(false)
      expect(
        mayRemoveAttachment(actors.ofSalon(role), {
          ...ofAnother,
          salonId: null,
        }),
      ).toBe(false)
    },
  )

  it('lets an administrator remove one of no salon', () => {
    expect(
      mayRemoveAttachment(actors.admin, { ...ofAnother, salonId: null }),
    ).toBe(true)
  })
})

describe('mayPurgeAttachments', () => {
  it('lets an administrator alone purge', () => {
    expect(mayPurgeAttachments(actors.admin)).toBe(true)
    expect(
      [
        actors.ofSalon('owner'),
        actors.ofSalon('manager'),
        actors.ofSalon('staff'),
        actors.customer,
        actors.customerWithoutProfile,
        actors.withoutScope,
      ].map(mayPurgeAttachments),
    ).toEqual([false, false, false, false, false, false])
  })
})

describe('attachmentUploadUrlRequestSchema', () => {
  const valid = {
    filename: '施術前.png',
    contentType: 'image/png',
    size: 64,
    salonId: SALON_ID,
  }
  const parsed = (overrides: Record<string, unknown>) =>
    attachmentUploadUrlRequestSchema.safeParse({ ...valid, ...overrides })
  const brokenBy = (overrides: Record<string, unknown>): string[] => {
    const result = parsed(overrides)

    return result.success
      ? []
      : result.error.issues.map(({ path, code }) => `${path.join('.')}:${code}`)
  }

  it('takes what is stated of a file as it is', () => {
    expect(parsed({})).toEqual({ success: true, data: valid })
    expect(parsed({ salonId: null })).toEqual({
      success: true,
      data: { ...valid, salonId: null },
    })
  })

  it.each([
    ['one byte', { size: 1 }],
    ['10 MiB', { size: MOST_FILE_SIZE }],
    ['a name of 255 characters', { filename: `${'あ'.repeat(251)}.png` }],
    ['a name of five characters', { filename: 'a.png' }],
    ['a JPEG image', { contentType: 'image/jpeg', filename: 'a.JPEG' }],
    ['a WebP image', { contentType: 'image/webp', filename: 'a.webp' }],
    ['a PDF document', { contentType: 'application/pdf', filename: 'a.pdf' }],
  ])('takes %s', (_case, overrides) => {
    expect(parsed(overrides).success).toBe(true)
  })

  it.each([
    ['an empty name', { filename: '' }, ['filename:too_small']],
    [
      'a name of 256 characters',
      { filename: `${'a'.repeat(252)}.png` },
      ['filename:too_big'],
    ],
    ['a name with a slash', { filename: 'a/b.png' }, ['filename:custom']],
    ['a name with a backslash', { filename: 'a\\b.png' }, ['filename:custom']],
    ['a name with a line feed', { filename: 'a\nb.png' }, ['filename:custom']],
    ['a name with NUL', { filename: 'a\u0000.png' }, ['filename:custom']],
    [
      'a name that ends as another kind',
      { filename: 'a.jpg' },
      ['filename:custom'],
    ],
    [
      'a name that is an ending only',
      { filename: '.png' },
      ['filename:custom'],
    ],
    [
      'a GIF image',
      { contentType: 'image/gif' },
      ['contentType:invalid_value'],
    ],
    [
      'an SVG image',
      { contentType: 'image/svg+xml' },
      ['contentType:invalid_value'],
    ],
    [
      'a kind in upper case',
      { contentType: 'IMAGE/PNG' },
      ['contentType:invalid_value'],
    ],
    ['an empty file', { size: 0 }, ['size:too_small']],
    [
      'a file of 10 MiB and a byte',
      { size: MOST_FILE_SIZE + 1 },
      ['size:too_big'],
    ],
    ['a size with a fraction', { size: 1.5 }, ['size:invalid_type']],
    ['a size that is text', { size: '64' }, ['size:invalid_type']],
    [
      'a salon that is no ID',
      { salonId: 'aoyama' },
      ['salonId:invalid_format'],
    ],
    ['a property of no request', { key: 'k' }, [':unrecognized_keys']],
  ])('refuses %s', (_case, overrides, rules) => {
    expect(brokenBy(overrides)).toEqual(rules)
  })

  it.each(['filename', 'contentType', 'size', 'salonId'])(
    'refuses a request without %s',
    (property) => {
      const rest = Object.fromEntries(
        Object.entries(valid).filter(([key]) => key !== property),
      )

      expect(attachmentUploadUrlRequestSchema.safeParse(rest).success).toBe(
        false,
      )
    },
  )

  it('reports a name with a path once, and does not compare it with the kind', () => {
    expect(brokenBy({ filename: 'a/b.gif' })).toEqual(['filename:custom'])
    expect(brokenBy({ filename: '' })).toEqual(['filename:too_small'])
  })

  it('does not compare a name with a kind that is none', () => {
    expect(brokenBy({ contentType: 'image/gif', filename: 'a.gif' })).toEqual([
      'contentType:invalid_value',
    ])
  })
})

describe('attachmentSearchRequestSchema', () => {
  const parsed = (input: unknown) =>
    attachmentSearchRequestSchema.safeParse(input)

  it('takes no parameter, and each of them', () => {
    expect(parsed({})).toEqual({ success: true, data: {} })
    expect(
      parsed({ limit: 100, cursor: ATTACHMENT_ID, salonId: SALON_ID }),
    ).toEqual({
      success: true,
      data: { limit: 100, cursor: ATTACHMENT_ID, salonId: SALON_ID },
    })
    expect(parsed({ limit: 1 }).success).toBe(true)
  })

  it.each<[string, unknown]>([
    ['a limit of zero', { limit: 0 }],
    ['a limit of 101', { limit: 101 }],
    ['a limit with a fraction', { limit: 1.5 }],
    ['a limit that is text', { limit: '20' }],
    ['a cursor that is no ID', { cursor: 'last' }],
    ['a salon that is no ID', { salonId: 'aoyama' }],
    ['a parameter of no list', { status: 'pending' }],
  ])('refuses %s', (_case, input) => {
    expect(parsed(input).success).toBe(false)
  })
})

describe('attachmentDownloadUrlRequestSchema', () => {
  const parsed = (input: unknown) =>
    attachmentDownloadUrlRequestSchema.safeParse(input)

  it('takes the flag, or none', () => {
    expect(parsed({})).toEqual({ success: true, data: {} })
    expect(parsed({ inline: true })).toEqual({
      success: true,
      data: { inline: true },
    })
    expect(parsed({ inline: false }).success).toBe(true)
  })

  it.each<[string, unknown]>([
    ['a flag that is text', { inline: 'true' }],
    ['a flag that is a number', { inline: 1 }],
    ['a parameter of no download', { filename: 'a.html' }],
  ])('refuses %s', (_case, input) => {
    expect(parsed(input).success).toBe(false)
  })
})

describe('AttachmentReadMapper', () => {
  it('returns the columns under their names and the timestamps as ISO 8601, without the time the attachment was deleted', () => {
    expect(AttachmentReadMapper.toApiAttachment(dbAttachment())).toStrictEqual({
      type: 'success',
      data: apiAttachment(),
    })
    expect(
      AttachmentReadMapper.toApiAttachment(
        dbAttachment({ ...UPLOADED, deletedAt: '2026-11-19 09:00:00+09' }),
      ),
    ).toStrictEqual({ type: 'success', data: apiUploadedAttachment() })
  })

  it('returns an attachment of no salon with null', () => {
    expect(
      AttachmentReadMapper.toApiAttachment(dbAttachment({ salonId: null })),
    ).toStrictEqual({
      type: 'success',
      data: apiAttachment({ salonId: null }),
    })
  })

  it('maps a list in its order, and an empty one', () => {
    const second = dbAttachment({ id: OTHER_ATTACHMENT_ID })

    expect(
      AttachmentReadMapper.toApiAttachments([second, dbAttachment()]),
    ).toStrictEqual({
      type: 'success',
      data: [apiAttachment({ id: OTHER_ATTACHMENT_ID }), apiAttachment()],
    })
    expect(AttachmentReadMapper.toApiAttachments([])).toStrictEqual({
      type: 'success',
      data: [],
    })
  })

  it.each([
    ['uploadExpiresAt', { uploadExpiresAt: 'in a while' }],
    ['uploadedAt', { uploadedAt: 'yesterday' }],
    ['createdAt', { createdAt: '' }],
    ['updatedAt', { updatedAt: 'never' }],
  ])(
    'reports a stored %s that is no time as an error of the database, alone and in a list',
    (_column, overrides) => {
      const stored = dbAttachment(overrides)

      const alone = AttachmentReadMapper.toApiAttachment(stored)
      const listed = AttachmentReadMapper.toApiAttachments([
        dbAttachment(),
        stored,
      ])

      expect(alone).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored attachment ${ATTACHMENT_ID} does not match the API model`,
        },
      })
      expect(listed).toEqual(alone)
    },
  )
})
