import type {
  ModelsCustomerPreferencesResponse,
  ModelsCustomerPreferencesUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  answering,
  asked,
  OUTSIDE_THE_CONTRACT,
  page,
  pageOfAGateway,
  problem,
  record,
  sent,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  readOwnPreferences,
  readOwnPreferencesToChange,
  updateOwnPreferences,
} from './preferences-api'

/*
 * The answers the real API gives are met in
 * `preferences.integration.test.tsx`. Here are the ones a test cannot bring
 * about there (too many requests, an error of the server, no answer, a
 * status the contract does not name), what each operation asks for, and
 * what it makes of the answers to its several requests.
 */

/** What the API answers for a customer who has said nothing yet */
const noPreferences: ModelsCustomerPreferencesResponse = {
  preferredStaffId: null,
  avoidStaffIds: [],
  preferredTimeSlots: [],
  stylePreferences: null,
  communicationStyle: null,
  specialRequests: null,
}

const TOKYO = {
  id: '5d0c3f6a-2b9e-4c71-8a54-e1f7b3d9c026',
  name: 'みなと美容室',
}
const OSAKA = {
  id: '9b7e1d42-6f3a-4e08-b5c9-2a4d8f0e6713',
  name: 'あおぞらヘア',
}
const KYOTO = {
  id: '3c8f5a17-0d4b-4e62-9a71-6b2e9d0c4f85',
  name: 'かもがわサロン',
}

const MISAKI = {
  id: 'a41f7c3e-58d2-4b96-9e0a-7c2b5d1f8e34',
  salonId: TOKYO.id,
  displayName: '田中 美咲',
}
const KENTA = {
  id: 'c7d2e9b4-1a6f-4c83-b05e-3f8a6d2c9b17',
  salonId: TOKYO.id,
  displayName: '佐藤 健太',
}
const YUI = {
  id: 'e3b8a5d1-9c4f-4d27-a6e0-1b7c4f9d2a58',
  salonId: OSAKA.id,
  displayName: '鈴木 結衣',
}
const AOI = {
  id: '7e5b2c90-3f1a-4d86-b9e4-0c6a8d2f1b37',
  salonId: KYOTO.id,
  displayName: '山本 葵',
}

const choiceOf = (
  { id, salonId, displayName }: typeof MISAKI,
  salon: typeof TOKYO,
) => ({ id, displayName, salonId, salonName: salon.name })

/** What the API holds, and answers when it is asked for it. */
type Api = {
  preferences: () => Response
  /** The page of the bookings that begins after `cursor` */
  bookings: (cursor: string | null) => Response
  staffOf: (salonId: string) => Response
  member: (id: string) => Response
  salon: (id: string) => Response
}

/** A customer who has said nothing, has booked nowhere, and salons with their staff. */
const API: Api = {
  preferences: () => record(200, noPreferences),
  bookings: () => page([]),
  staffOf: (salonId) =>
    page(
      [MISAKI, KENTA, YUI, AOI].filter((member) => member.salonId === salonId),
    ),
  member: (id) => {
    const found = [MISAKI, KENTA, YUI, AOI].find((member) => member.id === id)

    return found === undefined ? problem(404) : record(200, found)
  },
  salon: (id) => {
    const found = [TOKYO, OSAKA, KYOTO].find((salon) => salon.id === id)

    return found === undefined ? problem(404) : record(200, found)
  },
}

/** Lets the API answer as `API` does, but for what `other` says otherwise. */
const holding = (other: Partial<Api> = {}) => {
  const api = { ...API, ...other }

  return answering((request) => {
    const url = new URL(request.url)
    const [, path = ''] = url.pathname.split('/api/v1')
    if (path === '/customers/me/preferences') {
      return api.preferences()
    }
    if (path === '/customers/me/bookings') {
      return api.bookings(url.searchParams.get('cursor'))
    }
    if (path === '/staff-profiles') {
      return api.staffOf(url.searchParams.get('salonId') ?? '')
    }
    if (path.startsWith('/staff-profiles/')) {
      return api.member(path.slice('/staff-profiles/'.length))
    }
    if (path.startsWith('/salons/')) {
      return api.salon(path.slice('/salons/'.length))
    }

    return problem(404)
  })
}

