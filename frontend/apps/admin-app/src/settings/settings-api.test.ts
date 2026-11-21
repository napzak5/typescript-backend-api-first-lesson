import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../bookings/components/examples'
import {
  addSalon,
  changeSalon,
  mayAddSalon,
  mayKeepSalon,
  mayRemoveSalon,
  removeSalon,
} from './settings-api'

/*
 * What the API answers to a change, an addition and a removal of a salon is
 * met with the real API (`settings.integration.test.tsx`,
 * `salons.integration.test.tsx`). Here are the answers a test cannot bring
 * about there.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

type Answer = () => Response | Promise<Response>

describe('mayKeepSalon', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should let %s change the settings: %s', (role, keeps) => {
    expect(mayKeepSalon(role)).toBe(keeps)
  })
})

describe('changeSalon', () => {
  it('should send only what it is given, and give the salon the API wrote', async () => {
    // Arrange
    const sent: unknown[] = []
    answering(async (asked) => {
      sent.push(await asked.json())
      return json(200, { data: salon, meta: null, links: { self: '/' } })
    })

    // Act
    const written = await changeSalon(salon.id, { taxRate: 8 })

    // Assert
    expect(written).toEqual({ type: 'written', salon })
    expect(sent).toEqual([{ taxRate: 8 }])
  })

  it.each<[string, Answer, string]>([
    ['a salon removed meanwhile', () => problem(404), 'notFound'],
    ['an email address of another salon', () => problem(409), 'emailTaken'],
    ['a body that is too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should change nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const written = await changeSalon(salon.id, { taxRate: 8 })

    // Assert
    expect(written).toEqual({ type })
  })
})

describe('mayAddSalon', () => {
  it.each<[string, boolean]>([
    ['admin', true],
    ['owner', false],
    ['manager', false],
    ['staff', false],
    ['customer', false],
  ])('should let %s add salons: %s', (role, adds) => {
    expect(mayAddSalon(role)).toBe(adds)
  })
})

describe('mayRemoveSalon', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['admin', true],
    ['manager', false],
    ['staff', false],
    ['customer', false],
  ])('should let %s remove the salon: %s', (role, removes) => {
    expect(mayRemoveSalon(role)).toBe(removes)
  })
})

const NEW_SALON_REQUEST = {
  name: 'Salon Hikari 新宿店',
  nameKana: null,
  description: null,
  postalCode: null,
  prefecture: '東京都',
  city: '新宿区',
  address: '西新宿 1-1-1',
  building: null,
  latitude: null,
  longitude: null,
  phoneNumber: '03-1111-2222',
  alternativePhone: null,
  email: 'shinjuku@example.com',
  websiteUrl: null,
  logoUrl: null,
  imageUrls: [],
  features: [],
  amenities: [],
  businessHours: null,
  timezone: 'Asia/Tokyo',
  currency: 'JPY',
  taxRate: 10,
  isActive: false,
  openingHours: [],
}

describe('addSalon', () => {
  it('should send what it is given, and give the salon the API wrote', async () => {
    // Arrange
    const sent: unknown[] = []
    answering(async (asked) => {
      sent.push(await asked.json())
      return json(201, { data: salon, meta: null, links: { self: '/' } })
    })

    // Act
    const added = await addSalon(NEW_SALON_REQUEST)

    // Assert
    expect(added).toEqual({ type: 'added', salon })
    expect(sent).toEqual([NEW_SALON_REQUEST])
  })

  it.each<[string, Answer, string]>([
    ['an account that does not add salons', () => problem(403), 'forbidden'],
    ['a body that is too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should add nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const added = await addSalon(NEW_SALON_REQUEST)

    // Assert
    expect(added).toEqual({ type })
  })
})

describe('removeSalon', () => {
  it.each<[string, Answer, string]>([
    ['the removal', () => new Response(null, { status: 204 }), 'removed'],
    ['an ID the API does not read', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should give what came of %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const removed = await removeSalon(salon.id)

    // Assert
    expect(removed).toEqual({ type })
  })
})
