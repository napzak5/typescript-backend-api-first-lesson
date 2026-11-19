import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** What the API puts behind the address of a mailed link: `#token=<token>` */
const FRAGMENT = /^#token=([\w-]{1,255})$/

/**
 * The token in the fragment of an address, or `null` when there is none. A
 * token is in the fragment, and not in the path or the query, because a
 * browser sends the fragment to no server.
 */
export const tokenIn = (hash: string): string | null =>
  FRAGMENT.exec(hash)?.[1] ?? null

/**
 * The token of the mailed link that opened this screen, or `null` when the
 * screen was not opened by one. The token is read once and then taken out of
 * the address: it stays neither in the address bar nor in the history, and
 * nobody who looks at the screen can copy it. A page that is loaded again
 * has none; the link in the mail still has it.
 */
export const useMailedToken = (): string | null => {
  const { hash, pathname, search } = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => tokenIn(hash))

  useEffect(() => {
    if (hash !== '') {
      void navigate({ pathname, search }, { replace: true })
    }
  }, [hash, pathname, search, navigate])

  return token
}
