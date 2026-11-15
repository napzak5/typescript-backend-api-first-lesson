import type { RequestHandler } from 'express'

/**
 * For routes whose every response carries tokens or the data of one user:
 * none of them may be kept by a cache.
 */
export const neverStored: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}
