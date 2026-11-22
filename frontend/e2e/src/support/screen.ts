import type { Locator, Page } from '@playwright/test'

/*
 * What the tests of every screen share: the parts of a screen, and how
 * somebody works a control who has the keyboard alone. The focus is moved
 * to the control first, as the Tab key would, and the key is pressed there.
 */

/** A part of a page: the region of its heading. */
export const part = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('region', { name })

/** Presses a link or a button as somebody does who works with the keyboard alone. */
export const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Chooses a radio button, or ticks a checkbox, with the keyboard. */
export const chooseWithTheKeyboard = async (
  control: Locator,
): Promise<void> => {
  await control.focus()
  await control.press('Space')
}

/** Writes into a control after moving the focus to it. */
export const writeInto = async (
  control: Locator,
  value: string,
): Promise<void> => {
  await control.focus()
  await control.fill(value)
}

/**
 * Types into a control a key at a time, after moving the focus to it: for a
 * control that answers every key.
 */
export const typeInto = async (
  control: Locator,
  value: string,
): Promise<void> => {
  await control.focus()
  await control.pressSequentially(value)
}
