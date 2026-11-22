import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  answering,
  problem,
  record,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aDescribedSalon } from './components/examples'
import { attemptHoursChange, hoursOf, sameHours } from './hours-api'

/*
 * What the API answers to a change of the hours is met with the real API
 * (`hours.integration.test.tsx`). Here are the answers a test cannot bring
 * about there.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

const SALON = aDescribedSalon()

const found = (salon: ModelsSalonResponse): Response => record(200, salon)

/** The salon with a day off on the last day of the year no longer recorded */
const withoutNewYear = (): ModelsSalonResponse => ({
  ...SALON,
  openingHours: SALON.openingHours.filter(({ date }) => date !== '2026-12-31'),
})

describe('sameHours', () => {
  it('should hold two readings of the same hours the same', () => {
    expect(sameHours(hoursOf(SALON), hoursOf(aDescribedSalon()))).toBe(true)
  })

  it.each<[string, ModelsSalonResponse]>([
    ['a date of the calendar taken away', withoutNewYear()],
    ['a week that is not recorded', { ...SALON, businessHours: null }],
    [
      'a day of the week that closes later',
      {
        ...SALON,
        businessHours: (SALON.businessHours ?? []).map((entry) =>
          entry.dayOfWeek === 'saturday'
            ? {
                ...entry,
                operatingSlots: [{ startTime: '09:00', endTime: '19:00' }],
              }
            : entry,
        ),
      },
    ],
  ])('should tell %s', (_, other) => {
    expect(sameHours(hoursOf(SALON), hoursOf(other))).toBe(false)
  })
})

describe('attemptHoursChange', () => {
  it('should change hours that are as the form opened them, and give the salon the API wrote', async () => {
    // Arrange
    const written = withoutNewYear()
    const sent: unknown[] = []
    const fetched = answering(async (asked) => {
      if (asked.method === 'PATCH') {
        sent.push(await asked.json())
        return found(written)
      }
      return found(SALON)
    })

    // Act
    const outcome = await attemptHoursChange(SALON.id, hoursOf(SALON), {
      openingHours: written.openingHours,
    })

    // Assert
    expect(outcome).toEqual({ type: 'written', salon: written })
    expect(sent).toEqual([{ openingHours: written.openingHours }])
    expect(fetched).toHaveBeenCalledTimes(2)
  })

  it('should not change hours another account changed meanwhile, and give them as they are now', async () => {
    // Arrange
    const now = withoutNewYear()
    const fetched = answering(() => found(now))

    // Act
    const outcome = await attemptHoursChange(SALON.id, hoursOf(SALON), {
      businessHours: null,
    })

    // Assert
    expect(outcome).toEqual({ type: 'changed', hours: hoursOf(now) })
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it.each<[string, () => Response | Promise<Response>, string]>([
    ['a salon removed meanwhile', () => problem(404), 'notFound'],
    ...UNREAD,
  ])(
    'should change nothing when the salon could not be read again after %s',
    async (_, answer, type) => {
      // Arrange
      const fetched = answering(answer)

      // Act
      const outcome = await attemptHoursChange(SALON.id, hoursOf(SALON), {
        businessHours: null,
      })

      // Assert
      expect(outcome).toEqual({ type })
      expect(fetched).toHaveBeenCalledTimes(1)
    },
  )

  it.each<[string, () => Response | Promise<Response>, string]>([
    // Removed, or refused, after the salon was read again
    ['a salon removed meanwhile', () => problem(404), 'notFound'],
    ['a refusal of the role', () => problem(403), 'forbidden'],
    ['a body that is too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should fail after %s', async (_, answer, type) => {
    // Arrange
    answering((asked) => (asked.method === 'PATCH' ? answer() : found(SALON)))

    // Act
    const outcome = await attemptHoursChange(SALON.id, hoursOf(SALON), {
      businessHours: null,
    })

    // Assert
    expect(outcome).toEqual({ type })
  })

  it('should give the values the API refused, by their places in the request', async () => {
    // Arrange
    answering((asked) =>
      asked.method === 'PATCH'
        ? problem(400, [{ field: 'openingHours.0.dayOfWeek', rule: 'custom' }])
        : found(SALON),
    )

    // Act
    const outcome = await attemptHoursChange(SALON.id, hoursOf(SALON), {
      openingHours: [],
    })

    // Assert
    expect(outcome).toEqual({
      type: 'invalid',
      values: [{ field: 'openingHours.0.dayOfWeek', rule: 'custom' }],
    })
  })
})
