import {
  refuse,
  salonIdOf,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { heading } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import {
  staffMovedMeanwhile,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import {
  displayNameOf,
  storedRowsOf,
} from '../../inventory/__tests__/arrangements'
import {
  orderChangeHrefOf,
  orderReceiptHrefOf,
  purchaseOrderHrefOf,
} from '../../navigation'
import { orderIdOf, storedOrderOf } from '../__tests__/arrangements'
import {
  NOT_THEIRS,
  ORDER_UNREAD,
  openOrderAs,
  openReceiptAs,
  REASON,
  RECEIVE,
  SAVE,
} from '../__tests__/screens'

/*
 * A purchase order, its status, the form of its change and its receipt
 * when a request fails, and when the account changes between two
 * requests of the screen. The failures are arranged in the database; what goes well is
 * in `purchase-order-steps.integration.test.tsx` and
 * `purchase-order-receipt.integration.test.tsx`.
 */

/** The screens that read one order: the order, the form of its change, and its receipt */
const SCREENS: [
  string,
  string,
  (salonId: string, orderId: string) => string,
  () => Promise<unknown>,
][] = [
  [
    'the order',
    'PO-SEED-0001',
    purchaseOrderHrefOf,
    () => screen.findByRole('region', { name: '状態' }),
  ],
  [
    'the form of a change',
    'PO-SEED-0001',
    orderChangeHrefOf,
    () => screen.findByLabelText('納品予定日'),
  ],
  [
    'the receipt',
    'PO-SEED-0002',
    orderReceiptHrefOf,
    () => screen.findByRole('group', { name: '届いた数量' }),
  ],
]

describe('a purchase order, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(SCREENS)(
    'should say that %s could not be read, and show it when asked again',
    async (_, orderNumber, hrefOf, opened) => {
      // Arrange
      const user = userEvent.setup()
      const orderId = await orderIdOf(orderNumber)
      const readable = await unreadable('purchase_orders', 'createdAt', orderId)
      await openAs(hrefOf(await salonIdOf(TOKYO), orderId), STYLIST)
      expect(await screen.findByText(ORDER_UNREAD)).toBeVisible()
      await readable()

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await opened()
    },
  )

  it.each(SCREENS)(
    'should say that %s is not shown to an account that belongs to the salon no more',
    async (_, orderNumber, hrefOf) => {
      // Arrange
      const stylist = await displayNameOf(STYLIST)
      const orderId = await orderIdOf(orderNumber)
      whenAskedFor(`GET /purchase-orders/${orderId}`, () =>
        staffRemovedMeanwhile(stylist),
      )

      // Act
      await openAs(hrefOf(await salonIdOf(TOKYO), orderId), STYLIST)

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('region', { name: '状態' })).toBeNull()
      expect(screen.queryByRole('textbox')).toBeNull()
    },
  )

  it('should read the order anew when the account belongs to the salon no more as it moves it on, and say that it is not shown', async () => {
    // Arrange
    const user = userEvent.setup()
    await openOrderAs('PO-SEED-0002', STYLIST)
    await staffRemovedMeanwhile(await displayNameOf(STYLIST))

    // Act
    await user.click(screen.getByRole('button', { name: '出荷済みにする' }))

    // Assert
    expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
    expect((await storedOrderOf('PO-SEED-0002')).status).toBe('ordered')
  })

  it('should say on the page that the order could not be approved, and keep its status', async () => {
    // Arrange
    const user = userEvent.setup()
    await openOrderAs('PO-SEED-0001', MANAGER)
    await refuse('update', 'purchase_orders')

    // Act
    await user.click(screen.getByRole('button', { name: '承認する' }))

    // Assert
    expect(
      await screen.findByText(
        '承認できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: '承認する' })).toBeVisible()
    expect((await storedOrderOf('PO-SEED-0001')).status).toBe('pending')
  })

  it('should say in the dialog that the order could not be cancelled, and keep it open to try again', async () => {
    // Arrange
    const user = userEvent.setup()
    await openOrderAs('PO-SEED-0002', OWNER)
    await user.click(screen.getByRole('button', { name: '発注を取り消す' }))
    const dialog = screen.getByRole('dialog')
    await user.type(
      within(dialog).getByRole('textbox', { name: REASON }),
      '仕入先の在庫切れ。',
    )
    await refuse('update', 'purchase_orders')

    // Act
    await user.click(within(dialog).getByRole('button', { name: '取り消す' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '発注を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect((await storedOrderOf('PO-SEED-0002')).status).toBe('ordered')
  })

  it('should say what is wrong with the day of the delivery before sending the change, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      orderChangeHrefOf(
        await salonIdOf(TOKYO),
        await orderIdOf('PO-SEED-0001'),
      ),
      STYLIST,
    )
    const day = await screen.findByLabelText('納品予定日')
    await user.type(day, '1800-01-01')

    // Act
    await user.click(screen.getByRole('button', { name: SAVE }))

    // Assert
    expect(day).toBeInvalid()
    expect(day).toHaveFocus()
    expect((await storedOrderOf('PO-SEED-0001')).expectedDelivery).toBeNull()
  })

  it('should say above the form that the order could not be changed, and keep what was entered', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      orderChangeHrefOf(
        await salonIdOf(TOKYO),
        await orderIdOf('PO-SEED-0002'),
      ),
      STYLIST,
    )
    await user.type(
      await screen.findByRole('textbox', { name: 'メモ' }),
      '急ぎ',
    )
    await refuse('update', 'purchase_orders')

    // Act
    await user.click(screen.getByRole('button', { name: SAVE }))

    // Assert
    expect(
      await screen.findByText(
        '発注を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await heading('発注を直す')
    expect(screen.getByRole('textbox', { name: 'メモ' })).toHaveValue('急ぎ')
    expect((await storedOrderOf('PO-SEED-0002')).notes).toBeNull()
  })

  it('should read the order anew when the account moved to another salon as the goods were recorded, and say that it is not found', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedRowsOf(TOKYO)
    await openReceiptAs('PO-SEED-0002', STYLIST)
    await staffMovedMeanwhile(await displayNameOf(STYLIST), OSAKA)

    // Act
    await user.click(screen.getByRole('button', { name: RECEIVE }))

    // Assert
    await heading('発注が見つかりません')
    expect(await storedRowsOf(TOKYO)).toEqual(before)
  })

  it('should say above the form that the goods could not be recorded, and keep what was entered', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedRowsOf(TOKYO)
    await openReceiptAs('PO-SEED-0002', STYLIST)
    await refuse('insert', 'inventory_transactions')

    // Act
    await user.click(screen.getByRole('button', { name: RECEIVE }))

    // Assert
    expect(
      await screen.findByText(
        '入荷を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    expect(await storedRowsOf(TOKYO)).toEqual(before)
    expect((await storedOrderOf('PO-SEED-0002')).status).toBe('ordered')
  })
})
