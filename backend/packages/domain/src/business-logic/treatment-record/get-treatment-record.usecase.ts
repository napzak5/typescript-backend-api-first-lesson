import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { TreatmentRecordReadMapper } from '../../mappers/read/treatment-record.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiTreatmentRecordResponse,
  parseTreatmentRecordId,
} from '../../models/treatment-record'
import { type DomainError, DomainErrors } from '../../shared'
import { treatmentRecordReachOf } from './_shared/authorization'
import type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'

export class GetTreatmentRecordUseCase {
  constructor(
    private readonly dependencies: TreatmentRecordUseCaseDependencies,
  ) {}

  /**
   * Finds a record the actor reaches, with its materials and photos. A
   * record of another salon is, to a member of a salon, one that does not
   * exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiTreatmentRecordResponse, DomainError>> {
    const reach = treatmentRecordReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const recordId = parseTreatmentRecordId(id)
    if (recordId.type === 'error') {
      return recordId
    }

    const found = await this.dependencies.treatmentRecordRepository.findById(
      reach,
      recordId.data,
    )
    if (found.type === 'error') {
      return found
    }

    return found.data === null
      ? Result.error(
          DomainErrors.notFound(entityMessages.treatmentRecord, recordId.data),
        )
      : TreatmentRecordReadMapper.toApiTreatmentRecord(found.data)
  }
}
