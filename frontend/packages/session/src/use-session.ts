import {
  getAuthCrudGetCurrentUserQueryKey,
  type ModelsUserResponse,
  useAuthCrudGetCurrentUser,
} from '@beauty-salon-frontend/api-client'
import { sessionStore } from '@beauty-salon-frontend/io'
import { useSyncExternalStore } from 'react'

/** Who uses the application now, as far as it is known. */
export type Session =
  /** A session is stored, and the API is being asked whose it is */
  | { type: 'loading' }
  | { type: 'signedOut' }
  | { type: 'signedIn'; user: ModelsUserResponse }
  /**
   * A session is stored, but the API could not say whose it is: it did not
   * answer, or answered with an error that says nothing about the session.
   * `retry` asks again.
   */
  | { type: 'unavailable'; retry: () => void }

/**
 * The session of the application.
 *
 * Whether somebody is signed in is read from the stored session, so it is
 * the same in every tab: signing out in one tab signs out all of them, and so
 * does the API when it no longer takes the tokens. Who is signed in is asked
 * from the API (`GET /api/v1/auth/me`) once for each user and page load,
 * whatever the number of components that use this hook: the answer does not
 * go stale, so a request that fails later never takes a screen away.
 */
export const useSession = (): Session => {
  const userId = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.userId,
  )
  const currentUser = useAuthCrudGetCurrentUser({
    query: {
      // One entry for each user: what was fetched for somebody else is never
      // shown. The key begins with the key of the operation, so invalidating
      // that one fetches the user again, while the screens stay
      queryKey: [...getAuthCrudGetCurrentUserQueryKey(), userId],
      enabled: userId !== null,
      staleTime: Number.POSITIVE_INFINITY,
    },
  })

  if (userId === null) {
    return { type: 'signedOut' }
  }
  if (currentUser.data?.status === 200) {
    return { type: 'signedIn', user: currentUser.data.data.data }
  }
  if (currentUser.isFetching) {
    return { type: 'loading' }
  }

  return { type: 'unavailable', retry: () => void currentUser.refetch() }
}
