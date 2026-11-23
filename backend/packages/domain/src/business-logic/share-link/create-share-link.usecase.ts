import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  shareLinkMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { ShareLinkReadMapper } from '../../mappers/read/share-link.mapper'
import { ShareLinkWriteMapper } from '../../mappers/write/share-link.mapper'
import { parseAttachmentId } from '../../models/attachment'
import type { Actor } from '../../models/auth'
import type { ApiShareLinkCreateResponse } from '../../models/share-link'
import { shareLinkCreateRequestSchema } from '../../schemas/share-link.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { commonChoiceIssue } from '../auth/_shared/password-blocklist'
import { shareLinkReachOf } from './_shared/authorization'
import type { ShareLinkUseCaseDependencies } from './_shared/dependencies'
import { shareEndIssue } from './_shared/link-rules'

const MESSAGE = shareLinkMessages.invalidShareLink

export class CreateShareLinkUseCase {
  constructor(private readonly dependencies: ShareLinkUseCaseDependencies) {}

  /**
   * Creates a link to an uploaded attachment and answers its token, this
   * once: only the hash of the token is stored, and only the hash of the
   * password. The link ends after the moment it is created at and within
   * 30 days of it; a password that is too easy to guess is refused.
   *
   * Whether the actor manages share links is decided before the request
   * is looked at, and the request before the attachment.
   */
  async execute(
    actor: Actor,
    attachmentId: unknown,
    input: unknown,
  ): Promise<Result<ApiShareLinkCreateResponse, DomainError>> {
    const reach = shareLinkReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const id = parseAttachmentId(attachmentId)
    if (id.type === 'error') {
      return id
    }
    const request = parseWith(shareLinkCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { expiresAt, maxDownloads, password } =
      ShareLinkWriteMapper.fromCreateRequest(request.data)

    const {
      shareLinkRepository,
      attachmentRepository,
      passwordHasher,
      tokenIssuer,
      clock,
    } = this.dependencies
    const now = clock()
    const issues = [
      shareEndIssue(expiresAt, now),
      password === null ? null : commonChoiceIssue('password', password),
    ].flatMap((issue) => (issue === null ? [] : [issue]))
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const found = await attachmentRepository.findById(reach, id.data)
    if (found.type === 'error') {
      return found
    }
    const attachment = found.data
    if (attachment === null) {
      return Result.error(
        DomainErrors.notFound(entityMessages.attachment, id.data),
      )
    }
    if (attachment.status !== 'uploaded') {
      return Result.error(
        DomainErrors.conflict('The attachment has not been uploaded'),
      )
    }

    const passwordHash =
      password === null
        ? Result.success(null)
        : await passwordHasher.hash(password)
    if (passwordHash.type === 'error') {
      return passwordHash
    }
    const { token, hash } = tokenIssuer.issue()
    const created = await shareLinkRepository.create({
      attachmentId: attachment.id,
      tokenHash: hash,
      passwordHash: passwordHash.data,
      expiresAt,
      maxDownloads,
      createdBy: actor.userId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    if (created.type === 'error') {
      return created
    }

    return ShareLinkReadMapper.toApiShareLinkCreate(created.data, token)
  }
}
