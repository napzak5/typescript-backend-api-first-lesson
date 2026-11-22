import type {
  ModelsBookingStatusType,
  ModelsCustomerBookingResponse,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { booking } from './components/examples'
import {
  askedOf,
  isChangeable,
  isMovable,
  listHrefOf,
  moveHrefOf,
  type Named,
  namedBy,
  rowsOf,
  serviceIdOf,
  whenIn,
} from './own-bookings'

const SALON = { name: 'ヘアサロン こもれび 表参道', timezone: 'Asia/Tokyo' }
const OTHER_SALON_ID = '9d2f6a80-1c34-4e57-8a69-b0c2d4e6f813'
const OTHER_SERVICE_ID = '2b4d6f80-ac31-4e57-9f79-1b3d5f708a8b'
const [SERVICE] = booking.services

/** A booking of the stories with another ID, and with what a test says of it. */
const another = (
  id: string,
  changes: Partial<ModelsCustomerBookingResponse> = {},
): ModelsCustomerBookingResponse => ({ ...booking, ...changes, id })

/** A booking of another service, at the salon it is given. */
const ofOtherService = (
  id: string,
  salonId: string,
): ModelsCustomerBookingResponse =>
  another(id, {
    salonId,
    services: booking.services.map((service) => ({
      ...service,
      serviceId: OTHER_SERVICE_ID,
    })),
  })

/** What a list has read: every salon and every service, unless a test says otherwise. */
const named = (changes: Partial<Named> = {}): Named => ({
  salon: () => ({ type: 'found', salon: SALON }),
  service: () => ({ type: 'found', service: { name: 'レディースカット' } }),
  ...changes,
})

describe('whenIn', () => {
  it.each([
    ['no query', '', 'upcoming'],
    ['the visits that were', 'when=past', 'past'],
    ['the visits to come, said in a word', 'when=upcoming', 'upcoming'],
    ['a word that names no list', 'when=yesterday', 'upcoming'],
    ['a word in other letters', 'when=PAST', 'upcoming'],
    ['an empty word', 'when=', 'upcoming'],
    ['other parameters alone', 'page=2', 'upcoming'],
  ])('should read %s', (_case, query, when) => {
    expect(whenIn(new URLSearchParams(query))).toBe(when)
  })
})

describe('listHrefOf', () => {
  it('should be the address without a query for the visits to come', () => {
    expect(listHrefOf('upcoming')).toBe('/bookings')
  })

  it('should name the visits that were in the query, as `whenIn` reads it', () => {
    const [, query] = listHrefOf('past').split('?')

    expect(listHrefOf('past')).toBe('/bookings?when=past')
    expect(whenIn(new URLSearchParams(query))).toBe('past')
  })
})

describe('askedOf', () => {
  it('should ask for the visits from today on, today among them', () => {
    expect(askedOf('upcoming', '2026-11-19')).toEqual({
      bookingDateFrom: '2026-11-19',
    })
  })

  it('should ask for the visits until yesterday', () => {
    expect(askedOf('past', '2026-11-19')).toEqual({
      bookingDateTo: '2026-11-18',
    })
  })

  it.each([
    ['the first day of a month', '2026-12-01', '2026-11-30'],
    ['the first day of a year', '2027-01-01', '2026-12-31'],
    ['the day after a leap day', '2028-03-01', '2028-02-29'],
  ])('should find yesterday on %s', (_case, today, yesterday) => {
    expect(askedOf('past', today)).toEqual({ bookingDateTo: yesterday })
  })
})

describe('isChangeable', () => {
  const START = '2026-11-24T01:30:00.000Z'
  const BEFORE = new Date('2026-11-24T01:29:59.999Z')

  it.each<[ModelsBookingStatusType, boolean]>([
    ['draft', true],
    ['pending', true],
    ['confirmed', true],
    ['in_progress', false],
    ['completed', false],
    ['cancelled', false],
    ['no_show', false],
  ])(
    'should say of a booking that is %s and has not begun: %s',
    (status, changeable) => {
      expect(isChangeable({ status, startTime: START }, BEFORE)).toBe(
        changeable,
      )
    },
  )

  it('should not be so at the moment the booking begins', () => {
    expect(
      isChangeable({ status: 'confirmed', startTime: START }, new Date(START)),
    ).toBe(false)
  })

  it('should not be so after the booking began, whatever its state says', () => {
    expect(
      isChangeable(
        { status: 'pending', startTime: START },
        new Date('2026-11-24T01:30:00.001Z'),
      ),
    ).toBe(false)
  })
})

describe('isMovable', () => {
  it('should be so for a booking of one service with the member of the staff of the booking', () => {
    expect(isMovable(booking)).toBe(true)
  })

  it('should not be so for a booking the salon added a service to', () => {
    expect(
      isMovable({
        ...booking,
        services: [...booking.services, ...booking.services],
      }),
    ).toBe(false)
  })

  it('should not be so when the service is with another member of the staff', () => {
    expect(
      isMovable({
        ...booking,
        services: booking.services.map((service) => ({
          ...service,
          staffId: '7092b4d5-f186-43ac-a4ce-60829bbdd1df',
        })),
      }),
    ).toBe(false)
  })

  it('should not be so when nobody is named for the service', () => {
    expect(
      isMovable({
        ...booking,
        services: booking.services.map((service) => ({
          ...service,
          staffId: null,
        })),
      }),
    ).toBe(false)
  })

  it('should not be so for a booking without a service', () => {
    expect(isMovable({ ...booking, services: [] })).toBe(false)
  })
})

describe('moveHrefOf', () => {
  it('should open the screen that moves the booking with its member of the staff and its day', () => {
    expect(moveHrefOf(booking)).toBe(
      `/bookings/${booking.id}/reschedule?staffId=${booking.staffId}&date=2026-11-24`,
    )
  })
})

describe('serviceIdOf', () => {
  it('should be the first service of the booking', () => {
    expect(serviceIdOf(booking)).toBe(SERVICE?.serviceId)
  })

  it('should be none for a booking without a service', () => {
    expect(serviceIdOf({ services: [] })).toBeUndefined()
  })
})

describe('namedBy', () => {
  it('should name every salon and every service once, in the order they are first named', () => {
    expect(
      namedBy([
        another('a'),
        ofOtherService('b', OTHER_SALON_ID),
        another('c'),
        ofOtherService('d', OTHER_SALON_ID),
      ]),
    ).toEqual({
      salonIds: [booking.salonId, OTHER_SALON_ID],
      services: [
        { salonId: booking.salonId, serviceId: SERVICE?.serviceId },
        { salonId: OTHER_SALON_ID, serviceId: OTHER_SERVICE_ID },
      ],
    })
  })

  it('should name the salon of a booking without a service, and no service', () => {
    expect(namedBy([another('a', { services: [] })])).toEqual({
      salonIds: [booking.salonId],
      services: [],
    })
  })

  it('should name nothing for no booking', () => {
    expect(namedBy([])).toEqual({ salonIds: [], services: [] })
  })
})

describe('rowsOf', () => {
  it('should give every booking its row, with the names that were read, in the order of the bookings', () => {
    const [first, second] = [another('a'), another('b')]

    expect(rowsOf([first, second], named())).toEqual({
      rows: [
        { booking: first, salon: SALON, serviceName: 'レディースカット' },
        { booking: second, salon: SALON, serviceName: 'レディースカット' },
      ],
      rest: { type: 'none' },
    })
  })

  it('should ask for the salon of each booking, and for its service', () => {
    const asked: string[] = []

    rowsOf(
      [another('a'), ofOtherService('b', OTHER_SALON_ID)],
      named({
        salon: (salonId) => {
          asked.push(`salon ${salonId}`)
          return { type: 'found', salon: SALON }
        },
        service: (serviceId) => {
          asked.push(`service ${serviceId}`)
          return { type: 'found', service: { name: 'カット' } }
        },
      }),
    )

    expect(asked.toSorted()).toEqual(
      [
        `salon ${booking.salonId}`,
        `salon ${OTHER_SALON_ID}`,
        `service ${SERVICE?.serviceId}`,
        `service ${OTHER_SERVICE_ID}`,
      ].toSorted(),
    )
  })

  it('should have no row and nothing left for no booking', () => {
    expect(rowsOf([], named())).toEqual({ rows: [], rest: { type: 'none' } })
  })

  it('should give a booking no salon when its salon is no longer there, and go on', () => {
    const gone = ofOtherService('a', OTHER_SALON_ID)
    const there = another('b')

    expect(
      rowsOf(
        [gone, there],
        named({
          salon: (salonId) =>
            salonId === OTHER_SALON_ID
              ? { type: 'notFound' }
              : { type: 'found', salon: SALON },
          service: (serviceId) =>
            serviceId === OTHER_SERVICE_ID
              ? { type: 'notFound' }
              : { type: 'found', service: { name: 'レディースカット' } },
        }),
      ),
    ).toEqual({
      rows: [
        { booking: gone, salon: null, serviceName: null },
        { booking: there, salon: SALON, serviceName: 'レディースカット' },
      ],
      rest: { type: 'none' },
    })
  })

  it('should give a booking no service name when the salon no longer shows the service', () => {
    expect(
      rowsOf([booking], named({ service: () => ({ type: 'notFound' }) })),
    ).toEqual({
      rows: [{ booking, salon: SALON, serviceName: null }],
      rest: { type: 'none' },
    })
  })

  it('should give a booking without a service no service name, and ask for none', () => {
    const bare = another('a', { services: [] })
    const asked: string[] = []

    expect(
      rowsOf(
        [bare],
        named({
          service: (serviceId) => {
            asked.push(serviceId)
            return undefined
          },
        }),
      ),
    ).toEqual({
      rows: [{ booking: bare, salon: SALON, serviceName: null }],
      rest: { type: 'none' },
    })
    expect(asked).toEqual([])
  })

  it.each([
    ['its salon', named({ salon: () => undefined })],
    ['its service', named({ service: () => undefined })],
  ])(
    'should end before the first booking of which %s is on its way, and say that the rest is being read',
    (_case, reads) => {
      expect(rowsOf([booking], reads)).toEqual({
        rows: [],
        rest: { type: 'reading' },
      })
    },
  )

  it('should keep the rows before a booking whose names are on their way, and leave out those after it: a list has no gaps', () => {
    const [first, second, third] = [
      another('a'),
      ofOtherService('b', OTHER_SALON_ID),
      another('c'),
    ]

    expect(
      rowsOf(
        [first, second, third],
        named({
          salon: (salonId) =>
            salonId === OTHER_SALON_ID
              ? undefined
              : { type: 'found', salon: SALON },
        }),
      ),
    ).toEqual({
      rows: [{ booking: first, salon: SALON, serviceName: 'レディースカット' }],
      rest: { type: 'reading' },
    })
  })

  it.each([
    ['its salon', 'failed', named({ salon: () => ({ type: 'failed' }) })],
    ['its service', 'failed', named({ service: () => ({ type: 'failed' }) })],
    [
      'its salon',
      'tooManyRequests',
      named({ salon: () => ({ type: 'tooManyRequests' }) }),
    ],
    [
      'its service',
      'tooManyRequests',
      named({ service: () => ({ type: 'tooManyRequests' }) }),
    ],
  ])(
    'should end before the first booking of which %s could not be read, and say why: %s',
    (_case, reason, reads) => {
      expect(rowsOf([booking], reads)).toEqual({
        rows: [],
        rest: { type: 'unread', reason: { type: reason } },
      })
    },
  )

  it('should say that the names are on their way when the salon is, although the service could not be read: what is waited for comes first', () => {
    expect(
      rowsOf(
        [booking],
        named({
          salon: () => undefined,
          service: () => ({ type: 'failed' }),
        }),
      ),
    ).toEqual({ rows: [], rest: { type: 'reading' } })
  })
})
