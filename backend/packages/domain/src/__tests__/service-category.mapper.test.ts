import { describe, expect, it } from 'vitest'
import { ServiceCategoryReadMapper } from '../mappers/read/service-category.mapper'
import { ServiceCategoryWriteMapper } from '../mappers/write/service-category.mapper'
import { salonIdSchema } from '../models/salon'
import { categoryIdSchema } from '../models/service-category'
import { serviceCategorySearchRequestSchema } from '../schemas/service-category.schema'
import { SALON_ID } from './fixtures'
import {
  CATEGORY_ID,
  dbServiceCategory,
  OTHER_CATEGORY_ID,
  serviceCategoryCreateRequest,
} from './service-category-fixtures'

describe('ServiceCategoryReadMapper.toApiServiceCategory', () => {
  it('returns every column under its own name, with the timestamps in ISO 8601 UTC', () => {
    const result = ServiceCategoryReadMapper.toApiServiceCategory(
      dbServiceCategory({
        description: 'Cuts for every length',
        parentId: OTHER_CATEGORY_ID,
        iconUrl: 'https://aoyama.example.com/icons/cut.svg',
      }),
    )

    expect(result).toEqual({
      type: 'success',
      data: {
        id: CATEGORY_ID,
        salonId: SALON_ID,
        name: 'カット',
        description: 'Cuts for every length',
        parentId: OTHER_CATEGORY_ID,
        category: 'cut',
        displayOrder: 10,
        iconUrl: 'https://aoyama.example.com/icons/cut.svg',
        color: '#FF8800',
        isActive: true,
        createdAt: '2026-11-14T09:00:00.123Z',
        updatedAt: '2026-11-14T09:30:00.000Z',
      },
    })
  })

  it('has exactly the properties of ServiceCategoryResponse', () => {
    const result = ServiceCategoryReadMapper.toApiServiceCategory(
      dbServiceCategory(),
    )

    expect(
      Object.keys(result.type === 'success' ? result.data : {}).toSorted(),
    ).toEqual([
      'category',
      'color',
      'createdAt',
      'description',
      'displayOrder',
      'iconUrl',
      'id',
      'isActive',
      'name',
      'parentId',
      'salonId',
      'updatedAt',
    ])
  })

  it('keeps null as null', () => {
    const unset = {
      description: null,
      parentId: null,
      iconUrl: null,
      color: null,
    }

    const result = ServiceCategoryReadMapper.toApiServiceCategory(
      dbServiceCategory(unset),
    )

    expect(result).toMatchObject({ type: 'success', data: unset })
  })

  it('keeps false, zero and text as they are stored', () => {
    const stored = {
      name: '  Colour & Care  ',
      displayOrder: 0,
      isActive: false,
      color: '#ff8800',
    }

    const result = ServiceCategoryReadMapper.toApiServiceCategory(
      dbServiceCategory(stored),
    )

    expect(result).toMatchObject({ type: 'success', data: stored })
  })

  it.each([
    [
      'a timestamp with microseconds in another time zone',
      '2026-11-15 08:59:59.999999+09',
      '2026-11-14T23:59:59.999Z',
    ],
    [
      'a timestamp without a fraction',
      '2026-01-01 00:00:00+00',
      '2026-01-01T00:00:00.000Z',
    ],
  ])('writes %s in ISO 8601 UTC', (_case, stored, expected) => {
    const result = ServiceCategoryReadMapper.toApiServiceCategory(
      dbServiceCategory({ createdAt: stored, updatedAt: stored }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { createdAt: expected, updatedAt: expected },
    })
  })

  it.each([
    ['a creation time that is not a timestamp', { createdAt: 'yesterday' }],
    ['an update time that is not a timestamp', { updatedAt: '' }],
  ])(
    'reports %s as a database error, not as a bad request',
    (_case, stored) => {
      const result = ServiceCategoryReadMapper.toApiServiceCategory(
        dbServiceCategory(stored),
      )

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'database' },
      })
    },
  )
})

