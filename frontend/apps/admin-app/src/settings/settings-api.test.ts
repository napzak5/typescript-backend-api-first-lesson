import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { salon } from '../bookings/components/examples'
import { changeSalon, mayKeepSalon } from './settings-api'

/*
 * What the API answers to a change of a salon is met with the real API
 * (`settings.integration.test.tsx`). Here are the answers a test cannot
 * bring about there.
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
