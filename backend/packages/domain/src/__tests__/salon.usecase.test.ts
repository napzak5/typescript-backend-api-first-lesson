import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  CreateSalonUseCase,
  DeleteSalonUseCase,
  GetSalonUseCase,
  ListSalonsUseCase,
  UpdateSalonUseCase,
} from '../business-logic/salon'
import type { ISalonRepository } from '../repositories/salon.repository'
import { DomainErrors } from '../shared'
import {
  brokenRules,
  dbOpeningHours,
  dbSalon,
  OTHER_SALON_ID,
  SALON_ID,
  salonCreateRequest,
} from './fixtures'

const stored = { salon: dbSalon(), openingHours: [dbOpeningHours()] }
const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

/** A repository that holds one salon; a test overrides what it needs. */
const repositoryWith = (
  overrides: Partial<ISalonRepository> = {},
): ISalonRepository => ({
  create: vi.fn(async () => Result.success(stored)),
  findById: vi.fn(async () => Result.success(stored)),
  list: vi.fn(async () =>
    Result.success({ salons: [stored], total: 1, hasMore: false }),
  ),
  update: vi.fn(async () => Result.success(stored)),
  delete: vi.fn(async () => Result.success(true)),
  ...overrides,
})

describe('CreateSalonUseCase', () => {
  it('saves the mapped salon with its calendar and returns the stored salon', async () => {
    const salonRepository = repositoryWith()
    const request = salonCreateRequest()

    const result = await new CreateSalonUseCase({ salonRepository }).execute(
      request,
    )

    expect(salonRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: request.name, taxRate: '10' }),
      request.openingHours,
    )
    expect(result).toMatchObject({
      type: 'success',
      data: {
        id: SALON_ID,
        taxRate: 10,
        openingHours: [{ date: '2026-11-16' }],
      },
    })
  })

  it('rejects an invalid request without touching the repository', async () => {
    const salonRepository = repositoryWith()

    const result = await new CreateSalonUseCase({ salonRepository }).execute({
      ...salonCreateRequest(),
      email: 'nope',
    })

    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
      'email:invalid_format',
    ])
    expect(salonRepository.create).not.toHaveBeenCalled()
  })

  it.each([
    ['a body that is not an object', 'name=Aoyama'],
    ['a missing body', undefined],
  ])('rejects %s', async (_case, input) => {
    const result = await new CreateSalonUseCase({
      salonRepository: repositoryWith(),
    }).execute(input)

    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
      ':invalid_type',
    ])
  })

  it('passes on the error when the email is already taken', async () => {
    const taken = DomainErrors.alreadyExists(
      'Salon',
      'email',
      'aoyama@example.com',
    )
    const salonRepository = repositoryWith({
      create: async () => Result.error(taken),
    })

    const result = await new CreateSalonUseCase({ salonRepository }).execute(
      salonCreateRequest(),
    )

    expect(result).toEqual({ type: 'error', error: taken })
  })

  it('passes on a database error', async () => {
    const salonRepository = repositoryWith({ create: async () => databaseDown })

    const result = await new CreateSalonUseCase({ salonRepository }).execute(
      salonCreateRequest(),
    )

    expect(result).toEqual(databaseDown)
  })
})

describe('GetSalonUseCase', () => {
  it('returns the salon', async () => {
    const salonRepository = repositoryWith()

    const result = await new GetSalonUseCase({ salonRepository }).execute(
      SALON_ID,
    )

    expect(salonRepository.findById).toHaveBeenCalledWith(SALON_ID)
    expect(result).toMatchObject({ type: 'success', data: { id: SALON_ID } })
  })

  it('rejects an ID that is not a UUID without touching the repository', async () => {
    const salonRepository = repositoryWith()

    const result = await new GetSalonUseCase({ salonRepository }).execute('42')

    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
      'id:invalid_format',
    ])
    expect(salonRepository.findById).not.toHaveBeenCalled()
  })

  it('reports a salon that does not exist as not found', async () => {
    const salonRepository = repositoryWith({
      findById: async () => Result.success(null),
    })

    const result = await new GetSalonUseCase({ salonRepository }).execute(
      SALON_ID,
    )

    expect(result).toEqual({
      type: 'error',
      error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
    })
  })

  it('reports a stored salon that cannot be presented as a database error', async () => {
    const salonRepository = repositoryWith({
      findById: async () =>
        Result.success({
          salon: dbSalon({ taxRate: 'ten' }),
          openingHours: [],
        }),
    })

    const result = await new GetSalonUseCase({ salonRepository }).execute(
      SALON_ID,
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })

  it('passes on a database error', async () => {
    const salonRepository = repositoryWith({
      findById: async () => databaseDown,
    })

    const result = await new GetSalonUseCase({ salonRepository }).execute(
      SALON_ID,
    )

    expect(result).toEqual(databaseDown)
  })
})

