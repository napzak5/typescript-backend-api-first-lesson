import type { ShareLinkUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { neverStored } from '../../shared/never-stored'
import { createShareLinkHandler } from './create-share-link.handler'
import { deleteShareLinkHandler } from './delete-share-link.handler'
import { getShareLinkHandler } from './get-share-link.handler'
import { listShareLinksHandler } from './list-share-links.handler'

/**
 * Share link routes, relative to where the router is mounted
 * (`/attachments`, before the routes of the attachments: `share-links` is
 * no ID of an attachment). One handler per operation of `ShareLinkCrud`
 * in the TypeSpec definition; every one of them needs a signed-in user:
 *
 * - POST   /:attachmentId/share-links    create
 * - GET    /:attachmentId/share-links    list
 * - GET    /share-links/:shareLinkId     get
 * - DELETE /share-links/:shareLinkId     delete
 *
 * The answer of `create` carries the token of the link and is kept by no
 * cache. That is said on the route and not for the router, which the
 * requests of the attachments pass through as well.
 */
export const createShareLinkRouter = (
  dependencies: ShareLinkUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get(
    '/share-links/:shareLinkId',
    getShareLinkHandler(dependencies, authenticated),
  )
  router.delete(
    '/share-links/:shareLinkId',
    deleteShareLinkHandler(dependencies, authenticated),
  )
  router.post(
    '/:attachmentId/share-links',
    neverStored,
    createShareLinkHandler(dependencies, authenticated),
  )
  router.get(
    '/:attachmentId/share-links',
    listShareLinksHandler(dependencies, authenticated),
  )

  return router
}
