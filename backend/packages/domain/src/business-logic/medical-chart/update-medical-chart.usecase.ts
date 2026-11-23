import { Result } from '@beauty-salon-backend/utility'
import { medicalChartMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { MedicalChartReadMapper } from '../../mappers/read/medical-chart.mapper'
import { MedicalChartWriteMapper } from '../../mappers/write/medical-chart.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiMedicalChartResponse,
  parseMedicalChartId,
} from '../../models/medical-chart'
import { medicalChartUpdateRequestSchema } from '../../schemas/medical-chart.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from '../customer/_shared/authorization'
import type { MedicalChartUseCaseDependencies } from './_shared/dependencies'
import { medicalChartRuleIssues } from './_shared/rules'

const MESSAGE = medicalChartMessages.invalidMedicalChart

export class UpdateMedicalChartUseCase {
  constructor(private readonly dependencies: MedicalChartUseCaseDependencies) {}

  /**
   * Changes what a request names of a chart; a list that it names replaces
   * the list of the chart. The customer of a chart does not change. The
   * chart of a customer who was deleted is not there.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiMedicalChartResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const chartId = parseMedicalChartId(id)
    if (chartId.type === 'error') {
      return chartId
    }
    const request = parseWith(medicalChartUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const changes = MedicalChartWriteMapper.fromUpdateRequest(request.data)
    const issues = medicalChartRuleIssues(changes, this.dependencies.clock())
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const changed = await this.dependencies.medicalChartRepository.update(
      chartId.data,
      changes,
    )
    if (changed.type === 'error') {
      return changed
    }

    return match(changed.data)
      .returnType<Result<ApiMedicalChartResponse, DomainError>>()
      .with({ type: 'changed' }, ({ chart }) =>
        MedicalChartReadMapper.toApiMedicalChart(chart),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('MedicalChart', chartId.data)),
      )
      .exhaustive()
  }
}
