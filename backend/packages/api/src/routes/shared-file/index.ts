import type { ShareLinkUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import { neverStored } from '../../shared/never-stored'
import { getSharedFileHandler } from './get-shared-file.handler'
import { issueSharedFileDownloadUrlHandler } from './issue-shared-file-download-url.handler'

/**
 * Shared file routes, relative to where the router is mounted (`/share`).
 * One handler per operation of `SharedFileCrud` in the TypeSpec
 * definition. Nobody is signed in: the token of a share link, and its
 * password if it has one, come in the body, so that neither is in a URL:
 *
 * - POST /file            get
 * - POST /download-url    getDownloadUrl
 *
 * Every answer is for the holder of a token and is kept by no cache.
 */
export const createSharedFileRouter = (
  dependencies: ShareLinkUseCaseDependencies,
): Router => {
  const router = Router()

  router.use(neverStored)

  router.post('/file', getSharedFileHandler(dependencies))
  router.post('/download-url', issueSharedFileDownloadUrlHandler(dependencies))

  return router
}
