import { Result } from '@beauty-salon-backend/utility'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { salonMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  dbOpeningHours,
  dbSalon,
  OTHER_SALON_ID,
  salonRepositoryWith as repositoryWith,
  SALON_ID,
  salonCreateRequest,
} from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import type { SalonDeletion } from '../../../repositories/salon.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CreateSalonUseCase,
  DeleteSalonUseCase,
  GetSalonUseCase,
  ListSalonsUseCase,
  UpdateSalonUseCase,
} from '..'

const stored = { salon: dbSalon(), openingHours: [dbOpeningHours()] }
const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

describe('CreateSalonUseCase', () => {
  it('saves the mapped salon with its calendar and returns the stored salon', async () => {
    const salonRepository = repositoryWith()
    const request = salonCreateRequest()

    const result = await new CreateSalonUseCase({ salonRepository }).execute(
      actors.admin,
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

    const result = await new CreateSalonUseCase({ salonRepository }).execute(
      actors.admin,
      {
        ...salonCreateRequest(),
        email: 'nope',
      },
    )

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
    }).execute(actors.admin, input)

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
      actors.admin,
      salonCreateRequest(),
    )

    expect(result).toEqual({ type: 'error', error: taken })
  })

  it('passes on a database error', async () => {
    const salonRepository = repositoryWith({ create: async () => databaseDown })

    const result = await new CreateSalonUseCase({ salonRepository }).execute(
      actors.admin,
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

  it('looks the salon up by the lower-case ID when the request writes it in upper case', async () => {
    const salonRepository = repositoryWith()

    const result = await new GetSalonUseCase({ salonRepository }).execute(
      SALON_ID.toUpperCase(),
    )

    expect(salonRepository.findById).toHaveBeenCalledWith(SALON_ID)
    expect(result.type).toBe('success')
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

  it('reads a cursor written in upper case as the lower-case ID', async () => {
    const salonRepository = repositoryWith()

    const result = await new ListSalonsUseCase({ salonRepository }).execute({
      cursor: OTHER_SALON_ID.toUpperCase(),
    })

    expect(salonRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ after: OTHER_SALON_ID }),
    )
    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { cursor: OTHER_SALON_ID } },
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
      actors.admin,
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

    await new UpdateSalonUseCase({ salonRepository }).execute(
      actors.admin,
      SALON_ID,
      {
        openingHours: [],
      },
    )

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
        actors.admin,
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
      actors.admin,
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
      actors.admin,
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
      actors.admin,
      SALON_ID,
    )

    expect(salonRepository.delete).toHaveBeenCalledWith(SALON_ID)
    expect(result).toEqual({ type: 'success', data: SALON_ID })
  })

  it('rejects an ID that is not a UUID without touching the repository', async () => {
    const salonRepository = repositoryWith()

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      actors.admin,
      'latest',
    )

    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
      'id:invalid_format',
    ])
    expect(salonRepository.delete).not.toHaveBeenCalled()
  })

  it('reports a salon that does not exist, or is already deleted, as not found', async () => {
    const salonRepository = repositoryWith({
      delete: async () => Result.success<SalonDeletion>({ type: 'notFound' }),
    })

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      actors.admin,
      SALON_ID,
    )

    expect(result).toEqual({
      type: 'error',
      error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
    })
  })

  it('refuses to delete a salon that has bookings that are not finished as a conflict', async () => {
    const salonRepository = repositoryWith({
      delete: async () =>
        Result.success<SalonDeletion>({ type: 'bookingsUnfinished' }),
    })

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      actors.admin,
      SALON_ID,
    )

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message:
          'The salon cannot be deleted: bookings that are not finished refer to it',
      },
    })
  })

  it('passes on a database error', async () => {
    const salonRepository = repositoryWith({ delete: async () => databaseDown })

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      actors.admin,
      SALON_ID,
    )

    expect(result).toEqual(databaseDown)
  })
})

