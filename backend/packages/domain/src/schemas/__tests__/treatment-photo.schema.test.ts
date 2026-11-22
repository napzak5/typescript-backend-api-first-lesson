import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  TREATMENT_RECORD_ID,
  treatmentPhotoBulkCreateRequest,
  treatmentPhotoCreateRequest,
} from '../../__tests__/fixtures/treatment-record-fixtures'
import { treatmentPhotoBulkCreateRequestSchema } from '../treatment-photo.schema'

/** The rules a value breaks, as `path:code`; empty when it breaks none. */
const brokenBy = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`) ?? []

/** The messages of the rules a value breaks, by their paths. */
const messagesOf = (schema: z.ZodType, value: unknown): string[] =>
  schema
    .safeParse(value)
    .error?.issues.map(({ path, message }) => `${path.join('.')}:${message}`) ??
  []

describe('treatmentPhotoBulkCreateRequestSchema', () => {
  it('takes an addition that states everything, and gives it back as it is', () => {
    const addition = { photos: [treatmentPhotoCreateRequest()] }

    expect(treatmentPhotoBulkCreateRequestSchema.parse(addition)).toEqual(
      addition,
    )
  })

  it('takes every kind of photo, null for what a photo may leave unstated, and a private photo without consent', () => {
    const addition = treatmentPhotoBulkCreateRequest(
      { photoType: 'before' },
      { photoType: 'during' },
      { photoType: 'after' },
      {
        photoType: 'other',
        thumbnailUrl: null,
        angle: null,
        description: null,
        isPublic: false,
        customerConsent: false,
      },
    )

    expect(brokenBy(treatmentPhotoBulkCreateRequestSchema, addition)).toEqual(
      [],
    )
  })

  it('takes the bounds of the columns, a long description, and an address of http', () => {
    const addition = treatmentPhotoBulkCreateRequest(
      {
        photoUrl: `http://images.example.com/${'a'.repeat(470)}.jpg`,
        thumbnailUrl: `https://images.example.com/${'b'.repeat(469)}.jpg`,
        angle: 'a'.repeat(50),
        description: '説明'.repeat(5000),
        sortOrder: 2_147_483_647,
      },
      { sortOrder: 0 },
    )
    expect(addition.photos[0]?.photoUrl).toHaveLength(500)
    expect(addition.photos[0]?.thumbnailUrl).toHaveLength(500)

    expect(brokenBy(treatmentPhotoBulkCreateRequestSchema, addition)).toEqual(
      [],
    )
  })

  it('takes twenty photos, and refuses none and twenty-one', () => {
    const photos = (count: number) =>
      treatmentPhotoBulkCreateRequest(
        ...Array.from({ length: count }, () => ({})),
      )

    expect(brokenBy(treatmentPhotoBulkCreateRequestSchema, photos(20))).toEqual(
      [],
    )
    expect(brokenBy(treatmentPhotoBulkCreateRequestSchema, photos(0))).toEqual([
      'photos:too_small',
    ])
    expect(brokenBy(treatmentPhotoBulkCreateRequestSchema, photos(21))).toEqual(
      ['photos:too_big'],
    )
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    [
      'a kind that is not one',
      { photoType: 'Before' },
      ['photos.0.photoType:invalid_value'],
    ],
    [
      'an address that is not one',
      { photoUrl: 'images/after.jpg' },
      ['photos.0.photoUrl:invalid_format'],
    ],
    [
      'an address of another scheme',
      { photoUrl: 'ftp://images.example.com/after.jpg' },
      ['photos.0.photoUrl:invalid_format'],
    ],
    [
      'an address beyond 500 characters',
      { photoUrl: `https://images.example.com/${'a'.repeat(470)}.jpg` },
      ['photos.0.photoUrl:too_big'],
    ],
    [
      'a thumbnail that is no address',
      { thumbnailUrl: 'small.jpg' },
      ['photos.0.thumbnailUrl:invalid_format'],
    ],
    [
      'a thumbnail beyond 500 characters',
      { thumbnailUrl: `https://images.example.com/${'b'.repeat(470)}.jpg` },
      ['photos.0.thumbnailUrl:too_big'],
    ],
    ['a blank angle', { angle: '  ' }, ['photos.0.angle:invalid_format']],
    [
      'an angle beyond 50 characters',
      { angle: 'a'.repeat(51) },
      ['photos.0.angle:too_big'],
    ],
    [
      'a blank description',
      { description: '\n' },
      ['photos.0.description:invalid_format'],
    ],
    ['a place below zero', { sortOrder: -1 }, ['photos.0.sortOrder:too_small']],
    [
      'a place that is no whole number',
      { sortOrder: 0.5 },
      ['photos.0.sortOrder:invalid_type'],
    ],
    [
      'a place beyond an integer',
      { sortOrder: 2_147_483_648 },
      ['photos.0.sortOrder:too_big'],
    ],
    [
      'a public photo without consent',
      { isPublic: true, customerConsent: false },
      ['photos.0.isPublic:custom'],
    ],
    [
      'a consent that is no boolean',
      { customerConsent: 'yes' },
      ['photos.0.customerConsent:invalid_type'],
    ],
    [
      'a key the photo does not have',
      { takenAt: '2026-11-20' },
      ['photos.0:unrecognized_keys'],
    ],
  ])('refuses %s', (_case, photo, broken) => {
    expect(
      brokenBy(
        treatmentPhotoBulkCreateRequestSchema,
        treatmentPhotoBulkCreateRequest(photo),
      ),
    ).toEqual(broken)
  })

  it('refuses a photo that leaves out a key, null where a photo states a value, and an addition with a key of its own', () => {
    const { thumbnailUrl: _left, ...withoutThumbnail } =
      treatmentPhotoCreateRequest()

    expect(
      brokenBy(treatmentPhotoBulkCreateRequestSchema, {
        photos: [withoutThumbnail],
      }),
    ).toEqual(['photos.0.thumbnailUrl:invalid_type'])
    expect(
      brokenBy(
        treatmentPhotoBulkCreateRequestSchema,
        treatmentPhotoBulkCreateRequest({ photoUrl: null, isPublic: null }),
      ),
    ).toEqual([
      'photos.0.photoUrl:invalid_type',
      'photos.0.isPublic:invalid_type',
    ])
    expect(
      brokenBy(treatmentPhotoBulkCreateRequestSchema, {
        ...treatmentPhotoBulkCreateRequest({}),
        recordId: TREATMENT_RECORD_ID,
      }),
    ).toEqual([':unrecognized_keys'])
  })

  it('tells a public photo without consent so, and keeps a private one without consent', () => {
    expect(
      messagesOf(
        treatmentPhotoBulkCreateRequestSchema,
        treatmentPhotoBulkCreateRequest({
          isPublic: true,
          customerConsent: false,
        }),
      ),
    ).toEqual(['photos.0.isPublic:Must have the consent of the customer'])
  })

  it('refuses each later photo of the address or the place of an earlier one, and tells which', () => {
    const shared = 'https://images.example.com/shared.jpg'
    const addition = treatmentPhotoBulkCreateRequest(
      { photoUrl: shared, sortOrder: 3 },
      { sortOrder: 4 },
      { photoUrl: shared, sortOrder: 4 },
      { photoUrl: shared, sortOrder: 3 },
    )

    expect(messagesOf(treatmentPhotoBulkCreateRequestSchema, addition)).toEqual(
      [
        'photos.2.photoUrl:Must not repeat the address of an earlier photo',
        'photos.2.sortOrder:Must not repeat the sortOrder of an earlier photo',
        'photos.3.photoUrl:Must not repeat the address of an earlier photo',
        'photos.3.sortOrder:Must not repeat the sortOrder of an earlier photo',
      ],
    )
  })

  it('tells a public photo without consent and a repeated address together', () => {
    const addition = treatmentPhotoBulkCreateRequest(
      {
        photoUrl: 'https://images.example.com/twice.jpg',
        isPublic: true,
        customerConsent: false,
      },
      { photoUrl: 'https://images.example.com/twice.jpg' },
    )

    expect(brokenBy(treatmentPhotoBulkCreateRequestSchema, addition)).toEqual([
      'photos.0.isPublic:custom',
      'photos.1.photoUrl:custom',
    ])
  })
})
