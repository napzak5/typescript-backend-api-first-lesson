import {
  answering,
  json,
  problem,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aBooking,
  aPaidSale,
  aPayment,
  aSale,
  paymentMethods,
  salon,
} from './components/examples'
import {
  attemptPayment,
  attemptReceipt,
  attemptRefund,
  attemptSale,
  attemptSaleChange,
  attemptVoid,
  calculateSale,
  createSale,
  readPaymentMethods,
  readReceipt,
  readSale,
  readSales,
  readSalesOfBooking,
  recordPayment,
  refundPayment,
  updateSale,
  voidSale,
} from './sales-api'

/*
 * The answers the real API gives are met in the screen tests
 * (`sales.integration.test.tsx`). Here are the ones a test cannot bring
 * about there (too many requests, an error of the server, no answer, a
 * status the contract does not name, a body the API did not read), what
 * every call sends, and how a conflict is found out about.
 */

const sale = aSale()
const booking = aBooking()

const SALE_REQUEST = {
  salonId: salon.id,
  customerId: booking.customerId,
  staffId: null,
  bookingId: booking.id,
  saleTime: '2026-11-20T02:05:00.000Z',
  pointsUsed: null,
  pointsEarned: null,
  notes: null,
  details: sale.details,
}

const PAYMENT = {
  paymentMethodId: paymentMethods[0]?.id ?? '',
  amount: 3000,
  cardLastFour: null,
  cardBrand: null,
}

const CALCULATION = { salonId: salon.id, bookingId: booking.id, services: [] }

const CHANGE = { saleTime: '2026-11-20T01:30:00.000Z' }

const VOIDING = { voidReason: '取り違え' }

const REFUND = { refundAmount: 3000, refundReason: '施術のやり直し' }

const payment = aPayment()

/** The calls that send a body, and name the values the API refused */
const WRITES: [string, () => Promise<{ type: string }>][] = [
  ['calculateSale', () => calculateSale(CALCULATION)],
  ['createSale', () => createSale(SALE_REQUEST)],
  ['recordPayment', () => recordPayment(sale.id, PAYMENT)],
  ['updateSale', () => updateSale(sale.id, CHANGE)],
  ['voidSale', () => voidSale(sale.id, VOIDING)],
  ['refundPayment', () => refundPayment(payment.id, REFUND)],
]

const READS: [string, () => Promise<{ type: string }>][] = [
  [
    'readSales',
    () =>
      readSales(salon.id, { from: '2026-11-20', to: '2026-11-20' }, undefined),
  ],
  ['readSalesOfBooking', () => readSalesOfBooking(salon.id, booking.id)],
  ['readSale', () => readSale(sale.id)],
  ['readReceipt', () => readReceipt(sale.id)],
  ['readPaymentMethods', () => readPaymentMethods(salon.id)],
]

const page = (data: unknown[], nextCursor: string | null = null) =>
  json(200, {
    data,
    meta: { total: data.length, nextCursor },
    links: { self: '/api/v1/sales' },
  })

/** The answer of a request to a path that ends so, with the method named */
const answerOf =
  (answers: Record<string, () => Response>) =>
  (request: Request): Response => {
    const { pathname, search } = new URL(request.url)
    const answer =
      answers[`${request.method} ${pathname}${search}`] ??
      answers[`${request.method} ${pathname}`]

    return answer === undefined ? problem(500) : answer()
  }

