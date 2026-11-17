import type { TreatmentRecordUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { addTreatmentPhotosHandler } from './add-treatment-photos.handler'
import { createTreatmentRecordHandler } from './create-treatment-record.handler'
import { deleteTreatmentRecordHandler } from './delete-treatment-record.handler'
import { getTreatmentRecordHandler } from './get-treatment-record.handler'
import { getTreatmentStatisticsHandler } from './get-treatment-statistics.handler'
import { listTreatmentRecordsHandler } from './list-treatment-records.handler'
import { removeTreatmentPhotoHandler } from './remove-treatment-photo.handler'
import { updateTreatmentRecordHandler } from './update-treatment-record.handler'

/**
 * Treatment record routes, relative to where the router is mounted. One
 * handler per operation of `TreatmentRecordCrud` in the TypeSpec definition;
 * every one of them needs a signed-in user, and the use cases decide who
 * may:
 *
 * - GET    /                     list
 * - POST   /                     create
 * - GET    /statistics           getStatistics
 * - GET    /:id                  get
 * - PATCH  /:id                  update
 * - DELETE /:id                  delete
 * - POST   /:id/photos           addPhotos
 * - DELETE /:id/photos/:photoId  removePhoto
 *
 * The path of the statistics comes before `/:id`, which would take its
 * name for an ID.
 */
export const createTreatmentRecordRouter = (
  dependencies: TreatmentRecordUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.get('/', listTreatmentRecordsHandler(dependencies, authenticated))
  router.post('/', createTreatmentRecordHandler(dependencies, authenticated))
  router.get(
    '/statistics',
    getTreatmentStatisticsHandler(dependencies, authenticated),
  )
  router.get('/:id', getTreatmentRecordHandler(dependencies, authenticated))
  router.patch(
    '/:id',
    updateTreatmentRecordHandler(dependencies, authenticated),
  )
  router.delete(
    '/:id',
    deleteTreatmentRecordHandler(dependencies, authenticated),
  )
  router.post(
    '/:id/photos',
    addTreatmentPhotosHandler(dependencies, authenticated),
  )
  router.delete(
    '/:id/photos/:photoId',
    removeTreatmentPhotoHandler(dependencies, authenticated),
  )

  return router
}
