import type { ModelsCustomerCreateRequest } from '@beauty-salon-frontend/api-client'
import {
  answering,
  asked,
  page,
  problem,
  record,
  sent,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aCustomer,
  customers,
  salon,
  staff,
} from '../bookings/components/examples'
import {
  attemptCustomerChange,
  attemptCustomerEntry,
  customerKanaOf,
  customerNameOf,
  findCustomers,
  readCustomer,
  readCustomerPage,
  readCustomers,
  readPreferences,
  readPreferencesToChange,
  readStatistics,
} from './customers-api'

/*
 * That a customer who was removed makes the request of many customers
 * fall back to one request each is met with the real API
 * (`bookings.integration.test.tsx`). Here are the answers a test cannot
 * bring about there.
 */

const [hanako, ichiro] = customers

const ids = customers.map(({ id }) => id)

describe('readCustomers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should ask for each customer once', async () => {
    // Arrange
    const fetched = answering(() => record(200, customers))

    // Act
    const read = await readCustomers([...ids, ...ids])

    // Assert
    expect(read.type === 'found' && [...read.customers.keys()]).toEqual(ids)
    expect(asked(fetched)).toEqual(['POST /customers/batch/get'])
    expect(await sent(fetched)).toEqual([{ ids }])
  })

  it('should ask for nothing when there is nobody to read', async () => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act
    const read = await readCustomers([])

    // Assert
    expect(read.type === 'found' && read.customers.size).toBe(0)
    expect(fetched).not.toHaveBeenCalled()
  })

  it.each(UNREAD)(
    'should say why nothing came of %s',
    async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await readCustomers(ids)).toEqual({ type })
    },
  )

  it.each([403, 413, 415])(
    'should fail on an answer that says nothing a person could act on (%i)',
    async (status) => {
      // Arrange
      answering(() => problem(status))

      // Act, Assert
      expect(await readCustomers(ids)).toEqual({ type: 'failed' })
    },
  )

  it('should say why nothing came of the requests one by one, after a customer was not found', async () => {
    // Arrange
    answering((request) =>
      request.method === 'POST'
        ? problem(404)
        : request.url.endsWith(hanako?.id ?? '')
          ? record(200, hanako)
          : problem(429),
    )

    // Act, Assert
    expect(await readCustomers(ids)).toEqual({ type: 'tooManyRequests' })
  })

  it('should leave out who was not found, one by one', async () => {
    // Arrange
    answering((request) =>
      request.method === 'POST' || !request.url.endsWith(hanako?.id ?? '')
        ? problem(404)
        : record(200, hanako),
    )

    // Act
    const read = await readCustomers(ids)

    // Assert
    expect(read.type === 'found' && [...read.customers.keys()]).toEqual([
      hanako?.id,
    ])
  })
})

describe('readCustomer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ...UNREAD,
    ['a refusal of the account', () => problem(403), 'failed'],
  ])('should say why nothing came of %s', async (_case, answer, type) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(await readCustomer(ichiro?.id ?? '')).toEqual({ type })
  })

  it('should not ask for what is no ID', async () => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act, Assert
    expect(await readCustomer('yamada')).toEqual({ type: 'notFound' })
    expect(fetched).not.toHaveBeenCalled()
  })
})

describe('findCustomers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should ask for the customers that have the keyword, 20 at a time, after the cursor', async () => {
    // Arrange
    const fetched = answering(() => page(customers, ichiro?.id ?? null, 42))

    // Act
    const read = await findCustomers('山田', hanako?.id)

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: customers,
      total: 42,
      nextCursor: ichiro?.id,
    })
    expect(asked(fetched)).toEqual([
      `GET /customers?cursor=${hanako?.id}&limit=20&search=山田`,
    ])
  })

  it.each([
    ...UNREAD,
    ['a refusal of the account', () => problem(403), 'failed'],
    ['a keyword the API does not take', () => problem(400), 'failed'],
  ])('should say why nothing came of %s', async (_case, answer, type) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(await findCustomers('山田', undefined)).toEqual({ type })
  })
})

