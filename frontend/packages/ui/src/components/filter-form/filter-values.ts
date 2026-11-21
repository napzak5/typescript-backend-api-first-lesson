import { useState } from 'react'

/** What the controls of a filter hold, under their names */
export type FilterValues = Record<string, string>

/**
 * The values the controls of a filter show, and how a control changes one.
 *
 * A filter mirrors the address. Its controls show the conditions of the
 * list, as `valuesOf` makes them from the address, and what was typed or
 * chosen since. When the address changes under it (the user went back, or
 * a link took the conditions away), the controls show the conditions of
 * the new address, and what was typed is forgotten. `shownKey` tells one
 * address from another: the query that the conditions make.
 */
export const useFilterValues = <Values extends FilterValues>(
  shownKey: string,
  valuesOf: () => Values,
): readonly [Values, (name: keyof Values, value: string) => void] => {
  const [shown, setShown] = useState(() => ({ shownKey, values: valuesOf() }))
  const current =
    shown.shownKey === shownKey ? shown : { shownKey, values: valuesOf() }
  if (current !== shown) {
    // React draws again at once, before the browser paints
    setShown(current)
  }

  const hold = (name: keyof Values, value: string): void => {
    setShown({ shownKey, values: { ...current.values, [name]: value } })
  }

  return [current.values, hold]
}

/**
 * How many of the named conditions narrow the list: those whose value is
 * not empty. The button of the sheet of `FilterForm` says it
 */
export const countNarrowing = <Values extends FilterValues>(
  values: Values,
  names: readonly (keyof Values)[],
): number => names.filter((name) => values[name] !== '').length
