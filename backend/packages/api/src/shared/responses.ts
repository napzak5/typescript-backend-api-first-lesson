import type { components } from '@beauty-salon-backend/generated'
import type { Request, Response } from 'express'
import { API_VERSION } from './api-version'
import { languageAsked } from './language'
import {
  type ApiError,
  type ProblemDetails,
  toBearerChallenge,
  toProblemDetails,
} from './problem-details'

type ResponseMeta = components['schemas']['Models.ResponseMeta']

/** The languages the contract says a problem is told in. */
type ContentLanguage = components['schemas']['Models.LanguageType']

/**
 * What a response takes from its request. Naming only these properties lets
 * a handler pass its request whatever its path parameters and body are.
 */
type AnsweredRequest = Pick<Request, 'headers' | 'id' | 'log' | 'originalUrl'>

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
 * its challenge. A database error and an error of the object storage are
 * logged here, because their cause never reaches the response.
 *
 * The problem is told in the language the request asks for
 * (`Accept-Language`): every text of an error is written in every language.
 * `Content-Language` names the language, and `Vary` says that the answer
 * depends on what the request asked for.
 */
export const sendProblem = (
  req: AnsweredRequest,
  res: Response<ProblemDetails>,
  error: ApiError,
): void => {
  if (error.type === 'database' || error.type === 'storage') {
    req.log.error({ cause: error.cause }, error.message)
  }

  // A language of the product that the contract does not name does not compile
  const language: ContentLanguage = languageAsked(req)
  const problem = toProblemDetails(
    error,
    {
      instance: req.originalUrl,
      correlationId: correlationIdOf(req),
      timestamp: new Date().toISOString(),
    },
    language,
  )
  const challenge = toBearerChallenge(error)
  if (challenge !== null) {
    res.set('WWW-Authenticate', challenge)
  }

  res
    .status(problem.status)
    .vary('Accept-Language')
    .set('Content-Language', language)
    .type(PROBLEM_MEDIA_TYPE)
    .json(problem)
}
