import { Result } from '@beauty-salon-backend/utility'
import { treatmentRecordMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { TreatmentRecordReadMapper } from '../../mappers/read/treatment-record.mapper'
import { TreatmentRecordWriteMapper } from '../../mappers/write/treatment-record.mapper'
import type { Actor } from '../../models/auth'
import type { ApiTreatmentRecordResponse } from '../../models/treatment-record'
import { treatmentRecordCreateRequestSchema } from '../../schemas/treatment-record.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import { treatmentRecordReachOf } from './_shared/authorization'
import type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = treatmentRecordMessages.invalidTreatmentRecord

export class CreateTreatmentRecordUseCase {
  constructor(
    private readonly dependencies: TreatmentRecordUseCaseDependencies,
  ) {}

  /**
   * Writes the record of the treatment of a booking, with the materials it
   * used in the order of the request. The booking is one of a salon the
   * actor reaches, whose treatment has begun and which has no record yet;
   * what the record names is of its salon (`creationIssues`).
   *
   * Whether the actor writes records at all is decided before the request
   * is read. A booking the actor does not reach is a booking the request
   * names wrongly (400), as one that is not there is.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiTreatmentRecordResponse, DomainError>> {
    const reach = treatmentRecordReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(
      treatmentRecordCreateRequestSchema,
      input,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }

    const { record, materials } = TreatmentRecordWriteMapper.fromCreateRequest(
      request.data,
    )
    const created = await this.dependencies.treatmentRecordRepository.create({
      reach,
      record,
      materials,
    })
    if (created.type === 'error') {
      return created
    }

    return match(created.data)
      .returnType<Result<ApiTreatmentRecordResponse, DomainError>>()
      .with({ type: 'created' }, ({ record }) =>
        TreatmentRecordReadMapper.toApiTreatmentRecord(record),
      )
      .with({ type: 'bookingNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            notFound('bookingId', 'a booking of a salon'),
          ]),
        ),
      )
      .with({ type: 'refused' }, ({ issues }) =>
        Result.error(DomainErrors.validation(MESSAGE, issues)),
      )
      .with({ type: 'bookingNotTreated' }, ({ status }) =>
        Result.error(
          DomainErrors.conflict(
            `The booking is ${status}; a treatment is recorded once it has begun`,
          ),
        ),
      )
      .with({ type: 'recordExists' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The booking has a treatment record already; a booking has one',
          ),
        ),
      )
      .exhaustive()
  }
}
