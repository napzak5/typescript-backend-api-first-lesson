import { loadEnvFile, parseAppConfig } from '@beauty-salon-backend/config'
import { createLogger } from '@beauty-salon-backend/infrastructure'
import { match } from 'ts-pattern'
// Compiled by tsc alone and run by Node, which resolves no extension.
import { startServer } from './server.js'

/**
 * Entry point of the API server: reads the configuration, starts the server
 * and stops it when the platform asks. Everything that ends the process is
 * here; the rest of the application reports failures as values.
 */
const main = async (): Promise<void> => {
  const { environment, file } = loadEnvFile()

  const parsed = parseAppConfig(process.env)
  if (parsed.type === 'error') {
    // The log settings are part of what could not be read.
    createLogger({ level: 'info', format: 'json', environment }).fatal(
      { issues: parsed.error },
      'Invalid configuration',
    )
    process.exit(1)
  }

  const config = parsed.data
  const logger = createLogger({
    ...config.logging,
    environment: config.environment,
  })

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception')
    process.exit(1)
  })
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled rejection')
    process.exit(1)
  })

  logger.info({ envFile: file }, 'Starting server')

  const started = await startServer(config, logger)

  match(started)
    .with({ type: 'success' }, ({ data: server }) => {
      logger.info(
        { host: config.server.host, port: server.port },
        'Server listening',
      )

      // Handled once: a second signal ends the process at once.
      const shutdown = (signal: NodeJS.Signals): void => {
        logger.info({ signal }, 'Shutting down')
        void server.stop().then(() => {
          logger.info('Server stopped')
          process.exit(0)
        })
      }
      process.once('SIGTERM', shutdown)
      process.once('SIGINT', shutdown)
    })
    .with(
      { type: 'error', error: { type: 'databaseUnreachable' } },
      ({ error }) => {
        logger.fatal(
          { error: error.error },
          'Cannot start: the database is unreachable',
        )
        process.exit(1)
      },
    )
    .with({ type: 'error', error: { type: 'listenFailed' } }, ({ error }) => {
      logger.fatal({ err: error.error }, 'Cannot start: cannot listen')
      process.exit(1)
    })
    .exhaustive()
}

void main()
