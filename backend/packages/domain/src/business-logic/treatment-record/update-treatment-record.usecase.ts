import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { TreatmentRecordReadMapper } from '../../mappers/read/treatment-record.mapper'
import { TreatmentRecordWriteMapper } from '../../mappers/write/treatment-record.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiTreatmentRecordResponse,
  parseTreatmentRecordId,
} from '../../models/treatment-record'
import { treatmentRecordUpdateRequestSchema } from '../../schemas/treatment-record.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { treatmentRecordReachOf } from './_shared/authorization'
import type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid treatment record'

export class UpdateTreatmentRecordUseCase {
  constructor(
    private readonly dependencies: TreatmentRecordUseCaseDependencies,
  ) {}

  /**
   * Changes what a request names of a record; materials that it names
   * replace those of the record, in their order. The booking, the customer
   * and the staff member of a record do not change: a record written for
   * the wrong booking is removed and written again. What the request names
   * is of the salon of the booking (`treatmentIssues`).
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiTreatmentRecordResponse, DomainError>> {
    const reach = treatmentRecordReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const recordId = parseTreatmentRecordId(id)
    if (recordId.type === 'error') {
      return recordId
    }
    const request = parseWith(
      treatmentRecordUpdateRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }

    const changed = await this.dependencies.treatmentRecordRepository.update(
      reach,
      recordId.data,
      TreatmentRecordWriteMapper.fromUpdateRequest(request.data),
    )
    if (changed.type === 'error') {
      return changed
    }

    return match(changed.data)
      .returnType<Result<ApiTreatmentRecordResponse, DomainError>>()
      .with({ type: 'changed' }, ({ record }) =>
        TreatmentRecordReadMapper.toApiTreatmentRecord(record),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('TreatmentRecord', recordId.data)),
      )
      .with({ type: 'refused' }, ({ issues }) =>
        Result.error(DomainErrors.validation(MESSAGE, issues)),
      )
      .exhaustive()
  }
}
