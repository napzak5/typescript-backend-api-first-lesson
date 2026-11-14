import type { DomainError } from '@beauty-salon-backend/domain'
import type { components } from '@beauty-salon-backend/generated'
import { createId } from '@beauty-salon-backend/utility'
import type { Request, Response } from 'express'
import { API_VERSION } from './api-version'
import { type ProblemDetails, toProblemDetails } from './problem-details'

type ResponseMeta = components['schemas']['Models.ResponseMeta']

/** Metadata of a successful response. */
export const responseMeta = (): ResponseMeta => ({
  correlationId: createId(),
  timestamp: new Date().toISOString(),
  version: API_VERSION,
})

/** Sends a domain error as problem details with the matching status. */
export const sendProblem = (
  req: Request,
  res: Response<ProblemDetails>,
  error: DomainError,
): void => {
  const problem = toProblemDetails(error, {
    instance: req.originalUrl,
    correlationId: createId(),
    timestamp: new Date().toISOString(),
  })
  res.status(problem.status).json(problem)
}