describe('who may change a salon', () => {
  const forbidden = Result.error(DomainErrors.forbidden())

  const ownerOfOtherSalon = actors.ofSalon('owner', OTHER_SALON_ID)
  const managerOfOtherSalon = actors.ofSalon('manager', OTHER_SALON_ID)

  it.each<[string, Actor]>([
    ['the owner of a salon', actors.ofSalon('owner')],
    ['the manager of a salon', actors.ofSalon('manager')],
    ['a staff member', actors.ofSalon('staff')],
    ['a customer', actors.customer],
    ['a user without a scope', actors.withoutScope],
  ])(
    'forbids %s to create a salon without touching the repository',
    async (_case, actor) => {
      const salonRepository = repositoryWith()

      const result = await new CreateSalonUseCase({ salonRepository }).execute(
        actor,
        salonCreateRequest(),
      )

      expect(result).toEqual(forbidden)
      expect(salonRepository.create).not.toHaveBeenCalled()
    },
  )

  it('forbids a creation before validating it', async () => {
    const salonRepository = repositoryWith()

    const result = await new CreateSalonUseCase({ salonRepository }).execute(
      actors.ofSalon('owner'),
      { ...salonCreateRequest(), email: 'nope' },
    )

    expect(result).toEqual(forbidden)
  })

  it.each<[string, Actor]>([
    ['an admin', actors.admin],
    ['the owner of the salon', actors.ofSalon('owner', SALON_ID)],
    ['a manager of the salon', actors.ofSalon('manager', SALON_ID)],
  ])('lets %s change the salon', async (_case, actor) => {
    const salonRepository = repositoryWith()

    const result = await new UpdateSalonUseCase({ salonRepository }).execute(
      actor,
      SALON_ID,
      { name: 'Renamed' },
    )

    expect(result.type).toBe('success')
    expect(salonRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      { name: 'Renamed' },
      { type: 'keep' },
    )
  })

  it.each<[string, Actor]>([
    ['the owner of the salon', actors.ofSalon('owner', SALON_ID)],
    ['a manager of the salon', actors.ofSalon('manager', SALON_ID)],
  ])(
    'lets %s change the salon when the request writes its ID in upper case',
    async (_case, actor) => {
      const salonRepository = repositoryWith()

      const result = await new UpdateSalonUseCase({ salonRepository }).execute(
        actor,
        SALON_ID.toUpperCase(),
        { name: 'Renamed' },
      )

      expect(result.type).toBe('success')
      expect(salonRepository.update).toHaveBeenCalledWith(
        SALON_ID,
        { name: 'Renamed' },
        { type: 'keep' },
      )
    },
  )

  it.each<[string, Actor]>([
    ['the owner of another salon', ownerOfOtherSalon],
    ['a manager of another salon', managerOfOtherSalon],
    ['a staff member of the salon', actors.ofSalon('staff', SALON_ID)],
    ['a customer', actors.customer],
    ['a user without a scope', actors.withoutScope],
  ])(
    'forbids %s to change the salon without looking it up',
    async (_case, actor) => {
      const salonRepository = repositoryWith()

      const result = await new UpdateSalonUseCase({ salonRepository }).execute(
        actor,
        SALON_ID,
        { name: 'Renamed' },
      )

      expect(result).toEqual(forbidden)
      expect(salonRepository.update).not.toHaveBeenCalled()
    },
  )

  it.each<[string, Actor]>([
    ['an admin', actors.admin],
    ['the owner of another salon', ownerOfOtherSalon],
    ['a staff member', actors.ofSalon('staff')],
    ['a customer', actors.customer],
    ['a user without a scope', actors.withoutScope],
  ])(
    'rejects an ID that is not a UUID from %s as invalid',
    async (_case, actor) => {
      const result = await new UpdateSalonUseCase({
        salonRepository: repositoryWith(),
      }).execute(actor, 'latest', { name: 'Renamed' })

      expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
        'id:invalid_format',
      ])
    },
  )

  it.each<[string, Actor]>([
    ['an admin', actors.admin],
    ['the owner of the salon', actors.ofSalon('owner', SALON_ID)],
  ])('lets %s delete the salon', async (_case, actor) => {
    const salonRepository = repositoryWith()

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      actor,
      SALON_ID,
    )

    expect(result).toEqual({ type: 'success', data: SALON_ID })
  })

  it('lets the owner delete the salon when the request writes its ID in upper case', async () => {
    const salonRepository = repositoryWith()

    const result = await new DeleteSalonUseCase({ salonRepository }).execute(
      actors.ofSalon('owner', SALON_ID),
      SALON_ID.toUpperCase(),
    )

    expect(result).toEqual({ type: 'success', data: SALON_ID })
    expect(salonRepository.delete).toHaveBeenCalledWith(SALON_ID)
  })

  it.each<[string, Actor]>([
    ['a manager of the salon', actors.ofSalon('manager', SALON_ID)],
    ['the owner of another salon', ownerOfOtherSalon],
    ['a staff member of the salon', actors.ofSalon('staff', SALON_ID)],
    ['a customer', actors.customer],
    ['a user without a scope', actors.withoutScope],
  ])(
    'forbids %s to delete the salon without touching the repository',
    async (_case, actor) => {
      const salonRepository = repositoryWith()

      const result = await new DeleteSalonUseCase({ salonRepository }).execute(
        actor,
        SALON_ID,
      )

      expect(result).toEqual(forbidden)
      expect(salonRepository.delete).not.toHaveBeenCalled()
    },
  )
})

describe('the headline of a refused salon request', () => {
  const dependencies = { salonRepository: repositoryWith() }

  it.each<[string, () => Promise<Result<unknown, DomainError>>, LocalizedText]>(
    [
      [
        'a salon',
        () => new CreateSalonUseCase(dependencies).execute(actors.admin, {}),
        salonMessages.invalidSalon,
      ],
      [
        'a change of a salon',
        () =>
          new UpdateSalonUseCase(dependencies).execute(
            actors.admin,
            SALON_ID,
            {},
          ),
        salonMessages.invalidSalonUpdate,
      ],
      [
        'a search for salons',
        () => new ListSalonsUseCase(dependencies).execute({ limit: 0 }),
        salonMessages.invalidSalonSearch,
      ],
      [
        'the ID of a salon to read',
        () => new GetSalonUseCase(dependencies).execute('latest'),
        salonMessages.invalidSalonId,
      ],
      [
        'the ID of a salon to delete',
        () =>
          new DeleteSalonUseCase(dependencies).execute(actors.admin, 'latest'),
        salonMessages.invalidSalonId,
      ],
    ],
  )(
    'should be that of %s, in every language',
    async (_what, refused, headline) => {
      // Act
      const result = await refused()

      // Assert
      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation', message: headline },
      })
    },
  )
})
