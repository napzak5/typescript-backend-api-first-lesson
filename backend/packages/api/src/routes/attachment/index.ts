import type { AttachmentUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { completeAttachmentHandler } from './complete-attachment.handler'
import { deleteAttachmentHandler } from './delete-attachment.handler'
import { getAttachmentHandler } from './get-attachment.handler'
import { issueAttachmentDownloadUrlHandler } from './issue-attachment-download-url.handler'
import { issueAttachmentUploadUrlHandler } from './issue-attachment-upload-url.handler'
import { listAttachmentsHandler } from './list-attachments.handler'
import { purgeAttachmentsHandler } from './purge-attachments.handler'

/**
 * Attachment routes, relative to where the router is mounted
 * (`/attachments`). One handler per operation of `AttachmentCrud` in the
 * TypeSpec definition; every one of them needs a signed-in user:
 *
 * - POST   /upload-url                   getUploadUrl
 * - POST   /purge                        purge
 * - POST   /:attachmentId/complete       complete
 * - GET    /                             list
 * - GET    /:attachmentId                get
 * - GET    /:attachmentId/download-url   getDownloadUrl
 * - DELETE /:attachmentId                delete
 *
 * The share links of the contract (`ShareLinkCrud`) are not served yet.
 */
export const createAttachmentRouter = (
  dependencies: AttachmentUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.post(
    '/upload-url',
    issueAttachmentUploadUrlHandler(dependencies, authenticated),
  )
  router.post('/purge', purgeAttachmentsHandler(dependencies, authenticated))
  router.post(
    '/:attachmentId/complete',
    completeAttachmentHandler(dependencies, authenticated),
  )
  router.get('/', listAttachmentsHandler(dependencies, authenticated))
  router.get(
    '/:attachmentId',
    getAttachmentHandler(dependencies, authenticated),
  )
  router.get(
    '/:attachmentId/download-url',
    issueAttachmentDownloadUrlHandler(dependencies, authenticated),
  )
  router.delete(
    '/:attachmentId',
    deleteAttachmentHandler(dependencies, authenticated),
  )

  return router
}
