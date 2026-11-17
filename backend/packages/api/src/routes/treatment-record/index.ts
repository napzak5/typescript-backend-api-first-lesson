import type { TreatmentRecordUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createTreatmentRecordHandler } from './create-treatment-record.handler'
import { deleteTreatmentRecordHandler } from './delete-treatment-record.handler'
import { getTreatmentRecordHandler } from './get-treatment-record.handler'
import { listTreatmentRecordsHandler } from './list-treatment-records.handler'
import { updateTreatmentRecordHandler } from './update-treatment-record.handler'

/**
 * Treatment record routes, relative to where the router is mounted. One
 * handler per operation of `TreatmentRecordCrud` in the TypeSpec definition
 * that is implemented; every one of them needs a signed-in user, and the
 * use cases decide who may:
 *
 * - GET    /      list
 * - POST   /      create
 * - GET    /:id   get
 * - PATCH  /:id   update
 * - DELETE /:id   delete
 *
 * The statistics (`getStatistics`) and the photos (`addPhotos`) are not
 * served yet, and are answered as routes that are not there. The path of
 * the statistics comes before `/:id`, which would take its name for an ID.
 */
export const createTreatmentRecordRouter = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listTreatmentRecordsHandler(dependencies, authenticated))
  router.post('/', createTreatmentRecordHandler(dependencies, authenticated))
  router.get('/statistics', (_req, _res, next) => next('router'))
  router.get('/:id', getTreatmentRecordHandler(dependencies, authenticated))
  router.patch(
    '/:id',
    updateTreatmentRecordHandler(dependencies, authenticated),
  )
  router.delete(
    '/:id',
    deleteTreatmentRecordHandler(dependencies, authenticated),
  )

  return router
}