describe('the functions that call the API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each([...READS, ...WRITES])('%s', (_name, call) => {
    it.each(UNREAD)(
      'should say why nothing came of %s',
      async (_case, answer, type) => {
        // Arrange
        answering(answer)

        // Act, Assert
        expect(await call()).toEqual({ type })
      },
    )
  })

  describe.each(WRITES)('%s', (_name, call) => {
    it.each([413, 415])(
      'should fail on a body the API did not read (%i)',
      async (status) => {
        // Arrange
        answering(() => problem(status))

        // Act, Assert
        expect(await call()).toEqual({ type: 'failed' })
      },
    )
  })

  it('should ask for the sales of a range of days, of the state named, 50 at a time', async () => {
    // Arrange
    const fetched = answering(() => page([]))

    // Act
    await readSales(
      salon.id,
      { from: '2026-11-01', to: '2026-11-20', paymentStatus: 'processing' },
      sale.id,
    )

    // Assert
    const asked = new URL(String(fetched.mock.calls[0]?.[0]))
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      salonId: salon.id,
      startDate: '2026-11-01',
      endDate: '2026-11-20',
      paymentStatus: 'processing',
      cursor: sale.id,
      limit: '50',
    })
  })

  it('should read the sales of a booking to the end, 100 at a time', async () => {
    // Arrange
    const voided = aSale({ id: 'voided', isVoid: true })
    const fetched = answering((request) =>
      new URL(request.url).searchParams.get('cursor') === null
        ? page([voided], voided.id)
        : page([sale]),
    )

    // Act
    const read = await readSalesOfBooking(salon.id, booking.id)

    // Assert
    expect(read).toEqual({ type: 'found', sales: [voided, sale] })
    const asked = new URL(String(fetched.mock.calls[1]?.[0]))
    expect(Object.fromEntries(asked.searchParams)).toEqual({
      salonId: salon.id,
      bookingId: booking.id,
      cursor: voided.id,
      limit: '100',
    })
  })

  it('should send the payment it records', async () => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act
    await recordPayment(sale.id, PAYMENT)

    // Assert
    const [input, init] = fetched.mock.calls[0] ?? []
    expect(String(input)).toMatch(new RegExp(`/sales/${sale.id}/process$`))
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual(PAYMENT)
  })

  it.each<[string, () => Promise<unknown>, string, string, unknown]>([
    [
      'a change of a sale',
      () => updateSale(sale.id, CHANGE),
      `/sales/${sale.id}`,
      'PATCH',
      CHANGE,
    ],
    [
      'the voiding of a sale',
      () => voidSale(sale.id, VOIDING),
      `/sales/${sale.id}/void`,
      'POST',
      VOIDING,
    ],
    [
      'a refund',
      () => refundPayment(payment.id, REFUND),
      `/payments/${payment.id}/refund`,
      'POST',
      REFUND,
    ],
  ])('should send %s', async (_what, call, path, method, body) => {
    // Arrange
    const fetched = answering(() => problem(500))

    // Act
    await call()

    // Assert
    const [input, init] = fetched.mock.calls[0] ?? []
    expect(String(input)).toMatch(new RegExp(`${path}$`))
    expect(init?.method).toBe(method)
    expect(JSON.parse(String(init?.body))).toEqual(body)
  })

  it.each<[string, () => Promise<{ type: string }>]>([
    ['a sale', () => readSale('new')],
    ['a receipt', () => readReceipt('new')],
  ])(
    'should not ask for %s when the address holds no ID',
    async (_what, call) => {
      // Arrange
      const fetched = answering(() => problem(500))

      // Act
      const read = await call()

      // Assert
      expect(read).toEqual({ type: 'notFound' })
      expect(fetched).not.toHaveBeenCalled()
    },
  )
})

