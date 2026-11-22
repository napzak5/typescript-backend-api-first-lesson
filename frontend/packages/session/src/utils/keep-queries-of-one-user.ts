import { sessionStore } from '@beauty-salon-frontend/io'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Keeps what was fetched for one user from the next: whenever the user of the
 * stored session changes (somebody signs out, in this tab or in another one,
 * or the API ends the session, or somebody else signs in), every query is
 * reset. A renewal of the tokens of the same user changes nothing.
 *
 * Called once, where the application creates its `QueryClient`. Returns the
 * function that ends it.
 */
export const keepQueriesOfOneUser = (
  queryClient: QueryClient,
): (() => void) => {
  let userId = sessionStore.userId()

  return sessionStore.subscribe(() => {
    const next = sessionStore.userId()
    if (next !== userId) {
      userId = next
      void queryClient.resetQueries()
    }
  })
}