describe('customerKanaOf', () => {
  it.each([
    ['both names', aCustomer(), 'ヤマダ ハナコ'],
    ['the family name alone', aCustomer({ firstNameKana: null }), 'ヤマダ'],
    ['no name', aCustomer({ lastNameKana: null, firstNameKana: null }), ''],
  ])('should write the kana of %s', (_case, customer, kana) => {
    expect(customerKanaOf(customer)).toBe(kana)
  })
})

describe('customerNameOf', () => {
  it('should name a customer by the family name first', () => {
    expect(customerNameOf(aCustomer())).toBe('山田 花子')
  })
})

const ENTRY: ModelsCustomerCreateRequest = {
  lastName: '山田',
  firstName: '花子',
  lastNameKana: null,
  firstNameKana: null,
  email: 'Hanako@Example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  membershipTier: 'regular',
  preferences: null,
  notes: null,
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: 'HANAKO',
  allowMarketing: false,
  allowSms: false,
  allowEmail: false,
  isActive: true,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
}

const CUSTOMERS = '/api/v1/customers'

/** The answer of a request with the method and the path named */
const answerOf =
  (answers: Record<string, () => Response>) =>
  (request: Request): Response =>
    answers[`${request.method} ${new URL(request.url).pathname}`]?.() ??
    problem(500)

describe('readCustomerPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should ask for the customers that meet the conditions, 20 at a time, after the cursor', async () => {
    // Arrange
    const fetched = answering(() => page(customers))

    // Act
    const read = await readCustomerPage(
      {
        search: '山田',
        tags: ['VIP', '常連'],
        from: '2026-11-01',
        customerStatus: 'vip',
      },
      'Asia/Tokyo',
      hanako?.id,
    )

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: customers,
      total: 2,
      nextCursor: null,
    })
    expect(asked(fetched)).toEqual([
      `GET /customers?cursor=${hanako?.id}&customerStatus=vip&limit=20&registeredFrom=2026-10-31T15:00:00.000Z&search=山田&tags=VIP&tags=常連`,
    ])
  })

  it.each([
    ...UNREAD,
    ['a refusal of the account', () => problem(403), 'failed'],
    ['a cursor the API does not take', () => problem(400), 'failed'],
  ])('should say why nothing came of %s', async (_case, answer, type) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(
      await readCustomerPage({ tags: [] }, 'Asia/Tokyo', undefined),
    ).toEqual({
      type,
    })
  })
})

