import AxeBuilder from '@axe-core/playwright'
import {
  type AccessibilityViolation,
  summarizeViolations,
  WCAG_2_2_AA,
} from '@beauty-salon-frontend/testing/accessibility'
import { expect, type Page } from '@playwright/test'

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
 * What a layout must not do, measured on the page as the browser laid it out:
 * `overflow` is by how many pixels the page is wider than the window,
 * `spilling` names the elements that hold something wider than they are and
 * neither scroll it nor cut it off (a line that does not wrap sticks out of
 * its card long before it makes the page wider), and `flex` is how many
 * elements are laid out with flex (the layout of this project is CSS Grid).
 */
const measureLayout = (
  page: Page,
): Promise<{ overflow: number; spilling: string[]; flex: number }> =>
  page.evaluate(() => {
    const elements = [...document.querySelectorAll('body *')]

    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      spilling: elements
        .filter(
          (element) =>
            // An inline element has no width of its own, and a pixel is rounding
            element.clientWidth > 0 &&
            element.scrollWidth - element.clientWidth > 1 &&
            getComputedStyle(element).overflowX === 'visible',
        )
        .map(
          (element) =>
            `${element.localName}.${element.getAttribute('class') ?? ''}`,
        ),
      flex: elements.filter((element) =>
        getComputedStyle(element).display.includes('flex'),
      ).length,
    }
  })

/**
 * The page is accessible, nothing of it sticks out of the window or out of
 * the element it is in, and nothing is laid out with flex.
 */
export const expectSoundPage = async (page: Page): Promise<void> => {
  expect(await findAccessibilityViolations(page)).toEqual([])
  expect(await measureLayout(page)).toEqual({
    overflow: 0,
    spilling: [],
    flex: 0,
  })
}
