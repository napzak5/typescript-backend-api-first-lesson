import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerDeletionRequestResponse,
  ModelsHealthCheck,
  ModelsHealthStatus,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminOperationMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match, P } from 'ts-pattern'
import type {
  Erasure,
  Expiry,
  Liveness,
  Purge,
  Readiness,
} from '../api/operations-api'

/*
 * What an administrator reads of the state of the system, and what the
 * screen says after each of the operations that are run by hand.
 */

const { system, expiry, erasure, purge } = adminOperationMessages

/** Whether a role runs the platform: an administrator alone. */
export const runsOperations = (role: string): boolean => role === 'admin'

/** What an account that does not run the platform is told */
export const ADMINISTRATORS_ONLY: LocalizedText =
  adminOperationMessages.administratorsOnly

const DEPENDENCY_NAMES: Record<string, LocalizedText> = system.dependencies

/** What the API depends on, in words: the name the API gives it when it is not known here. */
export const dependencyNameOf = (name: string): LocalizedText =>
  DEPENDENCY_NAMES[name] ?? { en: name, ja: name }

/** Whether the process answers, in words. */
export const livenessNameOf = (liveness: Liveness): LocalizedText =>
  match(liveness)
    .returnType<LocalizedText>()
    .with({ type: 'alive' }, () => system.alive)
    .with({ type: 'silent' }, () => system.noAnswer)
    .exhaustive()

/** Whether the API takes requests, in words, with what keeps it from doing so. */
export const readinessNameOf = (readiness: Readiness): LocalizedText =>
  match(readiness)
    .returnType<LocalizedText>()
    .with({ type: 'ready' }, () => system.ready)
    .with({ type: 'notReady', reason: null }, () => system.notReady)
    .with({ type: 'notReady', reason: P.string }, ({ reason }) =>
      system.notReadyFor(dependencyNameOf(reason)),
    )
    .with({ type: 'silent' }, () => system.noAnswer)
    .exhaustive()

const HEALTH_NAMES: Record<ModelsHealthStatus['status'], LocalizedText> =
  system.health

/** The state of the whole API, in words. */
export const healthNameOf = (
  status: ModelsHealthStatus['status'],
): LocalizedText => HEALTH_NAMES[status]

const CHECK_NAMES: Record<ModelsHealthCheck['status'], LocalizedText> =
  system.checks

/** The state of one thing the API depends on, in words. */
export const checkNameOf = (
  status: ModelsHealthCheck['status'],
): LocalizedText => CHECK_NAMES[status]

/** How long the API waited for what it depends on, in words. */
export const responseTimeNameOf = (
  responseTime: number | null,
): LocalizedText =>
  responseTime === null
    ? system.notMeasured
    : system.millisecondsOf(responseTime)

/** What the part of an operation that is run by hand says, and asks before it runs. */
export type RunCopy = {
  /** The heading of the part */
  title: LocalizedText
  /** What the operation does */
  text: LocalizedText
  /** The button that asks */
  button: LocalizedText
  /** The question of the dialog */
  question: LocalizedText
  /** What cannot be undone, in the dialog */
  warning: LocalizedText
  /** The button of the dialog that runs it */
  confirm: LocalizedText
}

export const EXPIRY_COPY: RunCopy = expiry

export const ERASURE_COPY: RunCopy = erasure

export const PURGE_COPY: RunCopy = purge

/** What the screen does after one of the operations that are run by hand. */
export type RunSays<Result> =
  /** It was done: the result is shown in the part of the operation, and the notification says so */
  | { type: 'done'; result: Result }
  /** It may be done on another attempt: said in the dialog */
  | { type: 'again'; message: LocalizedText }
  /** Another attempt changes nothing: the dialog closes, and the part says why */
  | { type: 'refused'; message: LocalizedText }

const REFUSED: { type: 'refused'; message: LocalizedText } = {
  type: 'refused',
  message: ADMINISTRATORS_ONLY,
}

/** What is expired: the points whose date of expiry has ended in every time zone */
export type ExpiryResult = { processedCount: number; totalPoints: number }

/** What follows a run of the expiry of the points. */
export const afterExpiry = (outcome: Expiry): RunSays<ExpiryResult> =>
  match(outcome)
    .returnType<RunSays<ExpiryResult>>()
    .with({ type: 'expired' }, ({ processedCount, totalPoints }) => ({
      type: 'done',
      result: { processedCount, totalPoints },
    }))
    .with({ type: 'forbidden' }, () => REFUSED)
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: expiry.failed,
    }))
    .exhaustive()

/** What a run of the expiry did, in words. */
export const expiryResultOf = ({
  processedCount,
  totalPoints,
}: ExpiryResult): LocalizedText =>
  processedCount === 0 ? expiry.none : expiry.done(processedCount, totalPoints)

/** What follows a run of the deletion requests that are due. */
export const afterErasure = (
  outcome: Erasure,
): RunSays<ModelsCustomerDeletionRequestResponse[]> =>
  match(outcome)
    .returnType<RunSays<ModelsCustomerDeletionRequestResponse[]>>()
    .with({ type: 'erased' }, ({ requests }) => ({
      type: 'done',
      result: requests,
    }))
    .with({ type: 'forbidden' }, () => REFUSED)
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: erasure.failed,
    }))
    .exhaustive()

/** What a run of the deletion requests did, in words. */
export const erasureResultOf = (
  requests: readonly ModelsCustomerDeletionRequestResponse[],
): LocalizedText =>
  requests.length === 0 ? erasure.none : erasure.done(requests.length)

/** What follows a run of the removal of the attachments that are no longer needed. */
export const afterPurge = (outcome: Purge): RunSays<number> =>
  match(outcome)
    .returnType<RunSays<number>>()
    .with({ type: 'purged' }, ({ purgedCount }) => ({
      type: 'done',
      result: purgedCount,
    }))
    .with({ type: 'forbidden' }, () => REFUSED)
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'again',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'again',
      message: purge.failed,
    }))
    .exhaustive()

/** What a run of the removal of the attachments did, in words. */
export const purgeResultOf = (purgedCount: number): LocalizedText =>
  purgedCount === 0 ? purge.none : purge.done(purgedCount)

/** When an operation was run, with what it did */
export const ranAtOf = (
  moment: LocalizedText,
  result: LocalizedText,
): LocalizedText => adminOperationMessages.runs.ranAt(moment, result)
