/** Where a visitor signs in: the screens of this application are for everybody unless they say otherwise */
export const SIGN_IN_PATH = '/sign-in'

/** The parameter of the address that names the screen to go on to */
const FROM = 'from'

/**
 * A path of this application: segments of letters, digits, hyphens and
 * underscores. Nothing else is taken, so nothing that a browser would read
 * as the address of another site (`//`, a backslash, a character it drops).
 */
const PATH = /^\/(?:[\w-]+\/)*[\w-]*$/

/**
 * The address of the sign-in screen for somebody who reads a public page
 * and is to come back to it: the page offers more to whoever is signed in.
 */
export const signInHrefFrom = (pathname: string): string =>
  `${SIGN_IN_PATH}?${new URLSearchParams({ [FROM]: pathname }).toString()}`

/**
 * Where somebody goes on after signing in: the screen the address names,
 * or the start. An address is also typed by hand and passed on by others,
 * so what is no path of this application is not followed.
 */
export const pathAfterSignIn = (query: URLSearchParams): string => {
  const from = query.get(FROM)

  return from !== null && PATH.test(from) ? from : '/'
}
