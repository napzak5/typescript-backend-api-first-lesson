import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { MedicalChartReadMapper } from '../../mappers/read/medical-chart.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiMedicalChartResponse,
  parseChartCustomerId,
} from '../../models/medical-chart'
import { type DomainError, DomainErrors } from '../../shared'
import { mayHandleCustomers } from '../customer/_shared/authorization'
import type { MedicalChartUseCaseDependencies } from './_shared/dependencies'

export class GetMedicalChartUseCase {
  constructor(private readonly dependencies: MedicalChartUseCaseDependencies) {}

  /**
   * Finds the chart of a customer. A customer who was deleted is one who is
   * not there, and their chart is not shown.
   */
  async execute(
    actor: Actor,
    customerId: unknown,
  ): Promise<Result<ApiMedicalChartResponse, DomainError>> {
    if (!mayHandleCustomers(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const id = parseChartCustomerId(customerId)
    if (id.type === 'error') {
      return id
    }

    const found = await this.dependencies.medicalChartRepository.findByCustomer(
      id.data,
    )
    if (found.type === 'error') {
      return found
    }

    return match(found.data)
      .returnType<Result<ApiMedicalChartResponse, DomainError>>()
      .with({ type: 'found' }, ({ chart }) =>
        MedicalChartReadMapper.toApiMedicalChart(chart),
      )
      .with({ type: 'customerNotFound' }, () =>
        Result.error(DomainErrors.notFound('Customer', id.data)),
      )
      .with({ type: 'chartNotFound' }, () =>
        Result.error(DomainErrors.notFound('MedicalChart', id.data)),
      )
      .exhaustive()
  }
}
