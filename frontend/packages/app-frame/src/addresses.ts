/**
 * Whether an address is that of a screen, or of one below it. An address
 * that only begins with the same letters (`/bookingsx` for `/bookings`) is
 * not below: the links of a header mark the screen somebody is on with it.
 */
export const isAtOrBelow = (pathname: string, screen: string): boolean =>
  pathname === screen || pathname.startsWith(`${screen}/`)
