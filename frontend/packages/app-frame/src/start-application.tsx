import { keepQueriesOfOneUser } from '@beauty-salon-frontend/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { type ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

/** The element of `index.html` an application is drawn in. */
const ROOT_ID = 'root'

/**
 * Starts an application in the page: what `src/main.tsx` of every
 * application calls, with its `App`, after it imported the stylesheet of
 * the theme.
 *
 * - What was read is kept for five minutes before it is read anew, and for
 *   ten after the last screen that showed it; a read that failed is tried
 *   three times more, and coming back to the window reads nothing.
 * - What was read for one user is not shown to the next
 *   (`keepQueriesOfOneUser`).
 * - The addresses are those of the browser (`BrowserRouter`).
 * - The panel of TanStack Query is drawn by the dev server alone: the
 *   component draws nothing in a build.
 *
 * A page without the element `root` gets one at the end of its body: the
 * application starts wherever it is asked to.
 *
 * Returns the function that ends it.
 */
export const startApplication = (application: ReactNode): (() => void) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 3,
        refetchOnWindowFocus: false,
      },
    },
  })
  const stopKeeping = keepQueriesOfOneUser(queryClient)
  const root = createRoot(
    document.getElementById(ROOT_ID) ??
      document.body.appendChild(document.createElement('div')),
  )
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{application}</BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </StrictMode>,
  )

  return () => {
    stopKeeping()
    root.unmount()
  }
}