const naming = (preferredStaffId: string | null, avoidStaffIds: string[]) => ({
  preferences: () =>
    record(200, { ...noPreferences, preferredStaffId, avoidStaffIds }),
})

const bookedAt = (...salons: { id: string }[]) => ({
  bookings: () =>
    page(
      salons.map(({ id }, index) => ({ id: `booking-${index}`, salonId: id })),
    ),
})

const CHANGES: ModelsCustomerPreferencesUpdateRequest = {
  preferredStaffId: null,
  preferredTimeSlots: [{ startTime: '10:00', endTime: '12:00' }],
  communicationStyle: '静かに過ごしたい',
}

/** Every operation of the screens of the preferences, called as a screen calls it. */
const OPERATIONS: [string, () => Promise<{ type: string }>][] = [
  ['readOwnPreferences', () => readOwnPreferences()],
  ['readOwnPreferencesToChange', () => readOwnPreferencesToChange()],
  ['updateOwnPreferences', () => updateOwnPreferences(CHANGES)],
]

const READS: [string, () => Promise<{ type: string }>][] = OPERATIONS.filter(
  ([name]) => name !== 'updateOwnPreferences',
)

/** One of the requests for what the preferences name gets no answer to act on: the others do. */
const HALVES: [string, Partial<Api>][] = [
  [
    'a member',
    { member: (id) => (id === YUI.id ? problem(500) : API.member(id)) },
  ],
  [
    'a salon',
    { salon: (id) => (id === OSAKA.id ? problem(500) : API.salon(id)) },
  ],
]

