import type { SalesReportUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { exportSalesReportHandler } from './export-sales-report.handler'
import { getDailySalesHandler } from './get-daily-sales.handler'
import { getSalesByCategoryHandler } from './get-sales-by-category.handler'
import { getSalesByStaffHandler } from './get-sales-by-staff.handler'
import { getSalesReportHandler } from './get-sales-report.handler'
import { getSalesTrendsHandler } from './get-sales-trends.handler'

/**
 * The reports of the sales of a salon, at /api/v1/sales-reports. Each is a
 * GET whose query names the salon; nothing is written. The export answers
 * a CSV file, the others JSON.
 */
export const createSalesReportRouter = (
  dependencies: SalesReportUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', getSalesReportHandler(dependencies, authenticated))
  router.get('/daily', getDailySalesHandler(dependencies, authenticated))
  router.get('/by-staff', getSalesByStaffHandler(dependencies, authenticated))
  router.get(
    '/by-category',
    getSalesByCategoryHandler(dependencies, authenticated),
  )
  router.get('/trends', getSalesTrendsHandler(dependencies, authenticated))
  router.get('/export', exportSalesReportHandler(dependencies, authenticated))

  return router
}
