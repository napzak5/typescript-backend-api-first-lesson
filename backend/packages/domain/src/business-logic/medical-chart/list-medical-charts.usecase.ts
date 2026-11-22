import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { MedicalChartReadMapper } from '../../mappers/read/medical-chart.mapper'
import { MedicalChartWriteMapper } from '../../mappers/write/medical-chart.mapper'
import type { Actor } from '../../models/auth'
import type { ApiMedicalChartResponse } from '../../models/medical-chart'
import type { ApiPage } from '../../models/page'
import { medicalChartSearchRequestSchema } from '../../schemas/medical-chart.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from '../customer/_shared/authorization'
import type { MedicalChartUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid medical chart search'

export class ListMedicalChartsUseCase {
  constructor(private readonly dependencies: MedicalChartUseCaseDependencies) {}

  /**
   * Lists the charts of the customers who are not deleted, latest first by
   * their creation. The cursor of a page is the ID of its last chart, and
   * one that names no chart of the list is refused.
   *
   * Whether the actor reads charts is decided before the request is looked
   * at, which is why the query arrives as the caller decoded it.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiMedicalChartResponse>, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      medicalChartSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const criteria = MedicalChartWriteMapper.fromSearchRequest(request.data)

    const listed = await this.dependencies.medicalChartRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<Result<ApiPage<ApiMedicalChartResponse>, DomainError>>()
      .with({ type: 'cursorNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'cursor',
              rule: 'not_found',
              message: 'Must name a medical chart of the list',
            },
          ]),
        ),
      )
      .with({ type: 'listed' }, (list) =>
        MedicalChartReadMapper.toApiMedicalChartPage(list, criteria),
      )
      .exhaustive()
  }
}
