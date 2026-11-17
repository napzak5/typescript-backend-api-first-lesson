import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import {
  parseTreatmentRecordId,
  type TreatmentRecordId,
} from '../../models/treatment-record'
import { type DomainError, DomainErrors } from '../../shared'
import { treatmentRecordRemovalReachOf } from './_shared/authorization'
import type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'

export class DeleteTreatmentRecordUseCase {
  constructor(
    private readonly dependencies: TreatmentRecordUseCaseDependencies,
  ) {}

  /**
   * Removes a record with its materials and photos. Its booking can be
   * removed once it has no record.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<TreatmentRecordId, DomainError>> {
    const reach = treatmentRecordRemovalReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const recordId = parseTreatmentRecordId(id)
    if (recordId.type === 'error') {
      return recordId
    }

    const removed = await this.dependencies.treatmentRecordRepository.delete(
      reach,
      recordId.data,
    )
    if (removed.type === 'error') {
      return removed
    }

    return match(removed.data)
      .returnType<Result<TreatmentRecordId, DomainError>>()
      .with({ type: 'removed' }, () => Result.success(recordId.data))
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('TreatmentRecord', recordId.data)),
      )
      .exhaustive()
  }
}
