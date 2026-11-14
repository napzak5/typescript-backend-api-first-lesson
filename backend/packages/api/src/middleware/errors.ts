import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { match, P } from 'ts-pattern'
import type { HttpError, ProblemDetails } from '../shared/problem-details'
import { sendProblem } from '../shared/responses'

/**
 * Tells apart what Express and its body parser raise. They mark a client's
 * mistake with a 4xx `status` and, for the body, a `type`; anything without
 * such a mark is a defect of the server.
 */
export const toHttpError = (error: unknown): HttpError =>
  match(error)
    .returnType<HttpError>()
    .with({ type: 'entity.parse.failed' }, () => ({ type: 'malformedBody' }))
    .with({ type: 'entity.too.large' }, () => ({ type: 'bodyTooLarge' }))
    .with(
      { type: P.union('encoding.unsupported', 'charset.unsupported') },
      () => ({ type: 'unsupportedMediaType' }),
    )
    .with({ status: P.number.between(400, 499) }, () => ({
      type: 'badRequest',
    }))
    .otherwise(() => ({ type: 'unexpected' }))

/**
 * Rejects a body that is not JSON. Without this the body parser skips it and
 * the request fails later as if the body were missing.
 */
export const requireJsonBody: RequestHandler<
  Record<string, string>,
  ProblemDetails
> = (req, res, next) => {
  if (
    req.headers['content-type'] !== undefined &&
    req.is('application/json') === false
  ) {
    sendProblem(req, res, { type: 'unsupportedMediaType' })
    return
  }
  next()
}

/** Answers every request that no route took. */
export const notFoundHandler: RequestHandler<
  Record<string, string>,
  ProblemDetails
> = (req, res) => {
  sendProblem(req, res, {
    type: 'routeNotFound',
    method: req.method,
    path: req.path,
  })
}

/**
 * The last middleware: turns whatever was thrown or rejected on the way
 * into problem details. A defect is logged with its stack; a client's
 * mistake is not, the request line with its status says enough.
 */
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response<ProblemDetails>,
  next: NextFunction,
): void => {
  const httpError = toHttpError(error)

  if (httpError.type === 'unexpected') {
    req.log.error({ err: error }, 'Unhandled error')
  }

  // Too late to change the response; Express closes the connection.
  if (res.headersSent) {
    next(error)
    return
  }

  sendProblem(req, res, httpError)
}
