/**
 * The session of the person who is signed in, as the browser keeps it: the
 * two tokens of the API and the ID of the user they belong to.
 */
export type StoredSession = {
  accessToken: string
  refreshToken: string
  userId: string
}

const STORAGE_KEY = 'beauty-salon:session'

type Listener = () => void

const listeners = new Set<Listener>()

const notify = (): void => {
  for (const listener of listeners) {
    listener()
  }
}

/** Another tab wrote or removed the session: the listeners of this tab hear of it too */
const onStorage = (event: StorageEvent): void => {
  if (event.key === STORAGE_KEY || event.key === null) {
    notify()
  }
}

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
 * What is stored, or null when the browser refuses access to its storage, as
 * it does for a visitor who lets no site keep data. That visitor has no
 * session, and is still served what needs none.
 */
const storedValue = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Where the session is kept: `localStorage`, so that it outlives a reload and
 * is the same in every tab of the application. See docs/authentication.md
 * for why it is kept there.
 */
export const sessionStore = {
  read(): StoredSession | null {
    return decode(storedValue())
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
    try {
      localStorage.setItem(STORAGE_KEY, encode(session))
    } catch {
      return false
    }
    notify()

    return true
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing is stored in a browser that refuses access to its storage
    }
    notify()
  },

  /**
   * Calls the listener whenever the session may have changed, in this tab or
   * in another one. Returns the function that ends the subscription.
   */
  subscribe(listener: Listener): () => void {
    if (listeners.size === 0) {
      window.addEventListener('storage', onStorage)
    }
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        window.removeEventListener('storage', onStorage)
      }
    }
  },
}
