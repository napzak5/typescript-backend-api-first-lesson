/** The start of the addresses of the screens of one salon. */
const SALON_PATH = /^\/salons\/([^/]+)/

/**
 * The salon whose screens an address is of, if it is one of them: the
 * links of the header are those of that salon.
 */
export const salonIdIn = (pathname: string): string | undefined =>
  SALON_PATH.exec(pathname)?.[1]
