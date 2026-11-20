import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { aCustomer } from '../bookings/components/examples'
import {
  chartListParamsOf,
  createChart,
  readChart,
  readChartPage,
  updateChart,
} from './charts-api'
import { aChart } from './components/examples'

/*
 * What the API answers to the charts is met with the real API
 * (`charts.integration.test.tsx`). Here are the answers a test cannot
 * bring about there.
 */

const chart = aChart()

const customer = aCustomer()

const {
  customerId: _customerId,
  id: _id,
  createdAt: _c,
  updatedAt: _u,
  ...written
} = chart

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readChart', () => {
  it('should read the chart of the customer', async () => {
    // Arrange
    const fetched = answering(() => json(200, { data: chart, meta: null }))

    // Act
    const read = await readChart(customer.id)

    // Assert
    expect(read).toEqual({ type: 'read', chart })
    const [asked] = fetched.mock.calls[0] ?? []
    expect(new Request(asked ?? '').url).toMatch(
      new RegExp(`/medical-charts/customer/${customer.id}$`),
    )
  })

  it('should take 404 as no chart', async () => {
    // Arrange
    answering(() => problem(404))

    // Act
    const read = await readChart(customer.id)

    // Assert
    expect(read).toEqual({ type: 'read', chart: null })
  })

  it.each<[string, () => Response]>([
    ['403', () => problem(403)],
    ['400', () => problem(400)],
  ])('should read nothing after %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readChart(customer.id)

    // Assert
    expect(read).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readChart(customer.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('chartListParamsOf', () => {
  it.each<[string, Parameters<typeof chartListParamsOf>[0], object]>([
    ['no condition', {}, {}],
    ['a keyword', { search: 'カラー' }, { search: 'カラー' }],
    ['allergies recorded', { allergies: 'with' }, { hasAllergies: true }],
    [
      'no allergies recorded',
      { allergies: 'without' },
      { hasAllergies: false },
    ],
  ])('should ask for %s', (_, conditions, params) => {
    // Act
    const asked = chartListParamsOf(conditions)

    // Assert
    expect(asked).toEqual(params)
  })
})

describe('readChartPage', () => {
  it('should leave out the customer of a chart who left the ledger between the two reads', async () => {
    // Arrange
    const other = aChart({
      id: 'e5c7a9b1-3d4f-4c6e-8a0b-2f4d6b8c0e13',
      customerId: 'f6d8b0c2-4e5a-4d7f-9b1c-3a5e7c9d1f24',
    })
    answering((request) => {
      const { pathname } = new URL(request.url)
      if (pathname.endsWith('/medical-charts')) {
        return json(200, {
          data: [chart, other],
          meta: { total: 2, nextCursor: null },
        })
      }
      if (pathname.endsWith('/customers/batch/get')) {
        return problem(404)
      }

      return pathname.endsWith(customer.id)
        ? json(200, { data: customer, meta: null })
        : problem(404)
    })

    // Act
    const read = await readChartPage({}, undefined)

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: [
        { chart, customer },
        { chart: other, customer: undefined },
      ],
      total: 2,
      nextCursor: null,
    })
  })

  it('should read nothing when the customers could not be read', async () => {
    // Arrange
    answering((request) =>
      new URL(request.url).pathname.endsWith('/medical-charts')
        ? json(200, { data: [chart], meta: { total: 1, nextCursor: null } })
        : problem(429),
    )

    // Act
    const read = await readChartPage({}, undefined)

    // Assert
    expect(read).toEqual({ type: 'tooManyRequests' })
  })

  it('should take 403 as nothing read', async () => {
    // Arrange
    answering(() => problem(403))

    // Act
    const read = await readChartPage({ search: 'カラー' }, undefined)

    // Assert
    expect(read).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readChartPage({}, 'a-cursor')

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('createChart', () => {
  it('should take a refused customer as one who left the ledger', async () => {
    // Arrange
    answering(() => problem(400, [{ field: 'customerId', rule: 'not_found' }]))

    // Act
    const outcome = await createChart({ customerId: customer.id, ...written })

    // Assert
    expect(outcome).toEqual({ type: 'notFound' })
  })

  it.each<[string, () => Response, string]>([
    ['403', () => problem(403), 'forbidden'],
    ['413', () => problem(413), 'failed'],
    ['415', () => problem(415), 'failed'],
  ])('should take %s as %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await createChart({ customerId: customer.id, ...written })

    // Assert
    expect(outcome).toEqual({ type })
  })

  it.each(UNREAD)('should write nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await createChart({ customerId: customer.id, ...written })

    // Assert
    expect(outcome).toEqual({ type })
  })
})

describe('updateChart', () => {
  it('should send what was changed to the chart', async () => {
    // Arrange
    const fetched = answering(() => json(200, { data: chart, meta: null }))

    // Act
    const outcome = await updateChart(chart.id, { notes: null })

    // Assert
    expect(outcome).toEqual({ type: 'written', chart })
    const [asked, init] = fetched.mock.calls[0] ?? []
    const sent = new Request(asked ?? '', init)
    expect(sent.method).toBe('PATCH')
    expect(sent.url).toMatch(new RegExp(`/medical-charts/${chart.id}$`))
    expect(await sent.json()).toEqual({ notes: null })
  })

  it.each<[string, () => Response, string]>([
    ['403', () => problem(403), 'forbidden'],
    ['413', () => problem(413), 'failed'],
    ['415', () => problem(415), 'failed'],
  ])('should take %s as %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await updateChart(chart.id, { notes: null })

    // Assert
    expect(outcome).toEqual({ type })
  })

  it.each(UNREAD)('should write nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const outcome = await updateChart(chart.id, { notes: null })

    // Assert
    expect(outcome).toEqual({ type })
  })
})
