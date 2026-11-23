import { keptValue } from '../storage/kept-value'

/**
 * The session of the person who is signed in, as the browser keeps it: the
 * two tokens of the API and the ID of the user they belong to.
 */
export type StoredSession = {
  accessToken: string
  refreshToken: string
  userId: string
}

const kept = keptValue('beauty-salon:session')

/**
 * The session is written as one value, so that another tab never reads the
 * access token of one issue with the refresh token of another. Its form is
 * that of a query string, which is read back without a parser that throws.
 */
const encode = (session: StoredSession): string =>
  new URLSearchParams(session).toString()

const decode = (stored: string | null): StoredSession | null => {
  const values = new URLSearchParams(stored ?? '')
  const accessToken = values.get('accessToken')
  const refreshToken = values.get('refreshToken')
  const userId = values.get('userId')

  // A value that is not a whole session is no session
  return accessToken && refreshToken && userId
    ? { accessToken, refreshToken, userId }
    : null
}

/**
 * Where the session is kept: `localStorage`, so that it outlives a reload and
 * is the same in every tab of the application. See docs/authentication.md
 * for why it is kept there.
 */
export const sessionStore = {
  /**
   * The session, or null when none is stored, also in a browser that
   * refuses access to its storage, as it does for a visitor who lets no
   * site keep data. That visitor has no session, and is still served what
   * needs none
   */
  read(): StoredSession | null {
    return decode(kept.read())
  },

  /** The user the session belongs to: a value that stays the same while the tokens are renewed */
  userId(): string | null {
    return sessionStore.read()?.userId ?? null
  },

  /**
   * Keeps the session. Answers whether it is kept: a browser that lets the
   * site store nothing refuses, and then nobody is signed in.
   */
  write(session: StoredSession): boolean {
    return kept.write(encode(session))
  },

  clear: kept.clear,

  /**
   * Calls the listener whenever the session may have changed, in this tab or
   * in another one. Returns the function that ends the subscription.
   */
  subscribe: kept.subscribe,
}
