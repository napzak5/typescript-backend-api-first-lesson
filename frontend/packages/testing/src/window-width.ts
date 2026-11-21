/**
 * jsdom lays nothing out, and has no `matchMedia`. A component that draws
 * something else on a narrow screen asks it how wide the window is (the
 * header of `AppShell`, below 40rem). This gives jsdom a window of the
 * width a test chooses: as wide as jsdom says its window is (1024 pixels)
 * unless the test says otherwise, and that again in the next test.
 *
 * It answers the queries the components ask, `(min-width: 40rem)`: a width
 * at least so many rem of 16 pixels. Any other query does not match.
 */

const PIXELS_PER_REM = 16

const MIN_WIDTH = /^\(min-width: (\d+(?:\.\d+)?)rem\)$/

const matchesWidth = (query: string, width: number): boolean => {
  const rem = MIN_WIDTH.exec(query)?.[1]

  return rem !== undefined && width >= Number(rem) * PIXELS_PER_REM
}

let windowWidth = 0
let widthAtStart = 0

/** What `matchMedia` answers: whether the window matches, and the `change` when that does */
class WidthQuery extends EventTarget {
  readonly media: string

  constructor(media: string) {
    super()
    this.media = media
  }

  get matches(): boolean {
    return matchesWidth(this.media, windowWidth)
  }
}

/** One answer for each query, which hears every change of the width */
const queries = new Map<string, WidthQuery>()

const queryOf = (media: string): WidthQuery => {
  const known = queries.get(media)
  if (known !== undefined) {
    return known
  }
  const query = new WidthQuery(media)
  queries.set(media, query)

  return query
}

export const installWindowWidth = (): void => {
  widthAtStart = window.innerWidth
  windowWidth = widthAtStart
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: queryOf,
  })
}

/**
 * Makes the window of the test so many pixels wide, as a phone is (320 or
 * 390): the queries whose answer changes tell their listeners, as those of
 * a browser do when the window is turned. Call it before the component is
 * drawn, to draw it at that width.
 */
export const setWindowWidth = (width: number): void => {
  const changed = [...queries.values()].filter(
    (query) => matchesWidth(query.media, width) !== query.matches,
  )
  windowWidth = width
  for (const query of changed) {
    query.dispatchEvent(new Event('change'))
  }
}

/** Gives the next test the window every test starts with */
export const resetWindowWidth = (): void => {
  setWindowWidth(widthAtStart)
}
