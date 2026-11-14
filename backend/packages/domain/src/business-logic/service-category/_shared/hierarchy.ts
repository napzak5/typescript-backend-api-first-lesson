/**
 * Whether `candidate` is `root` or lies below it, in a hierarchy given as
 * the parent of each category (null for a top-level one). A category must
 * not get such a parent: it would become its own ancestor.
 *
 * A walk that does not end within as many steps as there are categories has
 * met a loop that is stored already; that parent is refused too.
 */
export const isWithinSubtree = (
  parentOf: ReadonlyMap<string, string | null>,
  root: string,
  candidate: string,
): boolean => {
  let current: string | null = candidate
  for (let steps = 0; steps <= parentOf.size; steps += 1) {
    if (current === root) {
      return true
    }
    current = parentOf.get(current) ?? null
    if (current === null) {
      return false
    }
  }
  return true
}