describe('ListSalonsUseCase', () => {
  it('lists 20 salons from the newest without filters by default', async () => {
    const salonRepository = repositoryWith()

    const result = await new ListSalonsUseCase({ salonRepository }).execute({})

    expect(salonRepository.list).toHaveBeenCalledWith({
      limit: 20,
      after: null,
      keyword: null,
      prefecture: null,
      city: null,
      isActive: null,
      minRating: null,
      features: [],
    })
    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: SALON_ID }],
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('passes every filter on and continues after the cursor', async () => {
    const salonRepository = repositoryWith()

    await new ListSalonsUseCase({ salonRepository }).execute({
      limit: 5,
      cursor: OTHER_SALON_ID,
      keyword: 'aoyama',
      prefecture: '東京都',
      city: '港区',
      isActive: false,
      minRating: 4,
      features: ['color', 'kids'],
    })

    expect(salonRepository.list).toHaveBeenCalledWith({
      limit: 5,
      after: OTHER_SALON_ID,
      keyword: 'aoyama',
      prefecture: '東京都',
      city: '港区',
      isActive: false,
      minRating: 4,
      features: ['color', 'kids'],
    })
  })

  it('points the next cursor at the last salon of the page when more follow', async () => {
    const salonRepository = repositoryWith({
      list: async () =>
        Result.success({
          salons: [
            stored,
            { salon: dbSalon({ id: OTHER_SALON_ID }), openingHours: [] },
          ],
          total: 7,
          hasMore: true,
        }),
    })

    const result = await new ListSalonsUseCase({ salonRepository }).execute({
      limit: 2,
      cursor: SALON_ID,
    })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: SALON_ID,
          nextCursor: OTHER_SALON_ID,
        },
      },
    })
  })

  it('returns an empty page when nothing matches', async () => {
    const salonRepository = repositoryWith({
      list: async () =>
        Result.success({ salons: [], total: 0, hasMore: false }),
    })

    const result = await new ListSalonsUseCase({ salonRepository }).execute({
      keyword: 'nothing',
    })

    expect(result).toMatchObject({
      type: 'success',
      data: { data: [], meta: { total: 0, hasMore: false, nextCursor: null } },
    })
  })

  it('rejects an invalid search without touching the repository', async () => {
    const salonRepository = repositoryWith()

    const result = await new ListSalonsUseCase({ salonRepository }).execute({
      limit: 1000,
      sort: 'name',
    })

    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
      'limit:too_big',
      'sort:unrecognized_keys',
    ])
    expect(salonRepository.list).not.toHaveBeenCalled()
  })

  it('passes on a database error', async () => {
    const salonRepository = repositoryWith({ list: async () => databaseDown })

    const result = await new ListSalonsUseCase({ salonRepository }).execute({})

    expect(result).toEqual(databaseDown)
  })
})

describe('UpdateSalonUseCase', () => {
  it('applies the given properties and leaves the calendar alone', async () => {
    const salonRepository = repositoryWith()

    const result = await new UpdateSalonUseCase({ salonRepository }).execute(
      SALON_ID,
      { name: 'Renamed', latitude: null },
    )

    expect(salonRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      { name: 'Renamed', latitude: null },
      { type: 'keep' },
    )
    expect(result).toMatchObject({ type: 'success', data: { id: SALON_ID } })
  })

  it('replaces the calendar when openingHours is given', async () => {
    const salonRepository = repositoryWith()

    await new UpdateSalonUseCase({ salonRepository }).execute(SALON_ID, {
      openingHours: [],
    })

    expect(salonRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      {},
      { type: 'replace', openingHours: [] },
    )
  })

  it.each([
    [
      'an ID that is not a UUID',
      'abc',
      { name: 'Renamed' },
      ['id:invalid_format'],
    ],
    ['an empty request', SALON_ID, {}, [':custom']],
    [
      'an invalid value',
      SALON_ID,
      { currency: 'jpy' },
      ['currency:invalid_format'],
    ],
  ])(
    'rejects %s without touching the repository',
    async (_case, id, input, expected) => {
      const salonRepository = repositoryWith()

      const result = await new UpdateSalonUseCase({ salonRepository }).execute(
        id,
        input,
      )

      expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual(
        expected,
      )
      expect(salonRepository.update).not.toHaveBeenCalled()
    },
  )

  it('reports a salon that does not exist as not found', async () => {
    const salonRepository = repositoryWith({
      update: async () => Result.success(null),
    })

    const result = await new UpdateSalonUseCase({ salonRepository }).execute(
      SALON_ID,
      { name: 'Renamed' },
    )

    expect(result).toEqual({
      type: 'error',
      error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
    })
  })

  it('passes on the error when the new email is already taken', async () => {
    const taken = DomainErrors.alreadyExists(
      'Salon',
      'email',
      'other@example.com',
    )
    const salonRepository = repositoryWith({
      update: async () => Result.error(taken),
    })

    const result = await new UpdateSalonUseCase({ salonRepository }).execute(
      SALON_ID,
      { email: 'other@example.com' },
    )

    expect(result).toEqual({ type: 'error', error: taken })
  })
})

describe('DeleteSalonUseCase', () => {
  it('deletes the salon and returns its ID', async () => {
    const salonRepository = repositoryWith()

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      SALON_ID,
    )

    expect(salonRepository.delete).toHaveBeenCalledWith(SALON_ID)
    expect(result).toEqual({ type: 'success', data: SALON_ID })
  })

  it('rejects an ID that is not a UUID without touching the repository', async () => {
    const salonRepository = repositoryWith()

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      'latest',
    )

    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
      'id:invalid_format',
    ])
    expect(salonRepository.delete).not.toHaveBeenCalled()
  })

  it('reports a salon that does not exist, or is already deleted, as not found', async () => {
    const salonRepository = repositoryWith({
      delete: async () => Result.success(false),
    })

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      SALON_ID,
    )

    expect(result).toEqual({
      type: 'error',
      error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
    })
  })

  it('passes on a database error', async () => {
    const salonRepository = repositoryWith({ delete: async () => databaseDown })

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      SALON_ID,
    )

    expect(result).toEqual(databaseDown)
  })
})
