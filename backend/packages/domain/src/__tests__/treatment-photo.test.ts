import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import {
  AddTreatmentPhotosUseCase,
  RemoveTreatmentPhotoUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '../business-logic/treatment-record'
import {
  MAX_PHOTOS_OF_RECORD,
  photoAdditionRefusal,
} from '../business-logic/treatment-record/_shared/photos'
import { TreatmentRecordReadMapper } from '../mappers/read/treatment-record.mapper'
import { TreatmentRecordWriteMapper } from '../mappers/write/treatment-record.mapper'
import type { Actor } from '../models/auth'
import type { DbTreatmentPhoto } from '../models/treatment-record'
import type {
  TreatmentPhotoAddition,
  TreatmentPhotoRemoval,
} from '../repositories/treatment-record.repository'
import { treatmentPhotoBulkCreateRequestSchema } from '../schemas/treatment-photo.schema'
import { type DomainError, DomainErrors } from '../shared'
import { actors } from './auth-fixtures'
import { brokenRules, SALON_ID } from './fixtures'
import {
  dbTreatmentPhoto,
  PHOTO_ID,
  TREATMENT_RECORD_ID,
  treatmentPhotoCreateRequest,
  treatmentRecordDependencies,
} from './treatment-record-fixtures'

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

/** An addition of the photos given, each of its own address and place. */
const additionOf = (...photos: Record<string, unknown>[]) => ({
  photos: photos.map((photo, index) => ({
    ...treatmentPhotoCreateRequest({
      photoUrl: `https://images.example.com/${index}.jpg`,
      sortOrder: index,
    }),
    ...photo,
  })),
})

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** Whether the repository was asked nothing. */
const untouched = ({
  treatmentRecordRepository,
}: TreatmentRecordUseCaseDependencies): boolean =>
  Object.values(treatmentRecordRepository).every(
    (method) => vi.mocked(method).mock.calls.length === 0,
  )

const everySalon = { type: 'everySalon' }
const ownSalon = { type: 'salon', salonId: SALON_ID }

/** Everyone who writes the records of the salon of the fixtures, and their reach. */
const writers: [string, Actor, object][] = [
  ['an administrator', actors.admin, everySalon],
  ['an owner', actors.ofSalon('owner'), ownSalon],
  ['a manager', actors.ofSalon('manager'), ownSalon],
  ['a staff member', actors.ofSalon('staff'), ownSalon],
]

/** Actors who reach no records at all. */
const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer account without a profile', actors.customerWithoutProfile],
  ['an account of no scope', actors.withoutScope],
]

