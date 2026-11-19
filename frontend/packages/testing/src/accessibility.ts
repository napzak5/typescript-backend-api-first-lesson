import axe from 'axe-core'

/**
 * WCAG 2.2, levels A and AA: the tags axe-core gives to the rules of each
 * version (2.0, 2.1, 2.2).
 */
const WCAG_2_2_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** One rule that is broken, and the elements that break it. */
export type AccessibilityViolation = {
  rule: string
  impact: string
  help: string
  elements: string[]
}

/**
 * Runs axe-core over `root` and returns what breaks WCAG 2.2 AA; an empty
 * array when nothing does, so a failure prints the rule and the elements:
 *
 *   expect(await findAccessibilityViolations()).toEqual([])
 *
 * The default root is the whole document, which includes what a component
 * renders outside its own element (a dialog, a menu).
 *
 * `color-contrast` is switched off: it reads the colours an element is
 * painted with, and jsdom paints nothing. The contrast of the colour tokens is
 * checked where they are defined (`theme/src/tokens.test.ts`), and the pages
 * are checked in a real browser by the end-to-end tests.
 */
export const findAccessibilityViolations = async (
  root: Element = document.body,
): Promise<AccessibilityViolation[]> => {
  const results = await axe.run(root, {
    runOnly: { type: 'tag', values: WCAG_2_2_AA },
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  })

  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact ?? 'unknown',
    help: violation.help,
    elements: violation.nodes.map((node) => node.html),
  }))
}
