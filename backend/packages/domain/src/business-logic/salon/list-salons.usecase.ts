import type { Result } from '@beauty-salon-backend/utility'
import { SalonReadMapper } from '../../mappers/read/salon.mapper'
import { SalonWriteMapper } from '../../mappers/write/salon.mapper'
import type { ApiPage } from '../../models/page'
import type { ApiSalonResponse } from '../../models/salon'
import { salonSearchRequestSchema } from '../../schemas/salon.schema'
import { type DomainError, parseWith } from '../../shared'
import type { SalonUseCaseDependencies } from './_shared/dependencies'

export class ListSalonsUseCase {
  constructor(private readonly dependencies: SalonUseCaseDependencies) {}

  /**
   * Lists salons newest first. The cursor of a page is the ID of its last
   * salon, so a page stays stable while salons are added or removed.
   */
  async execute(
    input: unknown,
  ): Promise<Result<ApiPage<ApiSalonResponse>, DomainError>> {
    const request = parseWith(
      salonSearchRequestSchema,
      input,
      'Invalid salon search',
    )
    if (request.type === 'error') {
      return request
    }

    const criteria = SalonWriteMapper.fromSearchRequest(request.data)
    const listed = await this.dependencies.salonRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }

    return SalonReadMapper.toApiSalonPage(listed.data, criteria)
  }
}
