/**
 * The address a link may go to: one of the web (`http`, `https`). Any other
 * text, such as a note written where an address would be, is `null`, and
 * is shown as text.
 */
export const webAddressOf = (url: string): string | null =>
  /^https?:\/\//i.test(url) ? url : null
