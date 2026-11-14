import type {
  AuthUseCaseDependencies,
  IMailer,
  ITwoFactorAuthenticator,
} from '@beauty-salon-backend/domain'
import {
  Argon2PasswordHasher,
  CustomerRepository,
  type Database,
  type Logger,
  RandomTokenIssuer,
  SalonRepository,
  ServiceCategoryRepository,
  ServiceRepository,
  SessionRepository,
  UserRepository,
} from '@beauty-salon-backend/infrastructure'
import compression from 'compression'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import {
  errorHandler,
  notFoundHandler,
  requireJsonBody,
} from './middleware/errors'
import { rateLimiting } from './middleware/rate-limiting'
import { requestLogging } from './middleware/request-logging'
import { createAdminAuthRouter } from './routes/admin-auth'
import { createAuthRouter } from './routes/auth'
import { createCustomerRouter } from './routes/customer'
import { createSalonRouter } from './routes/salon'
import { createServiceRouter } from './routes/service'
import { createServiceCategoryRouter } from './routes/service-category'
import { createSystemRouter } from './routes/system'
import type { AppSettings } from './settings'
import { API_BASE_PATH, SYSTEM_BASE_PATH } from './shared/api-version'
import { createAuthenticated } from './shared/authentication'
import { BODY_LIMIT_BYTES } from './shared/problem-details'

export type { AppSettings } from './settings'

export type AppDependencies = {
  database: Database
  logger: Logger
  /** Carries the mails of the authentication flows. */
  mailer: IMailer
  /** Issues and checks the codes of two-factor authentication. */
  twoFactorAuthenticator: ITwoFactorAuthenticator
  settings: AppSettings
}

/**
 * Builds the Express application. Repositories are created here, once, and
 * handed to the routes, so that a handler never reaches for a global. The
 * routes that need a signed-in user get `authenticated` to wrap their
 * handlers with.
 *
 * The order matters: every request gets its ID and logger first, the probes
 * are answered before the rate limit so that monitoring is never throttled,
 * and the two handlers at the end turn what is left over into problem
 * details.
 */
export const createApp = ({
  database,
  logger,
  mailer,
  twoFactorAuthenticator,
  settings,
}: AppDependencies): Express => {
  const app = express()

  app.set('trust proxy', settings.trustProxyHops)

  app.use(requestLogging(logger))
  app.use(helmet())
  app.use(
    cors({
      origin: settings.cors.origins,
      credentials: settings.cors.credentials,
      maxAge: settings.cors.maxAgeSeconds,
    }),
  )

  app.use(SYSTEM_BASE_PATH, createSystemRouter({ database }))

  app.use(rateLimiting(settings.rateLimit))
  app.use(compression())
  app.use(requireJsonBody)
  app.use(express.json({ limit: BODY_LIMIT_BYTES }))

  const clock = (): Date => new Date()

  const authDependencies: AuthUseCaseDependencies = {
    userRepository: new UserRepository(database),
    sessionRepository: new SessionRepository(database),
    passwordHasher: new Argon2PasswordHasher(),
    tokenIssuer: new RandomTokenIssuer(),
    twoFactorAuthenticator,
    mailer,
    publicAppUrl: settings.publicAppUrl,
    clock,
  }
  const authenticated = createAuthenticated(authDependencies)

  app.use(
    `${API_BASE_PATH}/auth`,
    createAuthRouter(authDependencies, authenticated),
  )
  app.use(
    `${API_BASE_PATH}/admin/auth`,
    createAdminAuthRouter(authDependencies, authenticated),
  )
  const salonRepository = new SalonRepository(database)
  app.use(
    `${API_BASE_PATH}/salons`,
    createSalonRouter({ salonRepository }, authenticated),
  )
  app.use(
    `${API_BASE_PATH}/salons/:salonId/service-categories`,
    createServiceCategoryRouter(
      {
        serviceCategoryRepository: new ServiceCategoryRepository(database),
        salonRepository,
      },
      authenticated,
    ),
  )
  app.use(
    `${API_BASE_PATH}/salons/:salonId/services`,
    createServiceRouter(
      { serviceRepository: new ServiceRepository(database), salonRepository },
      authenticated,
    ),
  )

  app.use(
    `${API_BASE_PATH}/customers`,
    createCustomerRouter(
      { customerRepository: new CustomerRepository(database), clock },
      authenticated,
    ),
  )

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
