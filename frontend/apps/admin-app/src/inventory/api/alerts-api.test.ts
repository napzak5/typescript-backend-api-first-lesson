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
import { salon } from '../../bookings/components/examples'
import {
  ALERTS_OF_THE_SALON,
  outOfGlovesAlert,
  SUMMARY_OF_THE_SALON,
} from '../components/examples'
import {
  acknowledgeAlert,
  alertSummaryKeyOf,
  alertsKeyOf,
  readAlertPage,
  readAlertSummary,
} from './alerts-api'

/*
 * What the API answers about the alerts is met with the real API
 * (`alerts.integration.test.tsx`). Here are the answers a test cannot
 * bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

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
    const fetched = answering(() => page(ALERTS_OF_THE_SALON, 'next', 22))

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
    expect(asked(fetched)).toEqual([
      `GET /inventory-alerts?acknowledged=false&alert=expired&cursor=cursor&limit=20&salonId=${salon.id}&severity=critical`,
    ])
  })

  it('should ask for the first page of every alert without conditions', async () => {
    // Arrange
    const fetched = answering(() => page([]))

    // Act
    await readAlertPage(salon.id, {}, undefined)

    // Assert
    expect(asked(fetched)).toEqual([
      `GET /inventory-alerts?limit=20&salonId=${salon.id}`,
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
    const fetched = answering(() => record(200, SUMMARY_OF_THE_SALON))

    // Act
    const read = await readAlertSummary(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', summary: SUMMARY_OF_THE_SALON })
    expect(asked(fetched)).toEqual([
      `GET /inventory-alerts/summary?salonId=${salon.id}`,
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
    const fetched = answering(() => record(200, outOfGlovesAlert))

    // Act
    const acknowledged = await acknowledgeAlert(ACKNOWLEDGEMENT)

    // Assert
    expect(acknowledged).toEqual({
      type: 'acknowledged',
      alert: outOfGlovesAlert,
    })
    expect(asked(fetched)).toEqual(['POST /inventory-alerts/acknowledge'])
    expect(await sent(fetched)).toEqual([ACKNOWLEDGEMENT])
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
