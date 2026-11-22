import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import { brokenRules, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import {
  PHOTO_ID,
  TREATMENT_RECORD_ID,
  treatmentPhotoBulkCreateRequest,
  treatmentRecordDependencies,
} from '../../../__tests__/fixtures/treatment-record-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  TreatmentPhotoAddition,
  TreatmentPhotoRemoval,
} from '../../../repositories/treatment-record.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  AddTreatmentPhotosUseCase,
  RemoveTreatmentPhotoUseCase,
  type TreatmentRecordUseCaseDependencies,
} from '..'
import { MAX_PHOTOS_OF_RECORD, photoAdditionRefusal } from '../_shared/photos'

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

describe('AddTreatmentPhotosUseCase', () => {
  const add = (
    dependencies: TreatmentRecordUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = TREATMENT_RECORD_ID,
    input: unknown = treatmentPhotoBulkCreateRequest({}),
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
        treatmentPhotoBulkCreateRequest({ photoType: 'before' }, {}),
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
      treatmentPhotoBulkCreateRequest({
        isPublic: true,
        customerConsent: false,
      }),
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
