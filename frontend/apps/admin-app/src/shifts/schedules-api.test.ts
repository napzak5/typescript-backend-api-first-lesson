import type { ModelsStaffSchedule } from '@beauty-salon-frontend/api-client'
import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aSchedule, aWeek } from './components/examples'
import {
  attemptScheduleSave,
  mayPlanShifts,
  readProfile,
  readSchedule,
  sameSchedule,
} from './schedules-api'

/*
 * What the API answers to the schedules is met with the real API
 * (`shifts.integration.test.tsx`). Here are the answers a test cannot
 * bring about there.
 */

const SALON = 'salon'
const MEMBER = 'member'

/** A schedule as the API answers it */
const schedule = (rows: ModelsStaffSchedule[]): Response =>
  json(200, { data: rows, meta: null, links: { self: '/' } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mayPlanShifts', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should say whether the %s plans the schedules', (role, plans) => {
    expect(mayPlanShifts(role)).toBe(plans)
  })
})

describe('readSchedule', () => {
  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readSchedule(SALON, MEMBER)

    // Assert
    expect(read).toEqual({ type })
  })

  it('should find no member after an ID the API does not take', async () => {
    // Arrange
    answering(() => problem(400))

    // Act
    const read = await readSchedule(SALON, 'not an ID')

    // Assert
    expect(read).toEqual({ type: 'notFound' })
  })
})

describe('readProfile', () => {
  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readProfile(MEMBER)

    // Assert
    expect(read).toEqual({ type })
  })

  it('should find no member after an ID the API does not take', async () => {
    // Arrange
    answering(() => problem(400))

    // Act
    const read = await readProfile('not an ID')

    // Assert
    expect(read).toEqual({ type: 'notFound' })
  })
})

describe('sameSchedule', () => {
  it('should take two readings with their properties in another order as the same', () => {
    // Arrange
    const [first, ...rest] = aWeek()
    const reordered = first === undefined ? [] : [{ ...first }, ...rest]
    const turned = reordered.map(
      ({ notes, isAvailable, ...row }): ModelsStaffSchedule => ({
        notes,
        ...row,
        isAvailable,
      }),
    )

    // Act
    const same = sameSchedule(aWeek(), turned)

    // Assert
    expect(same).toBe(true)
  })

  it.each<[string, ModelsStaffSchedule[]]>([
    ['a row less', aWeek().slice(1)],
    ['the rows in another order', [...aWeek()].reverse()],
    ['another note', aWeek().map((row) => ({ ...row, notes: 'ほかの備考' }))],
  ])('should tell a schedule with %s apart', (_, other) => {
    expect(sameSchedule(aWeek(), other)).toBe(false)
  })
})

describe('attemptScheduleSave', () => {
  it('should replace a schedule that is as the form opened it, and give what the API holds then', async () => {
    // Arrange
    const sent: unknown[] = []
    const fetched = answering(async (asked) => {
      if (asked.method === 'PUT') {
        sent.push(await asked.json())
        return schedule(aWeek())
      }
      return schedule(aSchedule())
    })

    // Act
    const outcome = await attemptScheduleSave(
      SALON,
      MEMBER,
      aSchedule(),
      aWeek(),
    )

    // Assert
    expect(outcome).toEqual({ type: 'saved', rows: aWeek() })
    expect(sent).toEqual([aWeek()])
    expect(fetched).toHaveBeenCalledTimes(2)
  })

  it('should not replace a schedule another account changed meanwhile, and give it as it is now', async () => {
    // Arrange
    const fetched = answering(() => schedule(aWeek()))

    // Act
    const outcome = await attemptScheduleSave(SALON, MEMBER, aSchedule(), [])

    // Assert
    expect(outcome).toEqual({ type: 'changed', rows: aWeek() })
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it.each(UNREAD)(
    'should not save when the schedule could not be read again after %s',
    async (_, answer, type) => {
      // Arrange
      const fetched = answering(answer)

      // Act
      const outcome = await attemptScheduleSave(SALON, MEMBER, [], [])

      // Assert
      expect(outcome).toEqual({ type })
      expect(fetched).toHaveBeenCalledTimes(1)
    },
  )

  it.each<[string, () => Response | Promise<Response>, string]>([
    // Removed, or refused, after the schedule was read again
    ['a member removed meanwhile', () => problem(404), 'notFound'],
    ['a refusal of the role', () => problem(403), 'forbidden'],
    ['a body that is too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should fail after %s', async (_, answer, type) => {
    // Arrange
    answering((asked) => (asked.method === 'PUT' ? answer() : schedule([])))

    // Act
    const outcome = await attemptScheduleSave(SALON, MEMBER, [], aWeek())

    // Assert
    expect(outcome).toEqual({ type })
  })

  it('should give the values the API refused, by their places in the request', async () => {
    // Arrange
    answering((asked) =>
      asked.method === 'PUT'
        ? problem(400, [{ field: '0.endTime', rule: 'custom' }])
        : schedule([]),
    )

    // Act
    const outcome = await attemptScheduleSave(SALON, MEMBER, [], aWeek())

    // Assert
    expect(outcome).toEqual({
      type: 'invalid',
      values: [{ field: '0.endTime', rule: 'custom' }],
    })
  })
})
