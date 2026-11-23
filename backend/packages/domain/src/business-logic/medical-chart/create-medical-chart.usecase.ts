import { Result } from '@beauty-salon-backend/utility'
import {
  medicalChartMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { MedicalChartReadMapper } from '../../mappers/read/medical-chart.mapper'
import { MedicalChartWriteMapper } from '../../mappers/write/medical-chart.mapper'
import type { Actor } from '../../models/auth'
import type { ApiMedicalChartResponse } from '../../models/medical-chart'
import { medicalChartCreateRequestSchema } from '../../schemas/medical-chart.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { mayHandleCustomers } from '../customer/_shared/authorization'
import type { MedicalChartUseCaseDependencies } from './_shared/dependencies'
import { medicalChartRuleIssues } from './_shared/rules'

const MESSAGE = medicalChartMessages.invalidMedicalChart

export class CreateMedicalChartUseCase {
  constructor(private readonly dependencies: MedicalChartUseCaseDependencies) {}

  /**
   * Writes the chart of a customer who is there and has none, with the
   * previous treatments in the order of the request.
   *
   * Whether the actor writes charts at all is decided before the request
   * is read: those who keep the customer ledger keep the charts.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiMedicalChartResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(medicalChartCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const chart = MedicalChartWriteMapper.fromCreateRequest(request.data)
    const issues = medicalChartRuleIssues(chart, this.dependencies.clock())
    if (issues.length > 0) {
      return Result.error(DomainErrors.validation(MESSAGE, issues))
    }

    const created = await this.dependencies.medicalChartRepository.create(chart)
    if (created.type === 'error') {
      return created
    }

    return match(created.data)
      .returnType<Result<ApiMedicalChartResponse, DomainError>>()
      .with({ type: 'created' }, ({ chart: opened }) =>
        MedicalChartReadMapper.toApiMedicalChart(opened),
      )
      .with({ type: 'customerNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'customerId',
              rule: 'not_found',
              message: ruleMessages.aCustomer,
            },
          ]),
        ),
      )
      .with({ type: 'chartExists' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The customer has a medical chart already; a customer has one',
          ),
        ),
      )
      .exhaustive()
  }
}
