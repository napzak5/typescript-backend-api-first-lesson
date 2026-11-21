import AxeBuilder from '@axe-core/playwright'
import {
  type AccessibilityViolation,
  summarizeViolations,
  WCAG_2_2_AA,
} from '@beauty-salon-frontend/testing/accessibility'
import { expect, type Locator, type Page } from '@playwright/test'

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
 * `overflow` is by how many pixels the page is wider than the window has
 * room for it (a scrollbar that takes room is not part of that),
 * `spilling` names the elements that hold something wider than they are and
 * neither scroll it nor cut it off (a line that does not wrap sticks out of
 * its card long before it makes the page wider), and `flex` is how many
 * elements are laid out with flex (the layout of this project is CSS Grid).
 *
 * The page is measured in its typefaces: until they have come, the text is
 * drawn in those of the system, whose letters are of other widths.
 */
const measureLayout = (
  page: Page,
): Promise<{ overflow: number; spilling: string[]; flex: number }> =>
  page.evaluate(async () => {
    await document.fonts.ready
    const elements = [...document.querySelectorAll('body *')]

    return {
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
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

/** The layout of a page that does none of it */
const SOUND_LAYOUT = { overflow: 0, spilling: [], flex: 0 }

/**
 * The page is accessible, nothing of it sticks out of the window or out of
 * the element it is in, and nothing is laid out with flex.
 */
export const expectSoundPage = async (page: Page): Promise<void> => {
  expect(await findAccessibilityViolations(page)).toEqual([])
  expect(await measureLayout(page)).toEqual(SOUND_LAYOUT)
}

/**
 * The layout alone, for a test that goes through many screens: a screen
 * that fails is named in the report, and the test goes on to the next.
 */
export const expectSoundLayout = async (
  page: Page,
  screen: string,
): Promise<void> => {
  expect.soft(await measureLayout(page), screen).toEqual(SOUND_LAYOUT)
}

/** Where an element is in the window, in whole pixels */
export type Edges = { left: number; top: number; right: number; bottom: number }

/**
 * The edges of an element in the window: for what a stylesheet alone
 * decides, where things stand and how wide they are. Like the layout, they
 * are measured once the typefaces of the page have come.
 */
export const edgesOf = (element: Locator): Promise<Edges> =>
  element.evaluate(async (shown) => {
    await document.fonts.ready
    const { left, top, right, bottom } = shown.getBoundingClientRect()

    return {
      left: Math.round(left),
      top: Math.round(top),
      right: Math.round(right),
      bottom: Math.round(bottom),
    }
  })

/**
 * How far a table scrolls sideways inside its frame, in pixels: 0 when it
 * fits. A table that fits has a frame that is no region, so it is found by
 * its own name.
 */
export const sidewaysScrollOf = (table: Locator): Promise<number> =>
  table.evaluate((shown) => {
    const frame = shown.parentElement

    return frame === null ? Number.NaN : frame.scrollWidth - frame.clientWidth
  })

/** Whether each corner of the window, a pixel inside it, is under the open dialog or its overlay */
export const cornersUnderTheDialog = (page: Page): Promise<boolean[]> =>
  page.evaluate(() => {
    const right = window.innerWidth - 2
    const bottom = window.innerHeight - 2

    return [
      { x: 1, y: 1 },
      { x: right, y: 1 },
      { x: 1, y: bottom },
      { x: right, y: bottom },
    ].map(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest('dialog[open]') instanceof
        HTMLDialogElement,
    )
  })