describe('attemptCustomerEntry and attemptCustomerChange', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const customer = aCustomer()

  it.each<[string, () => Promise<{ type: string }>, string, unknown]>([
    [
      'a registration',
      () => attemptCustomerEntry(ENTRY),
      'POST /customers',
      ENTRY,
    ],
    [
      'a change',
      () => attemptCustomerChange(customer.id, { tags: ['VIP'] }),
      `PATCH /customers/${customer.id}`,
      { tags: ['VIP'] },
    ],
  ])('should send %s', async (_what, call, line, body) => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act
    await call()

    // Assert
    expect(asked(fetched)).toEqual([line])
    expect(await sent(fetched)).toEqual([body])
  })

  describe.each<[string, () => Promise<{ type: string }>]>([
    ['attemptCustomerEntry', () => attemptCustomerEntry(ENTRY)],
    [
      'attemptCustomerChange',
      () => attemptCustomerChange(customer.id, { tags: [] }),
    ],
  ])('%s', (_name, call) => {
    it.each([
      ...UNREAD,
      ['a body the API did not read (413)', () => problem(413), 'failed'],
      ['a body the API did not read (415)', () => problem(415), 'failed'],
    ])('should say why nothing came of %s', async (_case, answer, type) => {
      // Arrange
      answering(answer)

      // Act, Assert
      expect(await call()).toEqual({ type })
    })
  })

  it("should say the address of mail is another customer's, when the ledger has it", async () => {
    // Arrange
    const fetched = answering(
      answerOf({
        [`POST ${CUSTOMERS}`]: () => problem(409),
        [`GET ${CUSTOMERS}`]: () =>
          page([aCustomer({ id: 'other', email: 'hanako@example.com' })]),
      }),
    )

    // Act
    const attempt = await attemptCustomerEntry(ENTRY)

    // Assert
    expect(attempt).toEqual({ type: 'duplicate', field: 'email' })
    expect(asked(fetched)).toEqual([
      'POST /customers',
      'GET /customers?limit=100&search=Hanako@Example.com',
    ])
  })

  it("should say the referral code is another customer's, when nobody else has the address of mail", async () => {
    // Arrange
    answering(
      answerOf({
        [`PATCH ${CUSTOMERS}/${customer.id}`]: () => problem(409),
        // The customer who is changed has the address, and one has an address that holds it
        [`GET ${CUSTOMERS}`]: () =>
          page([
            customer,
            aCustomer({ id: 'other', email: `x.${customer.email}` }),
          ]),
      }),
    )

    // Act, Assert
    expect(
      await attemptCustomerChange(customer.id, {
        email: customer.email,
        referralCode: 'HANAKO',
      }),
    ).toEqual({ type: 'duplicate', field: 'referralCode' })
  })

  it.each<
    [
      string,
      (
        | ModelsCustomerCreateRequest
        | { email?: string; referralCode?: string | null }
      ),
      string,
    ]
  >([
    [
      'the address of mail, when no referral code was sent',
      { ...ENTRY, referralCode: null },
      'email',
    ],
    [
      'the referral code, when no address of mail was sent',
      { referralCode: 'HANAKO' },
      'referralCode',
    ],
  ])('should say %s without asking again', async (_case, request, field) => {
    // Arrange
    const fetched = answering(() => problem(409))

    // Act
    const attempt =
      'lastName' in request
        ? await attemptCustomerEntry(request)
        : await attemptCustomerChange(customer.id, request)

    // Assert
    expect(attempt).toEqual({ type: 'duplicate', field })
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it('should say why nothing came of asking whose the address of mail is', async () => {
    // Arrange
    answering(
      answerOf({
        [`POST ${CUSTOMERS}`]: () => problem(409),
        [`GET ${CUSTOMERS}`]: () => problem(429),
      }),
    )

    // Act, Assert
    expect(await attemptCustomerEntry(ENTRY)).toEqual({
      type: 'tooManyRequests',
    })
  })
})

