import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Logger } from '@beauty-salon-backend/infrastructure'
import type { RequestHandler } from 'express'
import { pinoHttp } from 'pino-http'
import { match, P } from 'ts-pattern'
import { SYSTEM_BASE_PATH } from '../shared/api-version'
import { signedInUserOf } from '../shared/signed-in-user'

const REQUEST_ID_HEADER = 'X-Request-Id'

/** What pino's standard serializers hand over, as far as it is logged. */
type SerializedRequest = {
  id: unknown
  method: string
  url: string
  remoteAddress: string
}

type SerializedResponse = { statusCode: number }

/** What pino-http is about to log for a request that failed. */
type FailedRequestLine = { res: ServerResponse; responseTime: number }

/** An ID from the caller is kept only if it is safe to write into a log. */
const ACCEPTED_REQUEST_ID = /^[\w.:-]{1,128}$/

/**
 * Identifies the request: the caller's `X-Request-Id` when it sent a usable
 * one, so that a request can be followed across systems, or a new UUID. The
 * ID is returned in the response header of the same name.
 */
const assignRequestId = (req: IncomingMessage, res: ServerResponse): string => {
  const id = match(req.headers['x-request-id'])
    .with(P.string.regex(ACCEPTED_REQUEST_ID), (received) => received)
    .otherwise(() => randomUUID())

  res.setHeader(REQUEST_ID_HEADER, id)
  return id
}

/**
 * Logs one line per completed request and gives each request `req.id` and
 * `req.log`, a logger whose lines carry that ID. The line of a request that
 * was authenticated names the user (`userId`), which is what tells afterwards
 * who did something. No token is logged.
 *
 * Headers and bodies are not logged: they hold credentials and the personal
 * data of customers. Probes are not logged either; they arrive every few
 * seconds and say nothing when they succeed.
 */
export const requestLogging = (logger: Logger): RequestHandler =>
  pinoHttp({
    logger,
    genReqId: assignRequestId,
    autoLogging: {
      ignore: (req) => req.url?.startsWith(SYSTEM_BASE_PATH) ?? false,
    },
    customLogLevel: (_req, res, error) =>
      match({ failed: error !== undefined, status: res.statusCode })
        .returnType<'error' | 'warn' | 'info'>()
        .with({ failed: true }, () => 'error')
        .with({ status: P.number.gte(500) }, () => 'error')
        .with({ status: P.number.gte(400) }, () => 'warn')
        .otherwise(() => 'info'),
    // The failure itself is logged where it is handled, with its cause; the
    // line for the request repeats neither that nor a stand-in error.
    customErrorObject: (_req, _res, _error, line: FailedRequestLine) => ({
      res: line.res,
      responseTime: line.responseTime,
    }),
    // Asked again when the request completes, by when it is known who made it.
    customProps: (req) => {
      const userId = signedInUserOf(req)
      return userId === undefined ? {} : { userId }
    },
    serializers: {
      req: ({ id, method, url, remoteAddress }: SerializedRequest) => ({
        id,
        method,
        url,
        remoteAddress,
      }),
      res: ({ statusCode }: SerializedResponse) => ({ statusCode }),
    },
  })
