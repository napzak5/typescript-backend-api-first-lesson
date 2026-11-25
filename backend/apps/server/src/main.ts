import { loadEnvFile, parseAppConfig } from '@beauty-salon-backend/config'
import {
  createLogger,
  type LogDestination,
} from '@beauty-salon-backend/infrastructure'
import { match } from 'ts-pattern'
// Compiled by tsc alone and run by Node, which resolves no extension.
import { startServer } from './server.js'

/**
 * What the server takes of the process it runs in: `process` of Node.js, or
 * what a test gives in its place.
 */
interface ServerProcess {
  /** The variables of the environment; the environment file adds to them. */
  readonly env: Record<string, string | undefined>
  /** Ends the process with the status. */
  exit(code: number): void
  /** Calls the listener the first time the signal comes. */
  once(
    signal: NodeJS.Signals,
    listener: (signal: NodeJS.Signals) => void,
  ): unknown
  /** Calls the listener for an exception that nothing caught. */
  on(event: 'uncaughtException', listener: (error: Error) => void): unknown
  /** Calls the listener for a rejection that nothing handled. */
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): unknown
}

/**
 * Runs the API server in the process: reads the configuration, starts the
 * server and stops it when the platform asks. Everything that ends the
 * process is here; the rest of the application reports failures as values.
 * The log goes to standard output, or where a test reads it.
 */
export const main = async (
  serverProcess: ServerProcess,
  logTo?: LogDestination,
): Promise<void> => {
  const { environment, file } = loadEnvFile(serverProcess.env)

  const parsed = parseAppConfig(serverProcess.env)
  if (parsed.type === 'error') {
    // The log settings are part of what could not be read.
    createLogger({ level: 'info', format: 'json', environment }, logTo).fatal(
      { issues: parsed.error },
      'Invalid configuration',
    )
    serverProcess.exit(1)
    return
  }

  const config = parsed.data
  const logger = createLogger(
    { ...config.logging, environment: config.environment },
    logTo,
  )

  serverProcess.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception')
    serverProcess.exit(1)
  })
  serverProcess.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled rejection')
    serverProcess.exit(1)
  })

  logger.info({ envFile: file }, 'Starting server')

  const started = await startServer(config, logger)

  match(started)
    .with({ type: 'success' }, ({ data: server }) => {
      // Handled once: a second signal ends the process at once.
      const shutdown = (signal: NodeJS.Signals): void => {
        logger.info({ signal }, 'Shutting down')
        void server.stop().then(() => {
          logger.info('Server stopped')
          serverProcess.exit(0)
        })
      }
      serverProcess.once('SIGTERM', shutdown)
      serverProcess.once('SIGINT', shutdown)
    })
    .with(
      { type: 'error', error: { type: 'databaseUnreachable' } },
      ({ error }) => {
        logger.fatal(
          { error: error.error },
          'Cannot start: the database is unreachable',
        )
        serverProcess.exit(1)
      },
    )
    .with({ type: 'error', error: { type: 'listenFailed' } }, ({ error }) => {
      logger.fatal({ err: error.error }, 'Cannot start: cannot listen')
      serverProcess.exit(1)
    })
    .exhaustive()
}
