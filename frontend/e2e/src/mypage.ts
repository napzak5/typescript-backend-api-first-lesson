import type { Locator, Page } from '@playwright/test'
import { part } from './bookings'

/*
 * What the tests of the page of a customer and of the forms it leads to
 * share: the locators of what those screens show.
 */

/** The value that stands beside a name, in a part of the page. */
export const value = (page: Page, of: string, term: string): Locator =>
  part(page, of)
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${term}$`) })
    .locator('xpath=following-sibling::dd')

export const text = (page: Page, name: string): Locator =>
  page.getByRole('textbox', { name, exact: true })

export const box = (page: Page, name: string): Locator =>
  page.getByRole('checkbox', { name, exact: true })

export const saveButton = (page: Page): Locator =>
  page.getByRole('button', { name: '変更を保存する' })
