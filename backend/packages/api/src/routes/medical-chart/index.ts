import type {
  CustomerAllergyUseCaseDependencies,
  MedicalChartUseCaseDependencies,
} from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { addCustomerAllergyHandler } from './add-customer-allergy.handler'
import { createMedicalChartHandler } from './create-medical-chart.handler'
import { getMedicalChartHandler } from './get-medical-chart.handler'
import { listCustomerAllergiesHandler } from './list-customer-allergies.handler'
import { listMedicalChartsHandler } from './list-medical-charts.handler'
import { removeCustomerAllergyHandler } from './remove-customer-allergy.handler'
import { updateCustomerAllergyHandler } from './update-customer-allergy.handler'
import { updateMedicalChartHandler } from './update-medical-chart.handler'

/**
 * Medical chart routes, relative to where the router is mounted. One
 * handler per operation of `MedicalChartCrud` in the TypeSpec definition;
 * every one of them needs a signed-in user, and the use cases decide who
 * may:
 *
 * - GET    /                                          list
 * - POST   /                                          create
 * - GET    /customer/:customerId                      getByCustomer
 * - PATCH  /:id                                       update
 * - GET    /customer/:customerId/allergies            listAllergies
 * - POST   /customer/:customerId/allergies            addAllergy
 * - PATCH  /customer/:customerId/allergies/:allergyId  updateAllergy
 * - DELETE /customer/:customerId/allergies/:allergyId  removeAllergy
 *
 * A chart is read by its customer and changed by its own ID. The allergies
 * are those of a customer, with or without a chart.
 */
export const createMedicalChartRouter = (
  dependencies: MedicalChartUseCaseDependencies &
    CustomerAllergyUseCaseDependencies,
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
  router.get(
    '/customer/:customerId/allergies',
    listCustomerAllergiesHandler(dependencies, authenticated),
  )
  router.post(
    '/customer/:customerId/allergies',
    addCustomerAllergyHandler(dependencies, authenticated),
  )
  router.patch(
    '/customer/:customerId/allergies/:allergyId',
    updateCustomerAllergyHandler(dependencies, authenticated),
  )
  router.delete(
    '/customer/:customerId/allergies/:allergyId',
    removeCustomerAllergyHandler(dependencies, authenticated),
  )

  return router
}
