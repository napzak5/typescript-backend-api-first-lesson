import { Result } from '@beauty-salon-backend/utility'
import { ShareLinkReadMapper } from '../../mappers/read/share-link.mapper'
import type { ApiSharedFileResponse } from '../../models/share-link'
import { sharedFileGetRequestSchema } from '../../schemas/share-link.schema'
import { type DomainError, parseWith } from '../../shared'
import type { ShareLinkUseCaseDependencies } from './_shared/dependencies'
import { openSharedFile } from './_shared/open-shared-file'

export class GetSharedFileUseCase {
  constructor(private readonly dependencies: ShareLinkUseCaseDependencies) {}

  /**
   * Tells a viewer what the file of a link is: its name, kind and size.
   * Nobody is signed in: the token of the link, and its password when it
   * has one, are what the request is answered for. Looking counts as no
   * download.
   */
  async execute(
    input: unknown,
  ): Promise<Result<ApiSharedFileResponse, DomainError>> {
    const request = parseWith(
      sharedFileGetRequestSchema,
      input,
      'Invalid shared file request',
    )
    if (request.type === 'error') {
      return request
    }

    const opened = await openSharedFile(
      this.dependencies,
      request.data,
      this.dependencies.clock(),
    )

    return Result.map(opened, ({ attachment }) =>
      ShareLinkReadMapper.toApiSharedFile(attachment),
    )
  }
}
