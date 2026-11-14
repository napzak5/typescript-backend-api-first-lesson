import type { components } from '@beauty-salon-backend/generated'
import type { Request, Response } from 'express'
import { API_VERSION } from './api-version'
import {
  type ApiError,
  type ProblemDetails,
  toBearerChallenge,
  toProblemDetails,
} from './problem-details'

type ResponseMeta = components['schemas']['Models.ResponseMeta']

/**
 * What a response takes from its request. Naming only these properties lets
 * a handler pass its request whatever its path parameters and body are.
 */
type AnsweredRequest = Pick<Request, 'id' | 'log' | 'originalUrl'>

/**
 * The ID of the request, which is also on its log lines and in the
 * `X-Request-Id` response header. The request logging middleware assigns it.
 */
const correlationIdOf = (req: Pick<Request, 'id'>): string => String(req.id)

/** Metadata of a successful response. */
export const responseMeta = (req: Pick<Request, 'id'>): ResponseMeta => ({
  correlationId: correlationIdOf(req),
  timestamp: new Date().toISOString(),
  version: API_VERSION,
})

/** The media type of problem details (RFC 9457). */
const PROBLEM_MEDIA_TYPE = 'application/problem+json'

/**
 * Sends an error as problem details with the matching status, and a 401 with
 * its challenge. A database error is logged here, because its cause never
 * reaches the response.
 */
export const sendProblem = (
  req: AnsweredRequest,
  res: Response<ProblemDetails>,
  error: ApiError,
): void => {
  if (error.type === 'database') {
    req.log.error({ cause: error.cause }, error.message)
  }

  const problem = toProblemDetails(error, {
    instance: req.originalUrl,
    correlationId: correlationIdOf(req),
    timestamp: new Date().toISOString(),
  })
  const challenge = toBearerChallenge(error)
  if (challenge !== null) {
    res.set('WWW-Authenticate', challenge)
  }

  res.status(problem.status).type(PROBLEM_MEDIA_TYPE).json(problem)
}
