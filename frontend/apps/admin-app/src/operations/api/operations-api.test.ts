import {
  answering,
  asked,
  json,
  problem,
  record,
  sent,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aDeletionRequest, aHealth } from '../components/examples'
import {
  executeDeletionRequests,
  expirePoints,
  purgeAttachments,
  readSystemState,
} from './operations-api'

/*
 * What the API answers to the operations is met with the real API
 * (`operations.integration.test.tsx`). Here are the answers a test cannot
 * bring about there: a database that does not answer, a server that
 * fails, and no answer at all.
 */

type Answer = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
})

const NO_ANSWER: Answer = () => Promise.reject(new TypeError('Failed to fetch'))

/** Lets each probe answer as given, by its path */
const probesAnswering = (answers: Record<string, Answer>) =>
  answering((request) => {
    const answer = answers[new URL(request.url).pathname]
    return answer === undefined ? problem(404) : answer()
  })

describe('readSystemState', () => {
  it('should ask the three probes, and tell an API that runs', async () => {
    // Arrange
    const health = aHealth()
    const fetched = probesAnswering({
      '/api/system/alive': () => json(200, { alive: true }),
      '/api/system/ready': () => json(200, { ready: true, reason: null }),
      '/api/system/health': () => json(200, health),
    })

    // Act
    const state = await readSystemState()

    // Assert
    expect(state).toEqual({
      liveness: { type: 'alive' },
      readiness: { type: 'ready' },
      health: { type: 'reported', health },
    })
    expect(asked(fetched).toSorted()).toEqual([
      'GET http://localhost:3000/api/system/alive',
      'GET http://localhost:3000/api/system/health',
      'GET http://localhost:3000/api/system/ready',
    ])
  })

  it('should tell an API that runs and cannot reach its database, from the answers 503', async () => {
    // Arrange
    const health = aHealth({ status: 'unhealthy' })
    probesAnswering({
      '/api/system/alive': () => json(200, { alive: true }),
      '/api/system/ready': () =>
        json(503, { ready: false, reason: 'database' }),
      '/api/system/health': () => json(503, health),
    })

    // Act
    const state = await readSystemState()

    // Assert
    expect(state).toEqual({
      liveness: { type: 'alive' },
      readiness: { type: 'notReady', reason: 'database' },
      health: { type: 'reported', health },
    })
  })

  it('should tell an API that takes no requests without saying why', async () => {
    // Arrange
    probesAnswering({
      '/api/system/alive': () => json(200, { alive: true }),
      '/api/system/ready': () => json(503, { ready: false, reason: null }),
      '/api/system/health': () => json(200, aHealth()),
    })

    // Act
    const { readiness } = await readSystemState()

    // Assert
    expect(readiness).toEqual({ type: 'notReady', reason: null })
  })

  it.each<[string, Answer]>([
    ['no answer', NO_ANSWER],
    ['a gateway that answers for the API', () => problem(502)],
  ])(
    'should tell each probe that says nothing after %s, and the others as they answered',
    async (_, given) => {
      // Arrange
      probesAnswering({
        '/api/system/alive': () => json(200, { alive: true }),
        '/api/system/ready': given,
        '/api/system/health': given,
      })

      // Act
      const state = await readSystemState()

      // Assert
      expect(state).toEqual({
        liveness: { type: 'alive' },
        readiness: { type: 'silent' },
        health: { type: 'silent' },
      })
    },
  )

  it.each<[string, Answer]>([
    ['no answer', NO_ANSWER],
    ['a gateway that answers for the API', () => problem(503)],
  ])(
    'should tell a process that does not answer after %s',
    async (_, given) => {
      // Arrange
      probesAnswering({
        '/api/system/alive': given,
        '/api/system/ready': NO_ANSWER,
        '/api/system/health': NO_ANSWER,
      })

      // Act
      const { liveness } = await readSystemState()

      // Assert
      expect(liveness).toEqual({ type: 'silent' })
    },
  )
})

describe('expirePoints', () => {
  it('should expire the points of every customer up to the day the API takes, and tell how many and of how many customers', async () => {
    // Arrange
    const fetched = answering(() =>
      record(200, { processedCount: 3, totalPoints: 1250 }),
    )

    // Act
    const expiry = await expirePoints()

    // Assert
    expect(expiry).toEqual({
      type: 'expired',
      processedCount: 3,
      totalPoints: 1250,
    })
    expect(asked(fetched)).toEqual(['POST /points/expire'])
    expect(await sent(fetched)).toEqual([
      { customerId: null, processBefore: null },
    ])
  })

  it.each<[string, Answer, string]>([
    [
      'an account that is not an administrator',
      () => problem(403),
      'forbidden',
    ],
    ['a body the API refused', () => problem(400), 'failed'],
    ['a body too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should expire nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const expiry = await expirePoints()

    // Assert
    expect(expiry).toEqual({ type })
  })
})

describe('executeDeletionRequests', () => {
  it('should carry out the requests that are due, and hand them over in their order', async () => {
    // Arrange
    const requests = [
      aDeletionRequest(),
      aDeletionRequest({ id: '6e7f8091-a2b3-4c4d-8e5f-6a7b8c9d0e1f' }),
    ]
    const fetched = answering(() => record(200, requests))

    // Act
    const erasure = await executeDeletionRequests()

    // Assert
    expect(erasure).toEqual({ type: 'erased', requests })
    expect(asked(fetched)).toEqual([
      'POST /customers/deletion-requests/execute',
    ])
    expect(await sent(fetched)).toEqual([])
  })

  it.each<[string, Answer, string]>([
    [
      'an account that is not an administrator',
      () => problem(403),
      'forbidden',
    ],
    ...UNREAD,
  ])('should carry out nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const erasure = await executeDeletionRequests()

    // Assert
    expect(erasure).toEqual({ type })
  })
})

describe('purgeAttachments', () => {
  it('should remove the attachments that are no longer needed, and tell how many', async () => {
    // Arrange
    const fetched = answering(() => record(200, { purgedCount: 4 }))

    // Act
    const purge = await purgeAttachments()

    // Assert
    expect(purge).toEqual({ type: 'purged', purgedCount: 4 })
    expect(asked(fetched)).toEqual(['POST /attachments/purge'])
    expect(await sent(fetched)).toEqual([])
  })

  it.each<[string, Answer, string]>([
    [
      'an account that is not an administrator',
      () => problem(403),
      'forbidden',
    ],
    ...UNREAD,
  ])('should remove nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const purge = await purgeAttachments()

    // Assert
    expect(purge).toEqual({ type })
  })
})
