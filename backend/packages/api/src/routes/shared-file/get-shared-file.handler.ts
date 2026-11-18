import {
  GetSharedFileUseCase,
  type ShareLinkUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { GetSharedFileResponse } from './_shared'

/**
 * POST /api/v1/share/file - tell what the file of a share link is, to
 * whoever presents the token of the link and its password if it has one
 */
export const getSharedFileHandler = (
  dependencies: ShareLinkUseCaseDependencies,
): RequestHandler<
  Record<string, never>,
  GetSharedFileResponse | ProblemDetails,
  unknown
> => {
  const useCase = new GetSharedFileUseCase(dependencies)

  return async (req, res) => {
    const result = await useCase.execute(req.body)

    match(result)
      .with({ type: 'success' }, ({ data }) => {
        res.json({ data, meta: responseMeta(req), links: null })
      })
      .with({ type: 'error' }, ({ error }) => sendProblem(req, res, error))
      .exhaustive()
  }
}
