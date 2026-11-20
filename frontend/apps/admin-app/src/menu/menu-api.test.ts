import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { salon } from '../bookings/components/examples'
import type { ServicesRead } from '../salons/salons-api'
import { aCategory, aService } from './components/examples'
import {
  addCategory,
  addService,
  type CategoriesRead,
  changeCategory,
  changeService,
  mayKeepMenu,
  menuOf,
  readCategories,
  readCategory,
  readService,
  removeCategory,
  removeService,
} from './menu-api'

/*
 * What the API answers to the menu is met with the real API
 * (`menu.integration.test.tsx`). Here are the answers a test cannot bring
 * about there.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

type Answer = () => Response | Promise<Response>

const NOT_SENT: [string, Answer, string][] = [
  ['a body that is too large', () => problem(413), 'failed'],
  ['a body of another type', () => problem(415), 'failed'],
  ...UNREAD,
]

describe('mayKeepMenu', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should let %s change the menu: %s', (role, keeps) => {
    expect(mayKeepMenu(role)).toBe(keeps)
  })
})

describe('menuOf', () => {
  const categories: CategoriesRead = { type: 'found', items: [aCategory()] }
  const services: ServicesRead = { type: 'found', items: [aService()] }

  it('should make the menu of both lists', () => {
    expect(menuOf(categories, services)).toEqual({
      type: 'found',
      categories: [aCategory()],
      services: [aService()],
    })
  })

  it.each<[string, Parameters<typeof menuOf>, ReturnType<typeof menuOf>]>([
    ['the categories are read', [undefined, services], undefined],
    ['the services are read', [categories, undefined], undefined],
    [
      'the categories were not read, while the services are',
      [{ type: 'failed' }, undefined],
      { type: 'failed' },
    ],
    [
      'the services were not read, while the categories are',
      [undefined, { type: 'tooManyRequests' }],
      { type: 'tooManyRequests' },
    ],
    [
      'neither was read',
      [{ type: 'notFound' }, { type: 'failed' }],
      { type: 'notFound' },
    ],
  ])('should make no menu while %s', (_, [one, other], menu) => {
    expect(menuOf(one, other)).toEqual(menu)
  })
})

describe('readCategories', () => {
  it('should ask for the largest pages', async () => {
    // Arrange
    const asked: string[] = []
    answering((request) => {
      asked.push(new URL(request.url).search)
      return json(200, {
        data: [aCategory()],
        meta: { total: 1, nextCursor: null },
        links: { self: '/' },
      })
    })

    // Act
    const read = await readCategories(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', items: [aCategory()] })
    expect(asked).toEqual(['?limit=100'])
  })

  it.each<[string, Answer, string]>([
    [
      'a cursor whose category was removed meanwhile',
      () => problem(400),
      'failed',
    ],
    ...UNREAD,
  ])('should read no categories after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readCategories(salon.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readCategory', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no category', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should read no category after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readCategory(salon.id, 'x')

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readService', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no service', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should read no service after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readService(salon.id, 'x')

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('addCategory', () => {
  it.each<[string, Answer, string]>([
    ['a salon removed meanwhile', () => problem(404), 'notFound'],
    ...NOT_SENT,
  ])('should add no category after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const written = await addCategory(salon.id, {
      name: 'ネイル',
      description: null,
      parentId: null,
      category: 'other',
      displayOrder: 9,
      iconUrl: null,
      color: null,
      isActive: true,
    })

    // Assert
    expect(written).toEqual({ type })
  })
})

describe('changeCategory', () => {
  it('should send only what it is given, and give the category the API wrote', async () => {
    // Arrange
    const sent: unknown[] = []
    answering(async (asked) => {
      sent.push(await asked.json())
      return json(200, { data: aCategory(), meta: null, links: { self: '/' } })
    })

    // Act
    const written = await changeCategory(salon.id, aCategory().id, {
      color: null,
    })

    // Assert
    expect(written).toEqual({ type: 'written', category: aCategory() })
    expect(sent).toEqual([{ color: null }])
  })

  it.each(NOT_SENT)(
    'should change no category after %s',
    async (_, given, type) => {
      // Arrange
      answering(given)

      // Act
      const written = await changeCategory(salon.id, aCategory().id, {
        name: 'カット',
      })

      // Assert
      expect(written).toEqual({ type })
    },
  )
})

describe('removeCategory', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no category', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should remove no category after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const removed = await removeCategory(salon.id, 'x')

    // Assert
    expect(removed).toEqual({ type })
  })
})

describe('addService', () => {
  it.each<[string, Answer, string]>([
    ['a salon removed meanwhile', () => problem(404), 'notFound'],
    ...NOT_SENT,
  ])('should add no service after %s', async (_, given, type) => {
    // Arrange
    answering(given)
    const {
      id: _id,
      salonId: _salonId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...request
    } = aService()

    // Act
    const written = await addService(salon.id, request)

    // Assert
    expect(written).toEqual({ type })
  })
})

describe('changeService', () => {
  it('should send only what it is given, and give the service the API wrote', async () => {
    // Arrange
    const sent: unknown[] = []
    answering(async (asked) => {
      sent.push(await asked.json())
      return json(200, { data: aService(), meta: null, links: { self: '/' } })
    })

    // Act
    const written = await changeService(salon.id, aService().id, {
      discountPrice: null,
    })

    // Assert
    expect(written).toEqual({ type: 'written', service: aService() })
    expect(sent).toEqual([{ discountPrice: null }])
  })

  it.each(NOT_SENT)(
    'should change no service after %s',
    async (_, given, type) => {
      // Arrange
      answering(given)

      // Act
      const written = await changeService(salon.id, aService().id, {
        price: 6000,
      })

      // Assert
      expect(written).toEqual({ type })
    },
  )
})

describe('removeService', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no service', () => problem(400), 'notFound'],
    ['a refusal of a service in use', () => problem(409), 'inUse'],
    ...UNREAD,
  ])('should remove no service after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const removed = await removeService(salon.id, 'x')

    // Assert
    expect(removed).toEqual({ type })
  })
})
