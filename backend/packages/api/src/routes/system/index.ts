import { type DomainError, DomainErrors } from '@beauty-salon-backend/domain'
import type { operations } from '@beauty-salon-backend/generated'
import {
  type Database,
  type Logger,
  pingDatabase,
} from '@beauty-salon-backend/infrastructure'
import { Result } from '@beauty-salon-backend/utility'
import { type RequestHandler, Router } from 'express'
import { match } from 'ts-pattern'
import { API_VERSION } from '../../shared/api-version'

type JsonBody<Content> = Content extends { 'application/json': infer Body }
  ? Body
  : never

type AliveResponse = JsonBody<
  operations['SystemOperations_alive']['responses'][200]['content']
>
type ReadyResponse = JsonBody<
  operations['SystemOperations_ready']['responses'][200]['content']
>
type HealthResponse = JsonBody<
  operations['SystemOperations_health']['responses'][200]['content']
>

export type SystemDependencies = {
  database: Database
}

/** A probe waits this long for the database before it reports it as down. */
const PROBE_TIMEOUT_MS = 3000

type Probe = { reachable: boolean; responseTime: number }

/**
 * Asks the database for an answer. A failure is logged with its cause; the
 * response only says that the database is down.
 */
const probeDatabase = async (
  database: Database,
  log: Logger,
): Promise<Probe> => {
  const startedAt = performance.now()

  const result = await new Promise<Result<null, DomainError>>((resolve) => {
    const timer = setTimeout(() => {
      resolve(
        Result.error(
          DomainErrors.database('Database did not answer in time', {
            timeoutMs: PROBE_TIMEOUT_MS,
          }),
        ),
      )
    }, PROBE_TIMEOUT_MS)

    void pingDatabase(database).then((answer) => {
      clearTimeout(timer)
      resolve(answer)
    })
  })

  const responseTime = Math.round(performance.now() - startedAt)

  return match(result)
    .with({ type: 'success' }, () => ({ reachable: true, responseTime }))
    .with({ type: 'error' }, ({ error }) => {
      log.error({ error }, 'Database probe failed')
      return { reachable: false, responseTime }
    })
    .exhaustive()
}

/** GET /api/system/alive - the process runs and answers */
const aliveHandler: RequestHandler<Record<string, never>, AliveResponse> = (
  _req,
  res,
) => {
  res.set('Cache-Control', 'no-store').json({ alive: true })
}

/** GET /api/system/ready - the server can do its work, so send it traffic */
const readyHandler =
  ({
    database,
  }: SystemDependencies): RequestHandler<
    Record<string, never>,
    ReadyResponse
  > =>
  async (req, res) => {
    const { reachable } = await probeDatabase(database, req.log)

    res
      .status(reachable ? 200 : 503)
      .set('Cache-Control', 'no-store')
      .json(
        reachable
          ? { ready: true, reason: null }
          : { ready: false, reason: 'database' },
      )
  }

/** GET /api/system/health - the state of the server and what it depends on */
const healthHandler =
  ({
    database,
  }: SystemDependencies): RequestHandler<
    Record<string, never>,
    HealthResponse
  > =>
  async (req, res) => {
    const { reachable, responseTime } = await probeDatabase(database, req.log)

    res
      .status(reachable ? 200 : 503)
      .set('Cache-Control', 'no-store')
      .json({
        status: reachable ? 'healthy' : 'unhealthy',
        version: API_VERSION,
        timestamp: new Date().toISOString(),
        checks: [
          {
            name: 'database',
            status: reachable ? 'up' : 'down',
            responseTime,
            error: reachable ? null : 'Database is unreachable',
            details: null,
          },
        ],
        metadata: null,
      })
  }

/**
 * Operational routes, relative to where the router is mounted. One handler
 * per implemented operation of `SystemOperations` in the TypeSpec definition:
 *
 * - GET /alive   liveness: restart the process when this stops answering
 * - GET /ready   readiness: route traffic only while this answers 200
 * - GET /health  the same check with details, for dashboards
 */
export const createSystemRouter = (
  dependencies: SystemDependencies,
): Router => {
  const router = Router()

  router.get('/alive', aliveHandler)
  router.get('/ready', readyHandler(dependencies))
  router.get('/health', healthHandler(dependencies))

  return router
}
