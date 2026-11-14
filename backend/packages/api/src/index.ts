import {
  type Database,
  SalonRepository,
} from '@beauty-salon-backend/infrastructure'
import compression from 'compression'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { createSalonRouter } from './routes/salon'
import { API_BASE_PATH } from './shared/api-version'

export type AppDependencies = {
  database: Database
}

/**
 * Builds the Express application. Repositories are created here, once, and
 * handed to the routes, so that a handler never reaches for a global.
 */
export const createApp = ({ database }: AppDependencies): Express => {
  const app = express()

  app.use(helmet())
  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
      credentials: true,
    }),
  )
  app.use(compression())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use(
    `${API_BASE_PATH}/salons`,
    createSalonRouter({ salonRepository: new SalonRepository(database) }),
  )

  return app
}
