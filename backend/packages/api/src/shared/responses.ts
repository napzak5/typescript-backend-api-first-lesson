import type { components } from '@beauty-salon-backend/generated'
import type { Request, Response } from 'express'
import { API_VERSION } from './api-version'
import {
  type ApiError,
  type ProblemDetails,
  toProblemDetails,
} from './problem-details'

type ResponseMeta = components['schemas']['Models.ResponseMeta']

/**
 * The ID of the request, which is also on its log lines and in the
 * `X-Request-Id` response header. The request logging middleware assigns it.
 */
const correlationIdOf = (req: Request): string => String(req.id)

/** Metadata of a successful response. */
export const responseMeta = (req: Request): ResponseMeta => ({
  correlationId: correlationIdOf(req),
  timestamp: new Date().toISOString(),
  version: API_VERSION,
})

/** The media type of problem details (RFC 9457). */
const PROBLEM_MEDIA_TYPE = 'application/problem+json'

/**
 * Sends an error as problem details with the matching status. A database
 * error is logged here, because its cause never reaches the response.
 */
export const sendProblem = (
  req: Request,
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
  res.status(problem.status).type(PROBLEM_MEDIA_TYPE).json(problem)
}
