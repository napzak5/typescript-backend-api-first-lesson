import type { AuthUseCaseDependencies } from '@beauty-salon-backend/domain'
import { Router } from 'express'
import type { Authenticated } from '../../shared/authentication'
import { neverStored } from '../../shared/never-stored'
import { changePasswordHandler } from './change-password.handler'
import { confirmEmailVerificationHandler } from './confirm-email-verification.handler'
import { disableTwoFactorHandler } from './disable-two-factor.handler'
import { enableTwoFactorHandler } from './enable-two-factor.handler'
import { forgotPasswordHandler } from './forgot-password.handler'
import { generateBackupCodesHandler } from './generate-backup-codes.handler'
import { getCurrentUserHandler } from './get-current-user.handler'
import { listSessionsHandler } from './list-sessions.handler'
import { loginHandler } from './login.handler'
import { logoutHandler } from './logout.handler'
import { logoutAllHandler } from './logout-all.handler'
import { refreshTokenHandler } from './refresh-token.handler'
import { registerHandler } from './register.handler'
import { resetPasswordHandler } from './reset-password.handler'
import { revokeSessionHandler } from './revoke-session.handler'
import { sendEmailVerificationHandler } from './send-email-verification.handler'
import { verifyResetTokenHandler } from './verify-reset-token.handler'
import { verifyTwoFactorHandler } from './verify-two-factor.handler'

/**
 * Authentication routes, relative to where the router is mounted. One
 * handler per operation of `AuthCrud` and `SessionCrud` in the TypeSpec
 * definition.
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
 * - POST /2fa/enable             enableTwoFactor           (authenticated)
 * - POST /2fa/verify             verifyTwoFactor           (authenticated)
 * - POST /2fa/disable            disableTwoFactor          (authenticated)
 * - POST /2fa/backup-codes       generateBackupCodes       (authenticated)
 * - GET  /sessions               getSessions               (authenticated)
 * - DELETE /sessions/:sessionId  revokeSession             (authenticated)
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
  router.post(
    '/2fa/enable',
    enableTwoFactorHandler(dependencies, authenticated),
  )
  router.post(
    '/2fa/verify',
    verifyTwoFactorHandler(dependencies, authenticated),
  )
  router.post(
    '/2fa/disable',
    disableTwoFactorHandler(dependencies, authenticated),
  )
  router.post(
    '/2fa/backup-codes',
    generateBackupCodesHandler(dependencies, authenticated),
  )
  router.get('/sessions', listSessionsHandler(dependencies, authenticated))
  router.delete(
    '/sessions/:sessionId',
    revokeSessionHandler(dependencies, authenticated),
  )

  return router
}
