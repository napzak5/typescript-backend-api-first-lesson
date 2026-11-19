import AxeBuilder from '@axe-core/playwright'
import {
  type AccessibilityViolation,
  summarizeViolations,
  WCAG_2_2_AA,
} from '@beauty-salon-frontend/testing/accessibility'
import type { Page } from '@playwright/test'

/**
 * What of the page breaks WCAG 2.2 AA; an empty array when nothing does, so
 * a failure prints the rule and the elements:
 *
 *   expect(await findAccessibilityViolations(page)).toEqual([])
 *
 * The rules are those of the component tests, with the one they have to
 * leave out: here the page is painted, so the contrast of what is on it is
 * measured.
 */
export const findAccessibilityViolations = async (
  page: Page,
): Promise<AccessibilityViolation[]> => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_2_2_AA).analyze()

  return summarizeViolations(results.violations)
}

/**
 * What a layout must not do, counted on the page as the browser laid it out:
 * `overflow` is by how many pixels the page is wider than the window, and
 * `flex` how many elements are laid out with flex (the layout of this
 * project is CSS Grid):
 *
 *   expect(await measureLayout(page)).toEqual({ overflow: 0, flex: 0 })
 */
export const measureLayout = (
  page: Page,
): Promise<{ overflow: number; flex: number }> =>
  page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    flex: [...document.querySelectorAll('*')].filter((element) =>
      getComputedStyle(element).display.includes('flex'),
    ).length,
  }))
