import { asOneString, type LocalizedText } from '@beauty-salon-shared/i18n'
import { attachmentMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { ATTACHMENT_ID } from '../../__tests__/fixtures/attachment-fixtures'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import { MOST_FILE_SIZE } from '../../business-logic/attachment/_shared/file-rules'
import {
  attachmentDownloadUrlRequestSchema,
  attachmentSearchRequestSchema,
  attachmentUploadUrlRequestSchema,
} from '../attachment.schema'

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

  it.each<[string, Record<string, unknown>, LocalizedText]>([
    [
      'a name with a path',
      { filename: 'a/b.png' },
      attachmentMessages.filenameWithoutPath,
    ],
    [
      'a name that ends as an image of another kind does',
      { filename: 'a.jpg' },
      attachmentMessages.filenameOfType('image/png'),
    ],
    [
      'a document that is named as an image',
      { contentType: 'application/pdf', filename: 'a.png' },
      attachmentMessages.filenameOfType('application/pdf'),
    ],
  ])(
    'should say in every language what is wrong with %s',
    (_case, overrides, written) => {
      // Act
      const result = parsed(overrides)

      // Assert
      expect(result.error?.issues.map(({ message }) => message)).toEqual([
        asOneString(written),
      ])
    },
  )
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