describe('the attempts that find out why the API refused', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const SALES = `/api/v1/sales`

  it('should show the sale a booking was billed by meanwhile', async () => {
    // Arrange
    const voided = aSale({ id: 'voided', isVoid: true })
    answering(
      answerOf({
        [`POST ${SALES}`]: () => problem(409),
        [`GET ${SALES}`]: () => page([voided, sale]),
      }),
    )

    // Act, Assert
    expect(await attemptSale(SALE_REQUEST)).toEqual({ type: 'billed', sale })
  })

  it('should say a booking with no sale is not billed for the time zone of the salon', async () => {
    // Arrange
    answering(
      answerOf({
        [`POST ${SALES}`]: () => problem(409),
        [`GET ${SALES}`]: () => page([aSale({ isVoid: true })]),
      }),
    )

    // Act, Assert
    expect(await attemptSale(SALE_REQUEST)).toEqual({ type: 'unbillable' })
  })

  it('should say why nothing came of reading the sales of the booking again', async () => {
    // Arrange
    answering(
      answerOf({
        [`POST ${SALES}`]: () => problem(409),
        [`GET ${SALES}`]: () => problem(429),
      }),
    )

    // Act, Assert
    expect(await attemptSale(SALE_REQUEST)).toEqual({
      type: 'tooManyRequests',
    })
  })

  it('should not read again what was not refused for a conflict', async () => {
    // Arrange
    const fetched = answering(() =>
      problem(400, [{ field: 'staffId', rule: 'not_found' }]),
    )

    // Act, Assert
    expect(await attemptSale(SALE_REQUEST)).toEqual({
      type: 'invalid',
      values: [{ field: 'staffId', rule: 'not_found' }],
    })
    expect(fetched).toHaveBeenCalledOnce()
  })

  it('should show the sale as it is now when it takes no payment', async () => {
    // Arrange
    const voided = aSale({ isVoid: true })
    answering(
      answerOf({
        [`POST ${SALES}/${sale.id}/process`]: () => problem(409),
        [`GET ${SALES}/${sale.id}`]: () =>
          json(200, { data: voided, meta: {}, links: { self: '' } }),
      }),
    )

    // Act, Assert
    expect(await attemptPayment(sale.id, PAYMENT)).toEqual({
      type: 'refused',
      sale: voided,
    })
  })

  it('should say a sale that is gone after a conflict is not found', async () => {
    // Arrange
    answering(
      answerOf({
        [`POST ${SALES}/${sale.id}/process`]: () => problem(409),
        [`GET ${SALES}/${sale.id}`]: () => problem(404),
      }),
    )

    // Act, Assert
    expect(await attemptPayment(sale.id, PAYMENT)).toEqual({
      type: 'notFound',
    })
  })

  it('should show the sale as it is now when it has no receipt', async () => {
    // Arrange
    answering(
      answerOf({
        [`GET ${SALES}/${sale.id}/receipt`]: () => problem(409),
        [`GET ${SALES}/${sale.id}`]: () =>
          json(200, { data: sale, meta: {}, links: { self: '' } }),
      }),
    )

    // Act, Assert
    expect(await attemptReceipt(sale.id)).toEqual({ type: 'unissued', sale })
  })

  it('should show a sale voided meanwhile as it is now, when it is not changed', async () => {
    // Arrange
    const voided = aSale({ isVoid: true })
    answering(
      answerOf({
        [`PATCH ${SALES}/${sale.id}`]: () => problem(409),
        [`GET ${SALES}/${sale.id}`]: () =>
          json(200, { data: voided, meta: {}, links: { self: '' } }),
      }),
    )

    // Act, Assert
    expect(await attemptSaleChange(sale.id, CHANGE)).toEqual({
      type: 'refused',
      sale: voided,
    })
  })

  it('should say a sale that is not void is not changed for the time zone of the salon', async () => {
    // Arrange
    answering(
      answerOf({
        [`PATCH ${SALES}/${sale.id}`]: () => problem(409),
        [`GET ${SALES}/${sale.id}`]: () =>
          json(200, { data: sale, meta: {}, links: { self: '' } }),
      }),
    )

    // Act, Assert
    expect(await attemptSaleChange(sale.id, CHANGE)).toEqual({
      type: 'undated',
    })
  })

  it('should say why nothing came of reading a sale again that was not changed', async () => {
    // Arrange
    answering(
      answerOf({
        [`PATCH ${SALES}/${sale.id}`]: () => problem(409),
        [`GET ${SALES}/${sale.id}`]: () => problem(500),
      }),
    )

    // Act, Assert
    expect(await attemptSaleChange(sale.id, CHANGE)).toEqual({
      type: 'failed',
    })
  })

  it('should show a sale paid meanwhile as it is now, when it is not voided', async () => {
    // Arrange
    const paid = aPaidSale()
    answering(
      answerOf({
        [`POST ${SALES}/${sale.id}/void`]: () => problem(409),
        [`GET ${SALES}/${sale.id}`]: () =>
          json(200, { data: paid, meta: {}, links: { self: '' } }),
      }),
    )

    // Act, Assert
    expect(await attemptVoid(sale.id, VOIDING)).toEqual({
      type: 'refused',
      sale: paid,
    })
  })

  it('should show the sale as it is now when its payment is not given back', async () => {
    // Arrange
    const given = aSale({
      payments: [aPayment({ status: 'refunded', refundAmount: 3000 })],
    })
    answering(
      answerOf({
        [`POST /api/v1/payments/${payment.id}/refund`]: () => problem(409),
        [`GET ${SALES}/${sale.id}`]: () =>
          json(200, { data: given, meta: {}, links: { self: '' } }),
      }),
    )

    // Act, Assert
    expect(await attemptRefund(sale.id, payment.id, REFUND)).toEqual({
      type: 'refused',
      sale: given,
    })
  })

  it('should not read again what was given back', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: payment, meta: {}, links: { self: '' } }),
    )

    // Act, Assert
    expect(await attemptRefund(sale.id, payment.id, REFUND)).toEqual({
      type: 'refunded',
    })
    expect(fetched).toHaveBeenCalledOnce()
  })
})
