import { createServer, type RequestListener, type Server } from 'node:http'
import { createApp } from '@beauty-salon-backend/api'
import type { AppConfig } from '@beauty-salon-backend/config'
import type { DomainError } from '@beauty-salon-backend/domain'
import {
  connectDatabase,
  type Logger,
  pingDatabase,
  S3FileStorage,
  SmtpMailer,
  TotpAuthenticator,
} from '@beauty-salon-backend/infrastructure'
import { Result } from '@beauty-salon-backend/utility'
import { match, P } from 'ts-pattern'

/**
 * How long requests in flight get to finish once the server stops. What is
 * still open after that is cut off, so that stopping always ends.
 */
const SHUTDOWN_GRACE_MS = 10_000

export type RunningServer = {
  /** The port the server listens on. */
  port: number
  /**
   * Stops accepting requests, lets the ones in flight finish, waits for the
   * mails they handed over and closes the database connections. Resolves
   * when nothing is left open.
   */
  stop(): Promise<void>
}

export type StartFailure =
  | { type: 'databaseUnreachable'; error: DomainError }
  | { type: 'listenFailed'; error: Error }

const listen = (
  app: RequestListener,
  { host, port }: AppConfig['server'],
): Promise<Result<Server, Error>> =>
  new Promise((resolve) => {
    const server = createServer(app)
    server.once('listening', () => resolve(Result.success(server)))
    server.once('error', (error) => resolve(Result.error(error)))
    server.listen(port, host)
  })

const portOf = (server: Server): number =>
  match(server.address())
    .with({ port: P.number }, ({ port }) => port)
    .otherwise(() => 0)

const close = (
  server: Server,
  logger: Logger,
  graceMs: number,
): Promise<void> =>
  new Promise((resolve) => {
    const cutOff = setTimeout(() => {
      logger.warn({ graceMs }, 'Closing connections that are still open')
      server.closeAllConnections()
    }, graceMs)

    // Refuses new connections and closes idle ones; requests in flight go on.
    server.close(() => {
      clearTimeout(cutOff)
      resolve()
    })
  })

/**
 * Starts the API server: checks that the database answers, then listens.
 * A server that cannot do its work does not start, so that a deployment
 * fails visibly instead of serving errors.
 */
export const startServer = async (
  config: AppConfig,
  logger: Logger,
  shutdownGraceMs: number = SHUTDOWN_GRACE_MS,
): Promise<Result<RunningServer, StartFailure>> => {
  const connection = connectDatabase(config.database)

  const closeDatabase = async (): Promise<void> => {
    const closed = await Result.fromPromise(connection.close())
    if (closed.type === 'error') {
      logger.error({ err: closed.error }, 'Failed to close the database')
    }
  }

  const reachable = await pingDatabase(connection.database)
  if (reachable.type === 'error') {
    await closeDatabase()
    return Result.error({
      type: 'databaseUnreachable',
      error: reachable.error,
    })
  }

  // Connects when the first mail goes out: a mail server that is down
  // does not keep the API from starting.
  const mailer = new SmtpMailer(config.mail, logger)
  // Connects when the first file is looked at: a storage that is down
  // does not keep the API from starting either.
  const fileStorage = new S3FileStorage(config.storage)

  const app = createApp({
    database: connection.database,
    logger,
    mailer,
    fileStorage,
    twoFactorAuthenticator: new TotpAuthenticator(
      config.twoFactor.encryptionKey,
    ),
    settings: {
      trustProxyHops: config.server.trustProxyHops,
      cors: config.cors,
      rateLimit: config.rateLimit,
      publicAppUrl: config.publicAppUrl,
    },
  })

  const listening = await listen(app, config.server)
  if (listening.type === 'error') {
    await mailer.close()
    fileStorage.close()
    await closeDatabase()
    return Result.error({ type: 'listenFailed', error: listening.error })
  }

  const server = listening.data

  return Result.success({
    port: portOf(server),
    stop: async () => {
      await close(server, logger, shutdownGraceMs)
      await mailer.close()
      fileStorage.close()
      await closeDatabase()
    },
  })
}
