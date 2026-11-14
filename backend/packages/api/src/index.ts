import {
  type Database,
  type Logger,
  SalonRepository,
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
import { createSalonRouter } from './routes/salon'
import { createSystemRouter } from './routes/system'
import type { AppSettings } from './settings'
import { API_BASE_PATH, SYSTEM_BASE_PATH } from './shared/api-version'
import { BODY_LIMIT_BYTES } from './shared/problem-details'

export type { AppSettings } from './settings'

export type AppDependencies = {
  database: Database
  logger: Logger
  settings: AppSettings
}

/**
 * Builds the Express application. Repositories are created here, once, and
 * handed to the routes, so that a handler never reaches for a global.
 *
 * The order matters: every request gets its ID and logger first, the probes
 * are answered before the rate limit so that monitoring is never throttled,
 * and the two handlers at the end turn what is left over into problem
 * details.
 */
export const createApp = ({
  database,
  logger,
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

  app.use(
    `${API_BASE_PATH}/salons`,
    createSalonRouter({ salonRepository: new SalonRepository(database) }),
  )

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
