import { describe, expect, it } from 'vitest'
import { staffScheduleLinks } from '../links'

const SCHEDULES =
  '/api/v1/salons/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a01/staff/0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01/schedules'

describe('staffScheduleLinks', () => {
  it('links the whole schedule to itself', () => {
    expect(staffScheduleLinks(SCHEDULES, SCHEDULES)).toEqual({
      self: SCHEDULES,
      list: SCHEDULES,
    })
  })

  it('links the entry of a date to the request, and to the whole schedule', () => {
    expect(
      staffScheduleLinks(SCHEDULES, `${SCHEDULES}?date=2026-12-31`),
    ).toEqual({
      self: `${SCHEDULES}?date=2026-12-31`,
      list: SCHEDULES,
    })
  })

  it.each([
    ['a question mark without a query', `${SCHEDULES}?`],
    ['a slash at the end', `${SCHEDULES}/`],
    ['a slash and a question mark', `${SCHEDULES}/?`],
  ])('links a request with %s to the schedule itself', (_case, requestUrl) => {
    expect(staffScheduleLinks(SCHEDULES, requestUrl)).toEqual({
      self: SCHEDULES,
      list: SCHEDULES,
    })
  })

  it('takes the path from where the routes are mounted, not from the request', () => {
    expect(
      staffScheduleLinks(SCHEDULES, `${SCHEDULES}/?date=2026-12-31`),
    ).toEqual({
      self: `${SCHEDULES}?date=2026-12-31`,
      list: SCHEDULES,
    })
  })

  it('keeps the path as the request wrote it', () => {
    const inUpperCase = SCHEDULES.toUpperCase()

    expect(
      staffScheduleLinks(inUpperCase, `${inUpperCase}?date=2026-12-31`),
    ).toEqual({
      self: `${inUpperCase}?date=2026-12-31`,
      list: inUpperCase,
    })
  })

  it('writes the query in the encoding of a URL', () => {
    expect(
      staffScheduleLinks(SCHEDULES, `${SCHEDULES}?date=2026-12-31&note=a b`)
        .self,
    ).toBe(`${SCHEDULES}?date=2026-12-31&note=a+b`)
  })
})
