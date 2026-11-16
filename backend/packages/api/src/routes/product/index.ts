import type { ProductUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { createProductHandler } from './create-product.handler'
import { deleteProductHandler } from './delete-product.handler'
import { getProductHandler } from './get-product.handler'
import { listProductsHandler } from './list-products.handler'
import { updateProductHandler } from './update-product.handler'

/**
 * Product routes, relative to where the router is mounted, which is below a
 * salon (`/salons/:salonId/products`): the router takes `salonId` from
 * there. One handler per operation of `ProductCrud` in the TypeSpec
 * definition; every one of them needs a signed-in user:
 *
 * - GET    /     list
 * - POST   /     create
 * - GET    /:id  get
 * - PATCH  /:id  update
 * - DELETE /:id  delete
 */
export const createProductRouter = (
  dependencies: ProductUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router({ mergeParams: true })

  router.get('/', listProductsHandler(dependencies, authenticated))
  router.post('/', createProductHandler(dependencies, authenticated))
  router.get('/:id', getProductHandler(dependencies, authenticated))
  router.patch('/:id', updateProductHandler(dependencies, authenticated))
  router.delete('/:id', deleteProductHandler(dependencies, authenticated))

  return router
}