describe('the operations of the screens of the preferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each(OPERATIONS)('%s', (_name, call) => {
    it('should say that there were too many requests when the API limits them', async () => {
      answering(() => problem(429))

      expect(await call()).toEqual({ type: 'tooManyRequests' })
    })

    it('should have failed when the API answers with an error of the server', async () => {
      answering(() => problem(500))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it('should have failed, and not reject, when there is no answer', async () => {
      answering(() => Promise.reject(new TypeError('Failed to fetch')))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it.each(OUTSIDE_THE_CONTRACT)(
      'should have failed, and not reject, when the answer is %s: a status the contract does not name',
      async (_case, status) => {
        answering(() => pageOfAGateway(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )

    it.each([
      ['knows no session', 401],
      ['does not allow it', 403],
    ])(
      'should have failed when the API %s: the guard of the session says what stands in the way',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )

    it('should say that the account has no profile when the API finds none, and ask for nothing else', async () => {
      const fetched = answering(() => problem(404))

      expect(await call()).toEqual({ type: 'none' })
      expect(fetched).toHaveBeenCalledTimes(1)
    })
  })

  describe.each(READS)('%s', (name, read) => {
    it('should hand over the preferences of the answer', async () => {
      holding({
        preferences: () =>
          record(200, {
            ...noPreferences,
            specialRequests: '駐車場を使います。',
          }),
      })

      expect(await read()).toMatchObject({
        type: 'found',
        preferences: {
          ...noPreferences,
          specialRequests: '駐車場を使います。',
        },
      })
    })

    it('should ask for every member the preferences name once, and for the salon of each once', async () => {
      const fetched = holding(naming(MISAKI.id, [KENTA.id, YUI.id]))

      await read()

      expect(asked(fetched).toSorted()).toEqual(
        [
          'GET /customers/me/preferences',
          ...(name === 'readOwnPreferencesToChange'
            ? ['GET /customers/me/bookings?limit=100']
            : []),
          `GET /staff-profiles/${MISAKI.id}`,
          `GET /staff-profiles/${KENTA.id}`,
          `GET /staff-profiles/${YUI.id}`,
          `GET /salons/${TOKYO.id}`,
          `GET /salons/${OSAKA.id}`,
        ].toSorted(),
      )
    })

    it('should name every member the preferences name with their salon, the salons by name', async () => {
      holding(naming(MISAKI.id, [KENTA.id, YUI.id]))

      expect(await read()).toMatchObject({
        staff: [
          choiceOf(YUI, OSAKA),
          choiceOf(MISAKI, TOKYO),
          choiceOf(KENTA, TOKYO),
        ],
      })
    })

    it('should leave out a member whose salon no longer shows them, and not ask for a salon on their account', async () => {
      const fetched = holding({
        ...naming(MISAKI.id, [YUI.id]),
        member: (id) => (id === YUI.id ? problem(404) : API.member(id)),
      })

      expect(await read()).toMatchObject({
        type: 'found',
        staff: [choiceOf(MISAKI, TOKYO)],
      })
      expect(asked(fetched)).not.toContain(`GET /salons/${OSAKA.id}`)
    })

    it('should leave out a member whose salon is not found', async () => {
      holding({
        ...naming(MISAKI.id, [YUI.id]),
        salon: (id) => (id === OSAKA.id ? problem(404) : API.salon(id)),
      })

      expect(await read()).toMatchObject({
        type: 'found',
        staff: [choiceOf(MISAKI, TOKYO)],
      })
    })

    it.each(HALVES)(
      'should not show half of it when the request for %s got no answer to act on',
      async (_case, other) => {
        holding({ ...naming(MISAKI.id, [YUI.id]), ...other })

        expect(await read()).toEqual({ type: 'failed' })
      },
    )

    it('should say that there were too many requests when one of several requests was refused for that', async () => {
      const refused: Record<string, number> = { [KENTA.id]: 429, [YUI.id]: 500 }
      holding({
        ...naming(MISAKI.id, [KENTA.id, YUI.id]),
        member: (id) => {
          const status = refused[id]

          return status === undefined ? API.member(id) : problem(status)
        },
      })

      expect(await read()).toEqual({ type: 'tooManyRequests' })
    })

    it('should have failed when the API takes the ID of a member for none', async () => {
      holding({ ...naming(MISAKI.id, []), member: () => problem(400) })

      expect(await read()).toEqual({ type: 'failed' })
    })
  })

  describe('readOwnPreferences', () => {
    it('should ask for the preferences alone when they name nobody, and name nobody', async () => {
      const fetched = holding(bookedAt(TOKYO))

      expect(await readOwnPreferences()).toEqual({
        type: 'found',
        preferences: noPreferences,
        staff: [],
      })
      expect(asked(fetched)).toEqual(['GET /customers/me/preferences'])
    })
  })

  describe('readOwnPreferencesToChange', () => {
    it('should offer nobody to somebody who has a booking nowhere', async () => {
      const fetched = holding()

      expect(await readOwnPreferencesToChange()).toEqual({
        type: 'found',
        preferences: noPreferences,
        staff: [],
      })
      expect(asked(fetched)).toEqual([
        'GET /customers/me/preferences',
        'GET /customers/me/bookings?limit=100',
      ])
    })

    it('should offer nobody to an account whose bookings the API does not find', async () => {
      holding({ bookings: () => problem(404) })

      expect(await readOwnPreferencesToChange()).toMatchObject({
        type: 'found',
        staff: [],
      })
    })

    it('should offer the staff of every salon the customer has a booking at, and ask for each salon once', async () => {
      const fetched = holding(bookedAt(TOKYO, OSAKA, TOKYO))

      expect(await readOwnPreferencesToChange()).toMatchObject({
        staff: [
          choiceOf(YUI, OSAKA),
          choiceOf(MISAKI, TOKYO),
          choiceOf(KENTA, TOKYO),
        ],
      })
      expect(asked(fetched).toSorted()).toEqual(
        [
          'GET /customers/me/preferences',
          'GET /customers/me/bookings?limit=100',
          `GET /staff-profiles?salonId=${TOKYO.id}&limit=100`,
          `GET /staff-profiles?salonId=${OSAKA.id}&limit=100`,
          `GET /salons/${TOKYO.id}`,
          `GET /salons/${OSAKA.id}`,
        ].toSorted(),
      )
    })

    it('should read the bookings to their end, in the largest pages the API gives', async () => {
      const fetched = holding({
        bookings: (cursor) =>
          cursor === null
            ? page([{ id: 'booking-1', salonId: TOKYO.id }], 'booking-1')
            : page([{ id: 'booking-2', salonId: OSAKA.id }]),
      })

      const read = await readOwnPreferencesToChange()

      expect(read).toMatchObject({
        staff: [
          choiceOf(YUI, OSAKA),
          choiceOf(MISAKI, TOKYO),
          choiceOf(KENTA, TOKYO),
        ],
      })
      expect(asked(fetched)).toEqual(
        expect.arrayContaining([
          'GET /customers/me/bookings?limit=100',
          'GET /customers/me/bookings?cursor=booking-1&limit=100',
        ]),
      )
    })

    it('should not ask again for a member the preferences name who is among the staff of a salon', async () => {
      const fetched = holding({
        ...bookedAt(TOKYO),
        ...naming(MISAKI.id, [KENTA.id]),
      })

      await readOwnPreferencesToChange()

      expect(
        asked(fetched).filter((request) =>
          request.startsWith('GET /staff-profiles/'),
        ),
      ).toEqual([])
    })

    it('should offer a member the preferences name who works where the customer has no booking, beside the staff of the salons', async () => {
      const fetched = holding({
        ...bookedAt(TOKYO),
        ...naming(AOI.id, [KENTA.id]),
      })

      expect(await readOwnPreferencesToChange()).toMatchObject({
        staff: [
          choiceOf(AOI, KYOTO),
          choiceOf(MISAKI, TOKYO),
          choiceOf(KENTA, TOKYO),
        ],
      })
      expect(asked(fetched)).toEqual(
        expect.arrayContaining([
          `GET /staff-profiles/${AOI.id}`,
          `GET /salons/${KYOTO.id}`,
        ]),
      )
    })

    it('should not offer the staff of a salon that is not found', async () => {
      holding({
        ...bookedAt(TOKYO, OSAKA),
        salon: (id) => (id === TOKYO.id ? problem(404) : API.salon(id)),
      })

      expect(await readOwnPreferencesToChange()).toMatchObject({
        type: 'found',
        staff: [choiceOf(YUI, OSAKA)],
      })
    })

    it.each([
      ['the bookings', { bookings: () => problem(500) }, 'failed'],
      ['the bookings', { bookings: () => problem(429) }, 'tooManyRequests'],
      ['the staff of a salon', { staffOf: () => problem(500) }, 'failed'],
      [
        'the staff of a salon',
        { staffOf: () => problem(429) },
        'tooManyRequests',
      ],
      ['a salon', { salon: () => problem(500) }, 'failed'],
    ])(
      'should offer nothing when the request for %s got no answer to act on',
      async (_case, other, type) => {
        holding({ ...bookedAt(TOKYO, OSAKA), ...other })

        expect(await readOwnPreferencesToChange()).toEqual({ type })
      },
    )
  })

  describe('updateOwnPreferences', () => {
    it('should send the changes and nothing else, and hand over the preferences as the API has them now', async () => {
      const fetched = answering(() => record(200, noPreferences))

      expect(await updateOwnPreferences(CHANGES)).toEqual({
        type: 'updated',
        preferences: noPreferences,
      })
      expect(asked(fetched)).toEqual(['PATCH /customers/me/preferences'])
      expect(sent(fetched)).toMatchObject({ body: JSON.stringify(CHANGES) })
    })

    it.each([
      ['a body that is too large', 413],
      ['a body of a type it does not read', 415],
    ])(
      'should have failed when the API answers with %s',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await updateOwnPreferences(CHANGES)).toEqual({ type: 'failed' })
      },
    )

    it('should name the values that the API does not take, with the rules they broke', async () => {
      answering(() =>
        problem(400, [
          { field: 'preferredStaffId', rule: 'avoided' },
          { field: 'avoidStaffIds.1', rule: 'not_found' },
        ]),
      )

      expect(await updateOwnPreferences(CHANGES)).toEqual({
        type: 'invalid',
        values: [
          { field: 'preferredStaffId', rule: 'avoided' },
          { field: 'avoidStaffIds.1', rule: 'not_found' },
        ],
      })
    })

    it('should name no value when the API names none', async () => {
      answering(() => problem(400))

      expect(await updateOwnPreferences(CHANGES)).toEqual({
        type: 'invalid',
        values: [],
      })
    })
  })
})
