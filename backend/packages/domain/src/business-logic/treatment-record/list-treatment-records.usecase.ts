import { Result } from '@beauty-salon-backend/utility'
import { treatmentRecordMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { TreatmentRecordReadMapper } from '../../mappers/read/treatment-record.mapper'
import { TreatmentRecordWriteMapper } from '../../mappers/write/treatment-record.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPage } from '../../models/page'
import type { ApiTreatmentRecordResponse } from '../../models/treatment-record'
import { treatmentRecordSearchRequestSchema } from '../../schemas/treatment-record.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { treatmentRecordReachOf } from './_shared/authorization'
import type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = treatmentRecordMessages.invalidTreatmentRecordSearch

export class ListTreatmentRecordsUseCase {
  constructor(
    private readonly dependencies: TreatmentRecordUseCaseDependencies,
  ) {}

  /**
   * Lists the records the actor reaches, latest first by their creation.
   * The cursor of a page is the ID of its last record, and one that names
   * no record the actor reaches is refused.
   *
   * Whether the actor reads records is decided before the request is
   * looked at, which is why the query arrives as the caller decoded it. A
   * member of a salon is listed the records of that salon and is refused
   * when the query names another; an administrator is listed those of
   * every salon, or of the one the query names.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiTreatmentRecordResponse>, DomainError>> {
    const reach = treatmentRecordReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      treatmentRecordSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const criteria = TreatmentRecordWriteMapper.fromSearchRequest(
      request.data,
      reach,
    )
    if (criteria.salonId !== null && !isWithin(reach, criteria.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const listed =
      await this.dependencies.treatmentRecordRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<Result<ApiPage<ApiTreatmentRecordResponse>, DomainError>>()
      .with({ type: 'cursorNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'cursor',
              rule: 'not_found',
              message: 'Must name a treatment record of the list',
            },
          ]),
        ),
      )
      .with({ type: 'listed' }, (list) =>
        TreatmentRecordReadMapper.toApiTreatmentRecordPage(list, criteria),
      )
      .exhaustive()
  }
}
