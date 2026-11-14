import type { IncomingMessage } from 'node:http'

/**
 * Which user each request was authenticated as, kept beside the request for
 * as long as the request lives. It is what lets the log line of a request
 * say who made it, so that a change to an account can be traced to the
 * administrator who made it.
 */
const signedInUsers = new WeakMap<IncomingMessage, string>()

export const noteSignedInUser = (
  req: IncomingMessage,
  userId: string,
): void => {
  signedInUsers.set(req, userId)
}

/** Undefined for a request that carried no access token that works. */
export const signedInUserOf = (req: IncomingMessage): string | undefined =>
  signedInUsers.get(req)
