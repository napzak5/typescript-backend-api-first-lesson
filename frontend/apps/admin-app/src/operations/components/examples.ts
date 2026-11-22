import type {
  ModelsCustomerDeletionRequestResponse,
  ModelsHealthStatus,
} from '@beauty-salon-frontend/api-client'
import type { SystemState } from '../api/operations-api'

/*
 * What the stories show: the probes of an API that runs, of one that
 * cannot reach its database, and of one that does not answer, seen by an
 * administrator in Tokyo.
 */

/** When the probes of the stories were asked */
export const READ_AT = '2026-11-20T03:00:00.000Z'

/** The time zone of the device the stories are looked at on */
export const TIMEZONE = 'Asia/Tokyo'

/** What the probe of the health of an API that runs reports. */
export const aHealth = (
  changes: Partial<ModelsHealthStatus> = {},
): ModelsHealthStatus => ({
  status: 'healthy',
  version: '1.0.0',
  timestamp: READ_AT,
  checks: [
    {
      name: 'database',
      status: 'up',
      responseTime: 4,
      error: null,
      details: null,
    },
  ],
  metadata: null,
  ...changes,
})

/** An API that runs, takes requests and reaches its database */
export const RUNNING: SystemState = {
  liveness: { type: 'alive' },
  readiness: { type: 'ready' },
  health: { type: 'reported', health: aHealth() },
}

/** An API that runs and cannot reach its database */
export const WITHOUT_DATABASE: SystemState = {
  liveness: { type: 'alive' },
  readiness: { type: 'notReady', reason: 'database' },
  health: {
    type: 'reported',
    health: aHealth({
      status: 'unhealthy',
      checks: [
        {
          name: 'database',
          status: 'down',
          responseTime: 3002,
          error: 'Database is unreachable',
          details: null,
        },
      ],
    }),
  },
}

/** An API that does not answer, or that this device does not reach */
export const SILENT: SystemState = {
  liveness: { type: 'silent' },
  readiness: { type: 'silent' },
  health: { type: 'silent' },
}

/** A deletion request that a run carried out, fourteen days after it was received. */
export const aDeletionRequest = (
  changes: Partial<ModelsCustomerDeletionRequestResponse> = {},
): ModelsCustomerDeletionRequestResponse => ({
  id: '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e',
  customerId: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
  reason: '本人から、来店の記録も含めて消してほしいと電話で依頼があった',
  status: 'completed',
  requestedBy: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  requestedAt: '2026-11-05T01:30:00.000Z',
  scheduledAt: '2026-11-19T01:30:00.000Z',
  cancelledBy: null,
  cancelledAt: null,
  completedBy: '3d4e5f6a-7b8c-4d9e-8f1a-2b3c4d5e6f7a',
  completedAt: READ_AT,
  ...changes,
})
