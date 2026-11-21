import {
  attachmentCrudPurge,
  customerCrudExecuteDeletionRequests,
  type ModelsCustomerDeletionRequestResponse,
  type ModelsHealthStatus,
  pointCrudExpire,
  systemOperationsAlive,
  systemOperationsHealth,
  systemOperationsReady,
} from '@beauty-salon-frontend/api-client'
import {
  FAILED,
  type Forbidden,
  outsideTheContract,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'

/*
 * What an administrator runs the platform with: the probes of the API,
 * which tell whether it runs, takes requests, and reaches what it depends
 * on, and the three operations that are meant to run at intervals, run
 * here by hand. Each of the three handles everything that is due, and
 * never the same thing twice.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** No answer from a probe, or one that no probe gives: a gateway that answers for the API */
type Silent = { type: 'silent' }

const SILENT: Silent = { type: 'silent' }

const silent = (): Silent => SILENT

/** Whether the process of the API answers */
export type Liveness = { type: 'alive' } | Silent

/** Whether the API takes requests, and what keeps it from doing so */
export type Readiness =
  | { type: 'ready' }
  /** `reason` names what the API cannot reach: `database` */
  | { type: 'notReady'; reason: string | null }
  | Silent

/** The state of the API and of each thing it depends on */
type Health = { type: 'reported'; health: ModelsHealthStatus } | Silent

/** What the three probes said at once */
export type SystemState = {
  liveness: Liveness
  readiness: Readiness
  health: Health
}

/** The key the state of the system is read under. */
export const SYSTEM_STATE_KEY = ['system-state']

const livenessOf = async (): Promise<Liveness> => {
  const answer = await systemOperationsAlive().catch(() => null)

  return match(answer)
    .returnType<Liveness>()
    .with({ status: 200 }, () => ({ type: 'alive' }))
    .with(null, silent)
    .exhaustive(silent)
}

const readinessOf = async (): Promise<Readiness> => {
  const answer = await systemOperationsReady().catch(() => null)

  return match(answer)
    .returnType<Readiness>()
    .with({ status: P.union(200, 503) }, ({ data }) =>
      data.ready
        ? { type: 'ready' }
        : { type: 'notReady', reason: data.reason },
    )
    .with(null, silent)
    .exhaustive(silent)
}

const healthOf = async (): Promise<Health> => {
  const answer = await systemOperationsHealth().catch(() => null)

  // A 503 reports a state too: the API runs, and something it depends on does not
  return match(answer)
    .returnType<Health>()
    .with({ status: P.union(200, 503) }, ({ data }) => ({
      type: 'reported',
      health: data,
    }))
    .with(null, silent)
    .exhaustive(silent)
}

/**
 * Asks the three probes at once. A probe that does not answer says so, and
 * the others are shown all the same: that the process answers while the
 * API takes no requests is what tells where it stops.
 */
export const readSystemState = async (): Promise<SystemState> => {
  const [liveness, readiness, health] = await Promise.all([
    livenessOf(),
    readinessOf(),
    healthOf(),
  ])

  return { liveness, readiness, health }
}

/** What came of the expiry of the points of every customer. */
export type Expiry =
  /** `processedCount` customers lost `totalPoints` in all */
  | { type: 'expired'; processedCount: number; totalPoints: number }
  | Forbidden
  | Unread

/**
 * Expires the points whose last day has ended in every time zone, of every
 * customer: both keys are left to the API, which takes yesterday (UTC).
 */
export const expirePoints = async (): Promise<Expiry> => {
  const answer = await pointCrudExpire({
    customerId: null,
    processBefore: null,
  }).catch(() => null)

  return (
    match(answer)
      .returnType<Expiry>()
      .with({ status: 200 }, ({ data }) => ({
        type: 'expired',
        processedCount: data.data.processedCount,
        totalPoints: data.data.totalPoints,
      }))
      .with({ status: 403 }, () => FORBIDDEN)
      // The screen sends both keys as null: a body the API refuses or does not read is no answer
      .with({ status: P.union(400, 413, 415) }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/** What came of the execution of the deletion requests that are due. */
export type Erasure =
  /** The requests that were carried out, in the order of their dates; none when none was due */
  | { type: 'erased'; requests: ModelsCustomerDeletionRequestResponse[] }
  | Forbidden
  | Unread

/** Carries out every request to delete the data of a customer whose date has come. */
export const executeDeletionRequests = async (): Promise<Erasure> => {
  const answer = await customerCrudExecuteDeletionRequests().catch(() => null)

  return match(answer)
    .returnType<Erasure>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'erased',
      requests: data.data,
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** What came of the removal of the attachments that are no longer needed. */
export type Purge = { type: 'purged'; purgedCount: number } | Forbidden | Unread

/**
 * Removes the uploads that were never finished and the attachments that
 * were deleted, with their files in the storage, once their address for
 * the upload has run out.
 */
export const purgeAttachments = async (): Promise<Purge> => {
  const answer = await attachmentCrudPurge().catch(() => null)

  return match(answer)
    .returnType<Purge>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'purged',
      purgedCount: data.data.purgedCount,
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
