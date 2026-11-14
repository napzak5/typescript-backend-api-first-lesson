import {
  type Actor,
  AuthenticateUseCase,
  type AuthUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { Request, RequestHandler, Response } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from './problem-details'
import { sendProblem } from './responses'
import { noteSignedInUser } from './signed-in-user'

/** A handler that runs only for a signed-in user and is told who that is. */
type AuthenticatedHandler<Params, ResBody, ReqBody = unknown> = (
  actor: Actor,
  req: Request<Params, ResBody | ProblemDetails, ReqBody>,
  res: Response<ResBody | ProblemDetails>,
) => Promise<void>

/**
 * Wraps a handler so that it needs a valid access token. Without one the
 * request is answered with 401 and the handler does not run, so a handler
 * cannot be reached unauthenticated by forgetting a middleware: it has no
 * actor to work with unless it is wrapped.
 *
 * Authentication only says who is asking. Whether that actor may do what is
 * asked is decided by the use case.
 */
export type Authenticated = <Params, ResBody, ReqBody = unknown>(
  handler: AuthenticatedHandler<Params, ResBody, ReqBody>,
) => RequestHandler<Params, ResBody | ProblemDetails, ReqBody>

export const createAuthenticated = (
  dependencies: AuthUseCaseDependencies,
): Authenticated => {
  const useCase = new AuthenticateUseCase(dependencies)

  return (handler) => async (req, res) => {
    const authenticated = await useCase.execute(req.headers.authorization)

    await match(authenticated)
      .with({ type: 'success' }, ({ data: actor }) => {
        noteSignedInUser(req, actor.userId)
        return handler(actor, req, res)
      })
      .with({ type: 'error' }, async ({ error }) =>
        sendProblem(req, res, error),
      )
      .exhaustive()
  }
}