describe('readPreferences and readPreferencesToChange', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const [misaki, ken] = staff
  const customer = aCustomer()
  const PREFERENCES = `${CUSTOMERS}/${customer.id}/preferences`

  const preferences = (
    preferredStaffId: string | null,
    avoidStaffIds: string[],
  ) =>
    record(200, {
      preferredStaffId,
      avoidStaffIds,
      preferredTimeSlots: [],
      stylePreferences: null,
      communicationStyle: null,
      specialRequests: null,
    })

  const profile = (member: (typeof staff)[number] | undefined) => () =>
    record(200, member)

  it('should read the members the preferences name, each once, and leave out one who is not shown', async () => {
    // Arrange
    const fetched = answering(
      answerOf({
        [`GET ${PREFERENCES}`]: () =>
          preferences(misaki?.id ?? '', [
            ken?.id ?? '',
            'gone',
            misaki?.id ?? '',
          ]),
        [`GET /api/v1/staff-profiles/${misaki?.id}`]: profile(misaki),
        [`GET /api/v1/staff-profiles/${ken?.id}`]: profile(ken),
        'GET /api/v1/staff-profiles/gone': () => problem(404),
      }),
    )

    // Act
    const read = await readPreferences(customer.id)

    // Assert
    expect(read.type === 'found' && [...read.staff.keys()]).toEqual([
      misaki?.id,
      ken?.id,
    ])
    expect(fetched).toHaveBeenCalledTimes(4)
  })

  it('should say why nothing came of reading a member the preferences name, when another was read', async () => {
    // Arrange
    answering(
      answerOf({
        [`GET ${PREFERENCES}`]: () =>
          preferences(misaki?.id ?? '', [ken?.id ?? '']),
        [`GET /api/v1/staff-profiles/${misaki?.id}`]: profile(misaki),
        [`GET /api/v1/staff-profiles/${ken?.id}`]: () => problem(429),
      }),
    )

    // Act, Assert
    expect(await readPreferences(customer.id)).toEqual({
      type: 'tooManyRequests',
    })
  })

  it('should say why nothing came of reading a member of another salon, when another was read', async () => {
    // Arrange
    answering(
      answerOf({
        [`GET ${PREFERENCES}`]: () =>
          preferences(misaki?.id ?? '', [ken?.id ?? '']),
        'GET /api/v1/staff-profiles': () => page([]),
        [`GET /api/v1/staff-profiles/${misaki?.id}`]: profile(misaki),
        [`GET /api/v1/staff-profiles/${ken?.id}`]: () => problem(429),
      }),
    )

    // Act, Assert
    expect(await readPreferencesToChange(customer.id, salon)).toEqual({
      type: 'tooManyRequests',
    })
  })

  it('should say why nothing came of reading the salon of a member of another salon, when another salon was read', async () => {
    // Arrange
    const OTHER = '5d2c7e91-3a4b-4f6e-9c8d-1e2f3a4b5c6d'
    const ANOTHER = '6e3d8fa2-4b5c-4a7f-8d9e-2f3a4b5c6d7e'
    answering(
      answerOf({
        [`GET ${PREFERENCES}`]: () =>
          preferences(misaki?.id ?? '', [ken?.id ?? '']),
        'GET /api/v1/staff-profiles': () => page([]),
        [`GET /api/v1/staff-profiles/${misaki?.id}`]: () =>
          record(200, { ...misaki, salonId: OTHER }),
        [`GET /api/v1/staff-profiles/${ken?.id}`]: () =>
          record(200, { ...ken, salonId: ANOTHER }),
        [`GET /api/v1/salons/${OTHER}`]: () =>
          record(200, { ...salon, id: OTHER }),
        [`GET /api/v1/salons/${ANOTHER}`]: () => problem(429),
      }),
    )

    // Act, Assert
    expect(await readPreferencesToChange(customer.id, salon)).toEqual({
      type: 'tooManyRequests',
    })
  })

  it.each([
    ...UNREAD,
    ['a customer who is not in the ledger', () => problem(404), 'notFound'],
    ['a refusal of the account', () => problem(403), 'failed'],
  ])('should say why nothing came of %s', async (_case, answer, type) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(await readPreferences(customer.id)).toEqual({ type })
  })
})

describe('readStatistics', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const customer = aCustomer()

  it('should ask for what a customer did at a salon over a period', async () => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act
    await readStatistics(customer.id, 'salon', {
      from: '2025-11-20',
      to: '2026-11-20',
    })

    // Assert
    expect(asked(fetched)).toEqual([
      `GET /customers/${customer.id}/statistics?endDate=2026-11-20&salonId=salon&startDate=2025-11-20`,
    ])
  })

  it.each([
    ...UNREAD,
    ['a customer who is not in the ledger', () => problem(404), 'notFound'],
    ["a salon that is not the account's", () => problem(403), 'forbidden'],
    ['a salon that was removed', () => problem(400), 'failed'],
  ])('should say why nothing came of %s', async (_case, answer, type) => {
    // Arrange
    answering(answer)

    // Act, Assert
    expect(
      await readStatistics(customer.id, 'salon', {
        from: '2026-11-20',
        to: '2026-11-20',
      }),
    ).toEqual({ type })
  })
})