describe('ServiceCategoryReadMapper.toApiServiceCategories', () => {
  it('maps every category, in order', () => {
    const result = ServiceCategoryReadMapper.toApiServiceCategories([
      dbServiceCategory({ id: OTHER_CATEGORY_ID, name: 'カラー' }),
      dbServiceCategory(),
    ])

    expect(result).toMatchObject({
      type: 'success',
      data: [
        {
          id: OTHER_CATEGORY_ID,
          name: 'カラー',
          createdAt: '2026-11-14T09:00:00.123Z',
        },
        { id: CATEGORY_ID, name: 'カット' },
      ],
    })
  })

  it('maps no category to an empty list', () => {
    expect(ServiceCategoryReadMapper.toApiServiceCategories([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('fails as a whole when one stored category is invalid', () => {
    const result = ServiceCategoryReadMapper.toApiServiceCategories([
      dbServiceCategory(),
      dbServiceCategory({ id: OTHER_CATEGORY_ID, updatedAt: 'recently' }),
    ])

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('ServiceCategoryReadMapper.toApiServiceCategoryPage', () => {
  it('answers with the categories of the list and where the list goes on', () => {
    const result = ServiceCategoryReadMapper.toApiServiceCategoryPage(
      {
        categories: [
          dbServiceCategory(),
          dbServiceCategory({ id: OTHER_CATEGORY_ID }),
        ],
        total: 4,
        hasMore: true,
      },
      { limit: 2, after: categoryIdSchema.parse(CATEGORY_ID) },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: CATEGORY_ID }, { id: OTHER_CATEGORY_ID }],
        meta: {
          total: 4,
          limit: 2,
          hasMore: true,
          cursor: CATEGORY_ID,
          nextCursor: OTHER_CATEGORY_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('fails as a whole when one stored category is invalid', () => {
    const result = ServiceCategoryReadMapper.toApiServiceCategoryPage(
      {
        categories: [dbServiceCategory({ updatedAt: 'recently' })],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('ServiceCategoryWriteMapper.fromCreateRequest', () => {
  it('writes every property to the column of its name, as it is', () => {
    expect(
      ServiceCategoryWriteMapper.fromCreateRequest(
        serviceCategoryCreateRequest(),
      ),
    ).toStrictEqual(serviceCategoryCreateRequest())
  })

  it('keeps null as null', () => {
    const request = {
      ...serviceCategoryCreateRequest(),
      description: null,
      iconUrl: null,
      color: null,
    }

    expect(ServiceCategoryWriteMapper.fromCreateRequest(request)).toStrictEqual(
      request,
    )
  })
})

describe('ServiceCategoryWriteMapper.fromUpdateRequest', () => {
  it('changes only the properties that are present', () => {
    expect(
      ServiceCategoryWriteMapper.fromUpdateRequest({
        name: 'カラー',
        isActive: false,
      }),
    ).toStrictEqual({ name: 'カラー', isActive: false })
  })

  it('clears a nullable column when the property is null', () => {
    expect(
      ServiceCategoryWriteMapper.fromUpdateRequest({ parentId: null }),
    ).toStrictEqual({ parentId: null })
  })
})

describe('ServiceCategoryWriteMapper.fromSearchRequest', () => {
  const salonId = salonIdSchema.parse(SALON_ID)

  it('asks for the first 20 categories of the salon when the request names nothing', () => {
    expect(ServiceCategoryWriteMapper.fromSearchRequest({}, salonId)).toEqual({
      salonId: SALON_ID,
      limit: 20,
      after: null,
      isActive: null,
    })
  })

  it('takes the place and the filter the request names, as they are', () => {
    const request = serviceCategorySearchRequestSchema.parse({
      limit: 3,
      cursor: CATEGORY_ID,
      isActive: false,
    })

    expect(
      ServiceCategoryWriteMapper.fromSearchRequest(request, salonId),
    ).toEqual({
      salonId: SALON_ID,
      limit: 3,
      after: CATEGORY_ID,
      isActive: false,
    })
  })
})
