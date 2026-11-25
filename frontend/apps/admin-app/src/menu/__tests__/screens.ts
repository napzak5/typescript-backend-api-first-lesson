import { heading } from '@beauty-salon-frontend/testing/screens'
import { screen, within } from '@testing-library/react'

/*
 * What the screen tests of the menu wait for, and what their screens say
 * alike.
 */

/** Waits for the menu: its heading comes first, the services once the menu was read. */
export const openedMenu = async (): Promise<void> => {
  await heading('メニュー')
  await screen.findByRole('region', { name: 'サービス' })
}

/** Waits for a form of a category: its heading comes first, the form once the categories were read. */
export const openedCategoryForm = async (title: string): Promise<void> => {
  await heading(title)
  await screen.findByRole('textbox', { name: /名前/ })
}

/** Waits for a form of a service: its heading comes first, the form once the menu was read. */
export const openedServiceForm = async (title: string): Promise<void> => {
  await heading(title)
  await screen.findByRole('group', { name: 'サービス' })
}

/** Waits for the form that changes several services: its heading comes first, the form once the menu was read. */
export const openedServicesForm = async (): Promise<void> => {
  await heading('サービスをまとめて変える')
  await screen.findByRole('group', { name: '変えるサービス' })
}

/** A text of the part 「サービス」 of the form of a service */
export const serviceText = (name: string): HTMLElement =>
  within(screen.getByRole('group', { name: 'サービス' })).getByRole('textbox', {
    name,
  })

/** A control of a part of the form of a service */
export const serviceField = (
  part: string,
  role: 'textbox' | 'combobox',
  name: string,
): HTMLElement =>
  within(screen.getByRole('group', { name: part })).getByRole(role, { name })

/** What a screen of the menu says when the menu, its categories or its services could not be read */
export const MENU_UNREAD =
  'メニューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What a screen says when a category, or the categories of the salon, could not be read */
export const CATEGORIES_UNREAD =
  'カテゴリーを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What a screen says when a service could not be read */
export const SERVICE_UNREAD =
  'サービスを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What a form of the menu tells an account whose role does not change a menu */
export const NOT_KEEPER =
  'このアカウントでは、メニューを変えられません。メニューを変えられるのは、サロンのオーナーとマネージャーと、管理者です。'

/** What a form of the menu says when the API refused the account the menu of the salon */
export const NOT_THEIRS =
  'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。'
