import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import {
  parseTreatmentPhotoIds,
  type TreatmentPhotoId,
} from '../../models/treatment-record'
import { type DomainError, DomainErrors } from '../../shared'
import { treatmentRecordReachOf } from './_shared/authorization'
import type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'

export class RemoveTreatmentPhotoUseCase {
  constructor(
    private readonly dependencies: TreatmentRecordUseCaseDependencies,
  ) {}

  /**
   * Removes a photo of a record, by those who write the record: a photo
   * added by mistake goes without the record.
   */
  async execute(
    actor: Actor,
    id: unknown,
    photoId: unknown,
  ): Promise<Result<TreatmentPhotoId, DomainError>> {
    const reach = treatmentRecordReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const ids = parseTreatmentPhotoIds(id, photoId)
    if (ids.type === 'error') {
      return ids
    }

    const removed =
      await this.dependencies.treatmentRecordRepository.removePhoto(
        reach,
        ids.data.id,
        ids.data.photoId,
      )
    if (removed.type === 'error') {
      return removed
    }

    return match(removed.data)
      .returnType<Result<TreatmentPhotoId, DomainError>>()
      .with({ type: 'removed' }, () => Result.success(ids.data.photoId))
      .with({ type: 'recordNotFound' }, () =>
        Result.error(DomainErrors.notFound('TreatmentRecord', ids.data.id)),
      )
      .with({ type: 'photoNotFound' }, () =>
        Result.error(DomainErrors.notFound('TreatmentPhoto', ids.data.photoId)),
      )
      .exhaustive()
  }
}
