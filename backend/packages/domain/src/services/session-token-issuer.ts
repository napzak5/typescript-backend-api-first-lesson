/** A new token and what is stored of it. */
export type IssuedToken = {
  token: string
  hash: string
}

/**
 * Makes the opaque tokens of a session. Only the hash of a token is stored,
 * so that reading the database does not yield a usable token.
 */
export interface ISessionTokenIssuer {
  issue(): IssuedToken

  hashOf(token: string): string
}
