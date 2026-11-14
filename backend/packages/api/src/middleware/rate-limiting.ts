import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { AppSettings } from '../settings'
import { sendProblem } from '../shared/responses'

/**
 * Limits how many requests one client address makes per window. The limit
 * and what is left of it are in the `RateLimit` response headers.
 *
 * Counts are kept in the memory of this process, so each instance of the
 * server enforces the limit on its own.
 */
export const rateLimiting = ({
  windowMs,
  maxRequests,
}: AppSettings['rateLimit']): RequestHandler =>
  rateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      sendProblem(req, res, { type: 'rateLimited' })
    },
  })