describe('treatmentPhotoBulkCreateRequestSchema', () => {
  it('takes an addition that states everything, and gives it back as it is', () => {
    const addition = { photos: [treatmentPhotoCreateRequest()] }

    expect(treatmentPhotoBulkCreateRequestSchema.parse(addition)).toEqual(
      addition,
    )
  })

  it('takes every kind of photo, null for what a photo may leave unstated, and a private photo without consent', () => {
    const addition = additionOf(
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
    const addition = additionOf(
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
      additionOf(...Array.from({ length: count }, () => ({})))

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
      brokenBy(treatmentPhotoBulkCreateRequestSchema, additionOf(photo)),
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
        additionOf({ photoUrl: null, isPublic: null }),
      ),
    ).toEqual([
      'photos.0.photoUrl:invalid_type',
      'photos.0.isPublic:invalid_type',
    ])
    expect(
      brokenBy(treatmentPhotoBulkCreateRequestSchema, {
        ...additionOf({}),
        recordId: TREATMENT_RECORD_ID,
      }),
    ).toEqual([':unrecognized_keys'])
  })

  it('tells a public photo without consent so, and keeps a private one without consent', () => {
    expect(
      messagesOf(
        treatmentPhotoBulkCreateRequestSchema,
        additionOf({ isPublic: true, customerConsent: false }),
      ),
    ).toEqual(['photos.0.isPublic:Must have the consent of the customer'])
  })

  it('refuses each later photo of the address or the place of an earlier one, and tells which', () => {
    const shared = 'https://images.example.com/shared.jpg'
    const addition = additionOf(
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
    const addition = additionOf(
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

describe('photoAdditionRefusal', () => {
  const addresses = (count: number, from = 0): string[] =>
    Array.from(
      { length: count },
      (_, index) => `https://images.example.com/${from + index}.jpg`,
    )
  const photosAt = (urls: string[]) => urls.map((photoUrl) => ({ photoUrl }))

  it('takes photos up to the most a record holds, counting those it holds', () => {
    expect(MAX_PHOTOS_OF_RECORD).toBe(20)
    expect(photoAdditionRefusal([], photosAt(addresses(20)))).toBeNull()
    expect(
      photoAdditionRefusal(addresses(15), photosAt(addresses(5, 15))),
    ).toBeNull()
  })

  it('refuses a photo beyond the most, and tells how many the record holds', () => {
    expect(
      photoAdditionRefusal(addresses(15), photosAt(addresses(6, 15))),
    ).toEqual({ type: 'tooManyPhotos', held: 15 })
    expect(
      photoAdditionRefusal(addresses(20), photosAt(addresses(1, 20))),
    ).toEqual({ type: 'tooManyPhotos', held: 20 })
  })

  it('refuses the first photo at an address the record holds, before it counts', () => {
    const held = addresses(18)

    expect(
      photoAdditionRefusal(
        held,
        photosAt([
          'https://images.example.com/new.jpg',
          held[9] ?? '',
          held[3] ?? '',
        ]),
      ),
    ).toEqual({ type: 'photoExists', photoUrl: held[9] })
  })
})

describe('TreatmentRecordWriteMapper.fromPhotoBulkCreateRequest', () => {
  it('writes every column of each photo as the request names it, in its order', () => {
    const request = treatmentPhotoBulkCreateRequestSchema.parse(
      additionOf(
        { photoType: 'before', isPublic: false, customerConsent: true },
        { angle: null, description: null, thumbnailUrl: null },
      ),
    )

    expect(
      TreatmentRecordWriteMapper.fromPhotoBulkCreateRequest(request),
    ).toEqual([
      {
        photoType: 'before',
        photoUrl: 'https://images.example.com/0.jpg',
        thumbnailUrl: 'https://images.example.com/after-small.jpg',
        angle: 'side',
        description: '毛先まで色が入った',
        isPublic: false,
        customerConsent: true,
        sortOrder: 0,
      },
      {
        photoType: 'after',
        photoUrl: 'https://images.example.com/1.jpg',
        thumbnailUrl: null,
        angle: null,
        description: null,
        isPublic: true,
        customerConsent: true,
        sortOrder: 1,
      },
    ])
  })
})

describe('TreatmentRecordReadMapper.toApiPhotos', () => {
  it('shows each photo with its ID and without its record and time, in the order given', () => {
    const later: DbTreatmentPhoto = {
      ...dbTreatmentPhoto(),
      id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d22',
      photoType: 'before',
      photoUrl: 'https://images.example.com/before.jpg',
      thumbnailUrl: 'https://images.example.com/before-small.jpg',
      angle: null,
      description: '退色',
      isPublic: true,
      sortOrder: 5,
    }

    expect(
      TreatmentRecordReadMapper.toApiPhotos([later, dbTreatmentPhoto()]),
    ).toEqual([
      {
        id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f5d22',
        photoType: 'before',
        photoUrl: 'https://images.example.com/before.jpg',
        thumbnailUrl: 'https://images.example.com/before-small.jpg',
        angle: null,
        description: '退色',
        isPublic: true,
        customerConsent: true,
        sortOrder: 5,
      },
      {
        id: PHOTO_ID,
        photoType: 'after',
        photoUrl: 'https://images.example.com/after.jpg',
        thumbnailUrl: null,
        angle: 'side',
        description: null,
        isPublic: false,
        customerConsent: true,
        sortOrder: 0,
      },
    ])
  })
})

describe('AddTreatmentPhotosUseCase', () => {
  const add = (
    dependencies: TreatmentRecordUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = TREATMENT_RECORD_ID,
    input: unknown = additionOf({}),
  ) => new AddTreatmentPhotosUseCase(dependencies).execute(actor, id, input)

  const adding = (outcome: TreatmentPhotoAddition) =>
    treatmentRecordDependencies({
      addPhotos: vi.fn(async () => Result.success(outcome)),
    })

  it.each(writers)(
    'adds the photos to a record within the reach of %s, in the order of the request, and answers them with the record',
    async (_who, actor, reach) => {
      const dependencies = treatmentRecordDependencies()

      const result = await add(
        dependencies,
        actor,
        TREATMENT_RECORD_ID.toUpperCase(),
        additionOf({ photoType: 'before' }, {}),
      )

      expect(result).toEqual(
        Result.success({
          recordId: TREATMENT_RECORD_ID,
          response: {
            created: [expect.objectContaining({ id: PHOTO_ID })],
          },
        }),
      )
      expect(
        dependencies.treatmentRecordRepository.addPhotos,
      ).toHaveBeenCalledWith(reach, TREATMENT_RECORD_ID, [
        expect.objectContaining({
          photoType: 'before',
          photoUrl: 'https://images.example.com/0.jpg',
          sortOrder: 0,
        }),
        expect.objectContaining({
          photoType: 'after',
          photoUrl: 'https://images.example.com/1.jpg',
          sortOrder: 1,
        }),
      ])
    },
  )

  it.each(outsiders)(
    'refuses %s before the ID and the request are read',
    async (_who, actor) => {
      const dependencies = treatmentRecordDependencies()

      expect(await add(dependencies, actor, 'not-an-id', null)).toEqual(
        forbidden,
      )
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses an ID that is no UUID before the request, and a request that breaks a rule of its own', async () => {
    const dependencies = treatmentRecordDependencies()

    expect(
      rulesOf(await add(dependencies, actors.admin, 'TR-1', null)),
    ).toEqual(['id:invalid_format'])
    const refused = await add(
      dependencies,
      actors.admin,
      TREATMENT_RECORD_ID,
      additionOf({ isPublic: true, customerConsent: false }),
    )
    expect(refused).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: 'Invalid treatment photos' },
    })
    expect(rulesOf(refused)).toEqual(['photos.0.isPublic:custom'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find a record that is not there, or not within the reach', async () => {
    expect(await add(adding({ type: 'notFound' }))).toEqual(
      Result.error(
        DomainErrors.notFound('TreatmentRecord', TREATMENT_RECORD_ID),
      ),
    )
  })

  it('refuses a photo at an address the record holds with a conflict that names it', async () => {
    expect(
      await add(
        adding({
          type: 'refused',
          refusal: {
            type: 'photoExists',
            photoUrl: 'https://images.example.com/0.jpg',
          },
        }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          'The record holds a photo at https://images.example.com/0.jpg already; a record holds one photo of an address',
        ),
      ),
    )
  })

  it('refuses photos beyond the most with a conflict that says how many the record holds', async () => {
    expect(
      await add(
        adding({
          type: 'refused',
          refusal: { type: 'tooManyPhotos', held: 19 },
        }),
      ),
    ).toEqual(
      Result.error(
        DomainErrors.conflict(
          'The record holds 19 photos; a record holds at most 20',
        ),
      ),
    )
  })

  it('passes on what the database could not do', async () => {
    expect(
      await add(
        treatmentRecordDependencies({
          addPhotos: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
  })
})

describe('RemoveTreatmentPhotoUseCase', () => {
  const remove = (
    dependencies: TreatmentRecordUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = TREATMENT_RECORD_ID,
    photoId: unknown = PHOTO_ID,
  ) => new RemoveTreatmentPhotoUseCase(dependencies).execute(actor, id, photoId)

  const removing = (outcome: TreatmentPhotoRemoval) =>
    treatmentRecordDependencies({
      removePhoto: vi.fn(async () => Result.success(outcome)),
    })

  it.each(writers)(
    'removes a photo of a record within the reach of %s, and answers its ID',
    async (_who, actor, reach) => {
      const dependencies = treatmentRecordDependencies()

      expect(
        await remove(
          dependencies,
          actor,
          TREATMENT_RECORD_ID.toUpperCase(),
          PHOTO_ID.toUpperCase(),
        ),
      ).toEqual(Result.success(PHOTO_ID))
      expect(
        dependencies.treatmentRecordRepository.removePhoto,
      ).toHaveBeenCalledWith(reach, TREATMENT_RECORD_ID, PHOTO_ID)
    },
  )

  it.each(outsiders)(
    'refuses %s before the IDs are looked at',
    async (_who, actor) => {
      const dependencies = treatmentRecordDependencies()

      expect(await remove(dependencies, actor, 'TR-1', 'P-1')).toEqual(
        forbidden,
      )
      expect(untouched(dependencies)).toBe(true)
    },
  )

  it('refuses IDs that are no UUIDs, each by its own name', async () => {
    const dependencies = treatmentRecordDependencies()

    const both = await remove(dependencies, actors.admin, 'TR-1', 'P-1')
    expect(both).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: 'Invalid treatment photo ID' },
    })
    expect(rulesOf(both)).toEqual([
      'id:invalid_format',
      'photoId:invalid_format',
    ])
    expect(
      rulesOf(
        await remove(dependencies, actors.admin, TREATMENT_RECORD_ID, 'P-1'),
      ),
    ).toEqual(['photoId:invalid_format'])
    expect(untouched(dependencies)).toBe(true)
  })

  it('does not find a record that is not there or not within the reach, nor a photo the record does not hold', async () => {
    expect(await remove(removing({ type: 'recordNotFound' }))).toEqual(
      Result.error(
        DomainErrors.notFound('TreatmentRecord', TREATMENT_RECORD_ID),
      ),
    )
    expect(await remove(removing({ type: 'photoNotFound' }))).toEqual(
      Result.error(DomainErrors.notFound('TreatmentPhoto', PHOTO_ID)),
    )
  })

  it('passes on what the database could not do', async () => {
    expect(
      await remove(
        treatmentRecordDependencies({
          removePhoto: vi.fn(async () => databaseDown),
        }),
      ),
    ).toEqual(databaseDown)
  })
})
