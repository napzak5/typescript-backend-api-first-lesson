import { salonIdOf } from '@beauty-salon-frontend/testing/api'
import { heading } from '@beauty-salon-frontend/testing/screens'
import { TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import { openAs } from '../../__tests__/screens'
import { orderReceiptHrefOf, purchaseOrderHrefOf } from '../../navigation'
import { orderIdOf } from './arrangements'

/*
 * What the screen tests of the purchase orders wait for and look for, and
 * what their screens say alike.
 */

export const ORDERS = '発注'

export const ENTRY = '発注を作る'

/** Waits for the orders: the heading comes first, the table once the orders were read. */
export const openedOrders = async (caption = ORDERS): Promise<void> => {
  await heading(ORDERS)
  await screen.findByRole('table', { name: caption })
}

/** The group of the controls of the row of a product, named by the product and the lot the seed drew */
const rowOf = (product: string): HTMLElement =>
  screen.getByRole('group', { name: new RegExp(`^${product}（`) })

/** A control of the row of a product */
export const ofRow = (product: string, label: string): HTMLElement =>
  within(rowOf(product)).getByRole('textbox', { name: label })

/** Waits for the form of a new order: its heading comes first, the rows once they were read, the powder first. */
export const openedEntry = async (): Promise<void> => {
  await heading(ENTRY)
  await screen.findByRole('group', {
    name: /^Lightening Powder 500g（/,
  })
}

/** The address of an order of the salon in Tokyo, by its number */
export const orderAt = async (orderNumber: string): Promise<string> =>
  purchaseOrderHrefOf(await salonIdOf(TOKYO), await orderIdOf(orderNumber))

/** Opens an order, and waits for its status. */
export const openOrderAs = async (
  orderNumber: string,
  email: string,
): Promise<void> => {
  await openAs(await orderAt(orderNumber), email)
  await heading(`発注 ${orderNumber}`)
}

export const REASON = '取り消す理由'

export const SAVE = '変更を保存する'

/** The address of the receipt of an order of the salon in Tokyo, by its number */
export const receiptAt = async (orderNumber: string): Promise<string> =>
  orderReceiptHrefOf(await salonIdOf(TOKYO), await orderIdOf(orderNumber))

/** Opens the receipt of an order, and waits for its form. */
export const openReceiptAs = async (
  orderNumber: string,
  email: string,
): Promise<void> => {
  await openAs(await receiptAt(orderNumber), email)
  await screen.findByRole('group', { name: '届いた数量' })
}

export const RECEIVE = '入荷を記録する'

/** What a screen of one order says when the order could not be read */
export const ORDER_UNREAD =
  '発注を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'

/** What a screen of the orders tells an account that does not work at the salon, or no longer does */
export const NOT_THEIRS =
  'このサロンの発注は、見られません。発注を見られるのは、そのサロンのスタッフと、管理者です。'
