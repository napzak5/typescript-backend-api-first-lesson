/** A new token and what is stored of it. */
export type IssuedToken = {
  token: string
  hash: string
}

/**
 * Makes opaque tokens: the two of a session, and the single-use ones that
 * are mailed to confirm an address or reset a password. Only the hash of a
 * token is stored, so that reading the database does not yield a usable
 * token.
 */
export interface ITokenIssuer {
  issue(): IssuedToken

  hashOf(token: string): string
}
