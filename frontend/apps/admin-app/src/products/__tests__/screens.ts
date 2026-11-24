import { heading } from '@beauty-salon-frontend/testing/screens'
import { screen } from '@testing-library/react'

/*
 * What the screen tests of the products wait for, and what their screens
 * say alike.
 */

/** Waits for the ledger: its heading comes first, the table once the products were read. */
export const openedLedger = async (caption = '商品台帳'): Promise<void> => {
  await heading('商品台帳')
  await screen.findByRole('table', { name: caption })
}

/** Waits for a product: its heading comes first, the record once the product was read. */
export const openedProduct = async (): Promise<void> => {
  await heading('商品の内容')
  await screen.findByRole('region', { name: '価格' })
}

/** Waits for a form: its heading comes first, the form once what it needs was read. */
export const openedForm = async (title: string): Promise<void> => {
  await heading(title)
  await screen.findByRole('textbox', { name: /^商品コード/ })
}

/** What a screen says when the products of the salon, or a product, could not be read */
export const PRODUCTS_UNREAD =
  '商品を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What a screen of the products tells an account that does not work at the salon, or no longer does */
export const NOT_THEIRS =
  'このサロンの商品は、見られません。商品を見られるのは、そのサロンのスタッフと、管理者です。'
