import type { AuthUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { neverStored } from '../../shared/never-stored'
import { getUserHandler } from './get-user.handler'
import { resetTwoFactorHandler } from './reset-two-factor.handler'
import { unlockAccountHandler } from './unlock-account.handler'

/**
 * What an administrator does with the accounts of other users, relative to
 * where the router is mounted. One handler per operation of `AdminAuthCrud`
 * in the TypeSpec definition; each needs a signed-in user, and its use case
 * refuses everyone but an administrator.
 *
 * - GET  /users/:userId             getUser
 * - POST /unlock/:userId            unlockAccount
 * - POST /reset-two-factor/:userId  resetTwoFactor
 */
export const createAdminAuthRouter = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.use(neverStored)

  router.get('/users/:userId', getUserHandler(dependencies, authenticated))
  router.post(
    '/unlock/:userId',
    unlockAccountHandler(dependencies, authenticated),
  )
  router.post(
    '/reset-two-factor/:userId',
    resetTwoFactorHandler(dependencies, authenticated),
  )

  return router
}
