import {
  answering,
  problem,
  UNREAD,
  UNWRITTEN,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../../bookings/components/examples'
import { card } from '../components/examples'
import {
  addPaymentMethod,
  changePaymentMethod,
  mayKeepPaymentMethods,
  readPaymentMethod,
  removePaymentMethod,
} from './payment-methods-api'

/*
 * What the API answers to the payment methods is met with the real API
 * (`payment-methods.integration.test.tsx`). Here are the answers a test
 * cannot bring about there.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

type Answer = () => Response | Promise<Response>

describe('mayKeepPaymentMethods', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should let %s keep the payment methods: %s', (role, keeps) => {
    expect(mayKeepPaymentMethods(role)).toBe(keeps)
  })
})

describe('readPaymentMethod', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no method', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should read no method after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readPaymentMethod(salon.id, 'x')

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('addPaymentMethod', () => {
  it.each(UNWRITTEN)(
    'should add no method after %s',
    async (_, given, type) => {
      // Arrange
      answering(given)

      // Act
      const written = await addPaymentMethod(salon.id, {
        method: 'cash',
        displayName: '現金',
        description: null,
        processorName: null,
        fee: null,
        minimumAmount: null,
        maximumAmount: null,
        isOnlineEnabled: false,
        isOfflineEnabled: true,
        sortOrder: 1,
        isActive: true,
      })

      // Assert
      expect(written).toEqual({ type })
    },
  )
})

describe('changePaymentMethod', () => {
  it.each(UNWRITTEN)(
    'should change no method after %s',
    async (_, given, type) => {
      // Arrange
      answering(given)

      // Act
      const written = await changePaymentMethod(salon.id, card().id, {
        fee: 3.6,
      })

      // Assert
      expect(written).toEqual({ type })
    },
  )
})

describe('removePaymentMethod', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no method', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should remove no method after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const removed = await removePaymentMethod(salon.id, 'x')

    // Assert
    expect(removed).toEqual({ type })
  })
})
