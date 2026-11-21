import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { salon } from '../bookings/components/examples'
import {
  acknowledgeAlert,
  alertSummaryKeyOf,
  alertsKeyOf,
  readAlertPage,
  readAlertSummary,
} from './alerts-api'
import {
  ALERTS_OF_THE_SALON,
  outOfGlovesAlert,
  SUMMARY_OF_THE_SALON,
} from './components/examples'

/*
 * What the API answers about the alerts is met with the real API
 * (`alerts.integration.test.tsx`). Here are the answers a test cannot
 * bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

/** The paths and the queries that were asked for */
const askedOf = (fetched: ReturnType<typeof answering>) =>
  fetched.mock.calls.map(([asked]) => {
    const url = new URL(new Request(asked).url)

    return [url.pathname, Object.fromEntries(url.searchParams)]
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('alertsKeyOf and alertSummaryKeyOf', () => {
  it('should read the alerts below the stock of the salon, so that a movement or a count drops them', () => {
    expect(alertsKeyOf(salon.id)).toEqual([
      'salons',
      salon.id,
      'inventory',
      'alerts',
    ])
    expect(alertSummaryKeyOf(salon.id)).toEqual([
      ...alertsKeyOf(salon.id),
      'summary',
    ])
  })
})

describe('readAlertPage', () => {
  it('should ask for a page of 20 alerts of the conditions, after the cursor', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: ALERTS_OF_THE_SALON,
        meta: { total: 22, limit: 20, hasMore: true, nextCursor: 'next' },
        links: null,
      }),
    )

    // Act
    const read = await readAlertPage(
      salon.id,
      { alert: 'expired', severity: 'critical', acknowledged: false },
      'cursor',
    )

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: ALERTS_OF_THE_SALON,
      total: 22,
      nextCursor: 'next',
    })
    expect(askedOf(fetched)).toEqual([
      [
        '/api/v1/inventory-alerts',
        {
          salonId: salon.id,
          alert: 'expired',
          severity: 'critical',
          acknowledged: 'false',
          cursor: 'cursor',
          limit: '20',
        },
      ],
    ])
  })

  it('should ask for the first page of every alert without conditions', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, {
        data: [],
        meta: { total: 0, limit: 20, hasMore: false, nextCursor: null },
        links: null,
      }),
    )

    // Act
    await readAlertPage(salon.id, {}, undefined)

    // Assert
    expect(askedOf(fetched)).toEqual([
      ['/api/v1/inventory-alerts', { salonId: salon.id, limit: '20' }],
    ])
  })

  it.each<[string, Answer, string]>([
    ['the account', () => problem(403), 'forbidden'],
    [
      'a salon, or a row of the cursor, removed meanwhile',
      () => problem(400, [{ field: 'cursor', rule: 'not_found' }]),
      'failed',
    ],
    ...UNREAD,
  ])('should read no alerts after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readAlertPage(salon.id, {}, undefined)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readAlertSummary', () => {
  it('should ask how many alerts the salon has', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: SUMMARY_OF_THE_SALON, meta: null, links: null }),
    )

    // Act
    const read = await readAlertSummary(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', summary: SUMMARY_OF_THE_SALON })
    expect(askedOf(fetched)).toEqual([
      ['/api/v1/inventory-alerts/summary', { salonId: salon.id }],
    ])
  })

  it.each<[string, Answer, string]>([
    ['the account', () => problem(403), 'forbidden'],
    ['a salon removed meanwhile', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should read no count after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readAlertSummary(salon.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('acknowledgeAlert', () => {
  const ACKNOWLEDGEMENT = {
    alert: outOfGlovesAlert.alert,
    productId: outOfGlovesAlert.productId,
    inventoryId: null,
    notes: '10 箱を発注した。',
  }

  it('should send the acknowledgement, and hand over the alert acknowledged', async () => {
    // Arrange
    const fetched = answering(() =>
      json(200, { data: outOfGlovesAlert, meta: null, links: null }),
    )

    // Act
    const acknowledged = await acknowledgeAlert(ACKNOWLEDGEMENT)

    // Assert
    expect(acknowledged).toEqual({
      type: 'acknowledged',
      alert: outOfGlovesAlert,
    })
    const [asked] = fetched.mock.calls.map(
      ([input, init]) => new Request(input, init),
    )
    expect(asked?.method).toBe('POST')
    expect(new URL(asked?.url ?? '').pathname).toBe(
      '/api/v1/inventory-alerts/acknowledge',
    )
    expect(await asked?.json()).toEqual(ACKNOWLEDGEMENT)
  })

  it.each<[string, Answer, unknown]>([
    ['an alert no longer there', () => problem(404), { type: 'gone' }],
    [
      'an alert acknowledged meanwhile',
      () => problem(409),
      { type: 'acknowledgedAlready' },
    ],
    ['the account', () => problem(403), { type: 'forbidden' }],
    ['values the API does not take', () => problem(400), { type: 'failed' }],
    ['a body that is too large', () => problem(413), { type: 'failed' }],
    ['a body of another type', () => problem(415), { type: 'failed' }],
    ...UNREAD.map(([name, answer, type]): [string, Answer, unknown] => [
      name,
      answer,
      { type },
    ]),
  ])('should record nothing after %s', async (_, given, outcome) => {
    // Arrange
    answering(given)

    // Act
    const acknowledged = await acknowledgeAlert(ACKNOWLEDGEMENT)

    // Assert
    expect(acknowledged).toEqual(outcome)
  })
})
