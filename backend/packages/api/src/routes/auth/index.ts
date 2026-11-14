import type { AuthUseCaseDependencies } from '@beauty-salon-backend/domain'
import { type RequestHandler, Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { changePasswordHandler } from './change-password.handler'
import { confirmEmailVerificationHandler } from './confirm-email-verification.handler'
import { forgotPasswordHandler } from './forgot-password.handler'
import { getCurrentUserHandler } from './get-current-user.handler'
import { loginHandler } from './login.handler'
import { logoutHandler } from './logout.handler'
import { logoutAllHandler } from './logout-all.handler'
import { refreshTokenHandler } from './refresh-token.handler'
import { registerHandler } from './register.handler'
import { resetPasswordHandler } from './reset-password.handler'
import { sendEmailVerificationHandler } from './send-email-verification.handler'
import { verifyResetTokenHandler } from './verify-reset-token.handler'

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
 * - POST /register               register
 * - POST /login                  login
 * - POST /refresh                refreshToken
 * - POST /logout                 logout                    (authenticated)
 * - POST /logout-all             logoutAll                 (authenticated)
 * - GET  /me                     getCurrentUser            (authenticated)
 * - POST /verify-email/send      sendEmailVerification
 * - POST /verify-email/confirm   confirmEmailVerification
 * - POST /forgot-password        forgotPassword
 * - POST /reset-password/verify  verifyResetToken
 * - POST /reset-password         resetPassword
 * - POST /change-password        changePassword            (authenticated)
 */
export const createAuthRouter = (
  dependencies: AuthUseCaseDependencies,
  authenticated: Authenticated,
): Router => {
  const router = Router()

  router.use(neverStored)

  router.post('/register', registerHandler(dependencies))
  router.post('/login', loginHandler(dependencies))
  router.post('/refresh', refreshTokenHandler(dependencies))
  router.post('/logout', logoutHandler(dependencies, authenticated))
  router.post('/logout-all', logoutAllHandler(dependencies, authenticated))
  router.get('/me', getCurrentUserHandler(dependencies, authenticated))
  router.post('/verify-email/send', sendEmailVerificationHandler(dependencies))
  router.post(
    '/verify-email/confirm',
    confirmEmailVerificationHandler(dependencies),
  )
  router.post('/forgot-password', forgotPasswordHandler(dependencies))
  router.post('/reset-password/verify', verifyResetTokenHandler(dependencies))
  router.post('/reset-password', resetPasswordHandler(dependencies))
  router.post(
    '/change-password',
    changePasswordHandler(dependencies, authenticated),
  )

  return router
}
