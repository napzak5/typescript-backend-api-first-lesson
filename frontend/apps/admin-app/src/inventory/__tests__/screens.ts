import { heading } from '@beauty-salon-frontend/testing/screens'
import { screen } from '@testing-library/react'

/*
 * What the screen tests of the stock share: how each screen is waited
 * for, and what the screens say alike.
 */

/** Waits for the stock: its heading comes first, the table once the rows and their products were read. */
export const openedStock = async (caption = '在庫'): Promise<void> => {
  await heading('在庫')
  await screen.findByRole('table', { name: caption })
}

/** Waits for a row: its heading comes first, the record once the row was read. */
export const openedRow = async (): Promise<void> => {
  await heading('在庫の行')
  await screen.findByRole('region', { name: '在庫' })
}

/** Waits for the form of a new row: its heading comes first, the form once the products were read. */
export const openedStockEntry = async (): Promise<void> => {
  await heading('在庫の行を足す')
  await screen.findByRole('combobox', { name: /^商品/ })
}

/** Waits for the form of a row: its heading comes first, the form once the row was read. */
export const openedChange = async (): Promise<void> => {
  await heading('在庫の行を直す')
  await screen.findByRole('textbox', { name: '保管場所' })
}

/** Waits for the history of a row: its heading comes first, the table once the movements were read. */
export const openedHistory = async (caption = '在庫の移動'): Promise<void> => {
  await heading('在庫の移動')
  await screen.findByRole('table', { name: caption })
}

/** Waits for the form of a movement: its heading comes first, the form once the row was read. */
export const openedMovementEntry = async (): Promise<void> => {
  await heading('在庫の移動を記録する')
  await screen.findByRole('radiogroup', { name: /^区分/ })
}

/** Waits for the form of a count: its heading comes first, the rows once they were read. */
export const openedCount = async (): Promise<void> => {
  await heading('棚卸し')
  await screen.findByRole('textbox', { name: /^Hair Color - Natural Brown/ })
}

/** Waits for the value: its heading comes first, the table once it was read. */
export const openedValue = async (): Promise<void> => {
  await heading('在庫評価額')
  await screen.findByRole('table', { name: 'カテゴリーごとの在庫評価額' })
}

/** The heading of the alerts, and the caption of the table of all of them */
export const ALERTS = '在庫のアラート'

/** Waits for the alerts: the heading comes first, how many there are and the table once each was read. */
export const openedAlerts = async (caption = ALERTS): Promise<void> => {
  await heading(ALERTS)
  await screen.findByText(/^今出ているアラート/)
  await screen.findByRole('table', { name: caption })
}

/** What a screen of the stock tells an account that does not work at the salon, or no longer does */
export const NOT_THEIRS =
  'このサロンの在庫は、見られません。在庫を見られるのは、そのサロンのスタッフと、管理者です。'
