import { describe, expect, it } from 'vitest'
import { isWithinSubtree } from '../business-logic/service-category'

/**
 * A menu as the parent of each category:
 *
 *   cut ─┬─ ladies ─── bob ─── short-bob
 *        └─ mens
 *   color ── highlights
 *   spa
 */
const menu = new Map<string, string | null>([
  ['cut', null],
  ['ladies', 'cut'],
  ['mens', 'cut'],
  ['bob', 'ladies'],
  ['short-bob', 'bob'],
  ['color', null],
  ['highlights', 'color'],
  ['spa', null],
])

describe('isWithinSubtree', () => {
  it.each([
    ['a top-level category', 'cut'],
    ['a category in the middle', 'ladies'],
    ['a category without subcategories', 'short-bob'],
    ['the only category of its branch', 'spa'],
  ])('finds %s within its own subtree', (_case, category) => {
    expect(isWithinSubtree(menu, category, category)).toBe(true)
  })

  it.each([
    ['a subcategory', 'cut', 'ladies'],
    ['another subcategory of the same category', 'cut', 'mens'],
    ['a subcategory of a subcategory', 'cut', 'bob'],
    ['a category three levels below', 'cut', 'short-bob'],
    ['a category two levels below one in the middle', 'ladies', 'short-bob'],
  ])('finds %s within the subtree', (_case, root, candidate) => {
    expect(isWithinSubtree(menu, root, candidate)).toBe(true)
  })

  it.each([
    ['the parent', 'ladies', 'cut'],
    ['an ancestor further up', 'short-bob', 'cut'],
    ['a sibling', 'ladies', 'mens'],
    ['a subcategory of a sibling', 'mens', 'bob'],
    ['a top-level category of another branch', 'cut', 'color'],
    ['a subcategory of another branch', 'cut', 'highlights'],
    ['another category without subcategories', 'short-bob', 'highlights'],
    ['a top-level category, seen from another one', 'spa', 'cut'],
  ])('does not find %s within the subtree', (_case, root, candidate) => {
    expect(isWithinSubtree(menu, root, candidate)).toBe(false)
  })

  it('does not find a category that the hierarchy does not have', () => {
    expect(isWithinSubtree(menu, 'cut', 'perm')).toBe(false)
  })

  it('does not find a category whose parent the hierarchy does not have', () => {
    const orphan = new Map<string, string | null>([
      ['cut', null],
      ['bob', 'ladies'],
    ])

    expect(isWithinSubtree(orphan, 'cut', 'bob')).toBe(false)
  })

  it('does not find another category in an empty hierarchy', () => {
    const empty = new Map<string, string | null>()

    expect(isWithinSubtree(empty, 'cut', 'color')).toBe(false)
  })

  it('follows a hierarchy of any depth', () => {
    const depth = 5000
    const chain = new Map<string, string | null>(
      Array.from({ length: depth }, (_, level) => [
        `level-${level}`,
        level === 0 ? null : `level-${level - 1}`,
      ]),
    )
    const deepest = `level-${depth - 1}`

    expect(isWithinSubtree(chain, 'level-0', deepest)).toBe(true)
    expect(isWithinSubtree(chain, 'level-1', deepest)).toBe(true)
    expect(isWithinSubtree(chain, deepest, 'level-0')).toBe(false)
    expect(isWithinSubtree(chain, 'elsewhere', deepest)).toBe(false)
  })

  describe('in a hierarchy that already contains a loop', () => {
    /** `bob` and `ladies` are each other's parent; `perm` is its own. */
    const looped = new Map<string, string | null>([
      ['cut', null],
      ['mens', 'cut'],
      ['ladies', 'bob'],
      ['bob', 'ladies'],
      ['short-bob', 'bob'],
      ['perm', 'perm'],
    ])

    it.each([
      ['a category of the loop', 'cut', 'bob'],
      ['a category below the loop', 'cut', 'short-bob'],
      ['a category that is its own parent', 'cut', 'perm'],
      [
        'a category of the loop, seen from one that is not stored',
        'spa',
        'ladies',
      ],
    ])(
      'ends, and treats %s as within the subtree so that it is refused as a parent',
      (_case, root, candidate) => {
        expect(isWithinSubtree(looped, root, candidate)).toBe(true)
      },
    )

    it('finds the categories of a loop within the subtree of each other', () => {
      expect(isWithinSubtree(looped, 'bob', 'ladies')).toBe(true)
      expect(isWithinSubtree(looped, 'ladies', 'bob')).toBe(true)
      expect(isWithinSubtree(looped, 'ladies', 'short-bob')).toBe(true)
    })

    it('still answers for the categories that the loop does not touch', () => {
      expect(isWithinSubtree(looped, 'cut', 'mens')).toBe(true)
      expect(isWithinSubtree(looped, 'mens', 'cut')).toBe(false)
      expect(isWithinSubtree(looped, 'bob', 'mens')).toBe(false)
    })
  })
})
