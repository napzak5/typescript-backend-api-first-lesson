import {
  IssueSharedFileDownloadUrlUseCase,
  type ShareLinkUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import type { RequestHandler } from 'express'
import { match } from 'ts-pattern'
import type { ProblemDetails } from '../../shared/problem-details'
import { responseMeta, sendProblem } from '../../shared/responses'
import type { IssueSharedFileDownloadUrlResponse } from './_shared'

/**
 * POST /api/v1/share/download-url - issue a URL that downloads the file of
 * a share link for a short while, to whoever presents the token of the
 * link and its password if it has one
 */
export const issueSharedFileDownloadUrlHandler = (
  dependencies: ShareLinkUseCaseDependencies,
): RequestHandler<
  Record<string, never>,
  IssueSharedFileDownloadUrlResponse | ProblemDetails,
  unknown
> => {
  const useCase = new IssueSharedFileDownloadUrlUseCase(dependencies)

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
