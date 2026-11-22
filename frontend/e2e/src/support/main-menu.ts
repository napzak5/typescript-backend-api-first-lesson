import type { Locator, Page } from '@playwright/test'

/**
 * The name of the links of the header of an application. From the width of
 * a tablet they are a row under the header; on a phone they are in the
 * menu, a sheet that the button at the end of the header opens. The row,
 * the menu and the button have this name.
 */
export const MAIN_MENU = 'メインメニュー'

/** The links of the header, in their row: from the width of a tablet */
export const mainMenu = (page: Page): Locator =>
  page.getByRole('navigation', { name: MAIN_MENU })

/** A link of the header, in its row */
export const mainMenuLink = (page: Page, name: string): Locator =>
  mainMenu(page).getByRole('link', { name, exact: true })

/** The button that opens the menu, at the end of the header of a phone */
export const menuButton = (page: Page): Locator =>
  page.getByRole('banner').getByRole('button', { name: MAIN_MENU })

/** The menu of a phone, while it is open */
export const menu = (page: Page): Locator =>
  page.getByRole('dialog', { name: MAIN_MENU })

/** Opens the menu of a phone, and presses one of its links */
export const pressInTheMenu = async (
  page: Page,
  name: string,
): Promise<void> => {
  await menuButton(page).click()
  await menu(page).getByRole('link', { name, exact: true }).click()
}
