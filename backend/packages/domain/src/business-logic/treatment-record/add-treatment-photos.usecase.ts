import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { TreatmentRecordReadMapper } from '../../mappers/read/treatment-record.mapper'
import { TreatmentRecordWriteMapper } from '../../mappers/write/treatment-record.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiTreatmentPhotoBulkCreateResponse,
  parseTreatmentRecordId,
  type TreatmentRecordId,
} from '../../models/treatment-record'
import { treatmentPhotoBulkCreateRequestSchema } from '../../schemas/treatment-photo.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { treatmentRecordReachOf } from './_shared/authorization'
import type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'
import { MAX_PHOTOS_OF_RECORD } from './_shared/photos'

const MESSAGE = 'Invalid treatment photos'

/** The photos an addition wrote, and the record they were added to. */
type AddedTreatmentPhotos = {
  recordId: TreatmentRecordId
  response: ApiTreatmentPhotoBulkCreateResponse
}

export class AddTreatmentPhotosUseCase {
  constructor(
    private readonly dependencies: TreatmentRecordUseCaseDependencies,
  ) {}

  /**
   * Adds photos to a record, all or none, by those who write the record.
   * A record holds one photo of an address, and at most
   * `MAX_PHOTOS_OF_RECORD` photos (`photoAdditionRefusal`).
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<AddedTreatmentPhotos, DomainError>> {
    const reach = treatmentRecordReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const recordId = parseTreatmentRecordId(id)
    if (recordId.type === 'error') {
      return recordId
    }
    const request = parseWith(
      treatmentPhotoBulkCreateRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }

    const added = await this.dependencies.treatmentRecordRepository.addPhotos(
      reach,
      recordId.data,
      TreatmentRecordWriteMapper.fromPhotoBulkCreateRequest(request.data),
    )
    if (added.type === 'error') {
      return added
    }

    return match(added.data)
      .returnType<Result<AddedTreatmentPhotos, DomainError>>()
      .with({ type: 'added' }, ({ recordId: addedTo, photos }) =>
        Result.success({
          recordId: addedTo,
          response: { created: TreatmentRecordReadMapper.toApiPhotos(photos) },
        }),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('TreatmentRecord', recordId.data)),
      )
      .with(
        { type: 'refused', refusal: { type: 'photoExists' } },
        ({ refusal }) =>
          Result.error(
            DomainErrors.conflict(
              `The record holds a photo at ${refusal.photoUrl} already; a record holds one photo of an address`,
            ),
          ),
      )
      .with(
        { type: 'refused', refusal: { type: 'tooManyPhotos' } },
        ({ refusal }) =>
          Result.error(
            DomainErrors.conflict(
              `The record holds ${refusal.held} photos; a record holds at most ${MAX_PHOTOS_OF_RECORD}`,
            ),
          ),
      )
      .exhaustive()
  }
}
