import { Result } from '@beauty-salon-backend/utility'
import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import type { LedgerReach } from '../../../models/booking'
import type {
  SalesFigures,
  SalesPeriod,
} from '../../../repositories/sales-report.repository'
import { type DomainError, DomainErrors, type Told } from '../../../shared'
import { isWithin } from '../../booking/_shared/authorization'
import { notFound } from '../../booking/_shared/plan'
import type { SalesReportUseCaseDependencies } from './dependencies'

/**
 * The figures of the sales of a period, once the query was read. A salon
 * the actor does not run is refused before it is looked up, so whether it
 * is there is told only to the administrators, as a rule of the query.
 */
export const figuresOf = async (
  { salesReportRepository }: SalesReportUseCaseDependencies,
  reach: LedgerReach,
  period: SalesPeriod,
  message: Told,
): Promise<Result<SalesFigures, DomainError>> => {
  if (!isWithin(reach, period.salonId)) {
    return Result.error(DomainErrors.forbidden())
  }

  const figures = await salesReportRepository.findFigures(period)
  if (figures.type === 'error') {
    return figures
  }

  return figures.data === null
    ? Result.error(
        DomainErrors.validation(message, [
          notFound('salonId', ruleMessages.aSalon),
        ]),
      )
    : Result.success(figures.data)
}
