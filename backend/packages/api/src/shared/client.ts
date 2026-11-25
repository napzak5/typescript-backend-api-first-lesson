import type { ClientInfo } from '@beauty-salon-backend/domain'
import type { Request } from 'express'

/**
 * Where a request came from: the address of the client, as the proxies the
 * server trusts tell it (`trust proxy`), and its user agent. A request
 * without the header names no user agent.
 *
 * Node knows no address of a connection that has none (a Unix socket), or
 * that closed before anything read it. The server listens on TCP, and the
 * rate limit reads the address of every request while its connection is
 * open, so a handler always has one.
 */
export const clientOf = (req: Pick<Request, 'ip' | 'headers'>): ClientInfo => ({
  ipAddress: req.ip ?? null,
  userAgent: req.headers['user-agent'] ?? null,
})
