import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { TreatmentRecordReadMapper } from '../../mappers/read/treatment-record.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPaginationMeta } from '../../models/salon'
import type { ApiTreatmentRecordResponse } from '../../models/treatment-record'
import { treatmentRecordSearchRequestSchema } from '../../schemas/treatment-record.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { treatmentRecordReachOf } from './_shared/authorization'
import type { TreatmentRecordUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid treatment record search'

const DEFAULT_LIMIT = 20

export type TreatmentRecordPage = {
  data: ApiTreatmentRecordResponse[]
  meta: ApiPaginationMeta
}

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
  ): Promise<Result<TreatmentRecordPage, DomainError>> {
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
    const { cursor, salonId, customerId, staffId, startDate, endDate } =
      request.data
    if (salonId !== undefined && !isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.treatmentRecordRepository.list({
      reach,
      limit,
      after: cursor ?? null,
      salonId: salonId ?? null,
      customerId: customerId ?? null,
      staffId: staffId ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    })
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<Result<TreatmentRecordPage, DomainError>>()
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
      .with({ type: 'listed' }, ({ records, total, hasMore }) =>
        Result.map(
          TreatmentRecordReadMapper.toApiTreatmentRecords(records),
          (data) => ({
            data,
            meta: {
              total,
              limit,
              hasMore,
              cursor: cursor ?? null,
              nextCursor: hasMore ? (records.at(-1)?.record.id ?? null) : null,
              // Pages are only walked forwards.
              prevCursor: null,
            },
          }),
        ),
      )
      .exhaustive()
  }
}
