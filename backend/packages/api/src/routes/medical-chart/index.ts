import type { MedicalChartUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createMedicalChartHandler } from './create-medical-chart.handler'
import { getMedicalChartHandler } from './get-medical-chart.handler'
import { listMedicalChartsHandler } from './list-medical-charts.handler'
import { updateMedicalChartHandler } from './update-medical-chart.handler'

/**
 * Medical chart routes, relative to where the router is mounted. One
 * handler per operation of `MedicalChartCrud` in the TypeSpec definition
 * but `listAllergies`, which is not served yet; every one of them needs a
 * signed-in user, and the use cases decide who may:
 *
 * - GET    /                      list
 * - POST   /                      create
 * - GET    /customer/:customerId  getByCustomer
 * - PATCH  /:id                   update
 *
 * A chart is read by its customer and changed by its own ID.
 */
export const createMedicalChartRouter = (
  dependencies: MedicalChartUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listMedicalChartsHandler(dependencies, authenticated))
  router.post('/', createMedicalChartHandler(dependencies, authenticated))
  router.get(
    '/customer/:customerId',
    getMedicalChartHandler(dependencies, authenticated),
  )
  router.patch('/:id', updateMedicalChartHandler(dependencies, authenticated))

  return router
}
