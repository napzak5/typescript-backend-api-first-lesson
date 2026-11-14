import type { AuthUseCaseDependencies } from '@beauty-salon-backend/domain'
import { type RequestHandler, Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { getCurrentUserHandler } from './get-current-user.handler'
import { loginHandler } from './login.handler'
import { logoutHandler } from './logout.handler'
import { logoutAllHandler } from './logout-all.handler'
import { refreshTokenHandler } from './refresh-token.handler'

/**
 * Every response of these routes carries tokens or the data of one user, so
 * none of them may be kept by a cache.
 */
const neverStored: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

/**
 * Authentication routes, relative to where the router is mounted. One
 * handler per operation of `AuthCrud` in the TypeSpec definition; the
 * operations not listed here are not implemented yet.
 *
 * - POST /login       login
 * - POST /refresh     refreshToken
 * - POST /logout      logout          (authenticated)
 * - POST /logout-all  logoutAll       (authenticated)
 * - GET  /me          getCurrentUser  (authenticated)
 */
export const createAuthRouter = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.use(neverStored)

  router.post('/login', loginHandler(dependencies))
  router.post('/refresh', refreshTokenHandler(dependencies))
  router.post('/logout', logoutHandler(dependencies, authenticated))
  router.post('/logout-all', logoutAllHandler(dependencies, authenticated))
  router.get('/me', getCurrentUserHandler(dependencies, authenticated))

  return router
}
