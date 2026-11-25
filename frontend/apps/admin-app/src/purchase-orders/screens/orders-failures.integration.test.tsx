import {
  giveBack,
  refuse,
  salonIdOf,
  takeAway,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { readAgain, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { OWNER, STYLIST, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { staffRemovedMeanwhile } from '../../customers/__tests__/arrangements'
import { displayNameOf, rowIdOf } from '../../inventory/__tests__/arrangements'
import {
  purchaseOrderEntryHrefOf,
  purchaseOrdersHrefOf,
  reorderSuggestionsHrefOf,
  suggestedOrderHrefOf,
} from '../../navigation'
import { productIdOf } from '../../products/__tests__/arrangements'
import { PRODUCTS_UNREAD } from '../../products/__tests__/screens'
import {
  orderIdOf,
  padOrdersOf,
  storedOrdersOf,
} from '../__tests__/arrangements'
import {
  ENTRY,
  NOT_THEIRS,
  ORDERS,
  ofRow,
  openedEntry,
  openedOrders,
} from '../__tests__/screens'

/*
 * The purchase orders of a salon, the form of a new one and the
 * suggestions of what to order, when a request fails and when the
 * account changes between two requests of the screen. The failures are
 * arranged in the database; what goes well is in
 * `purchase-orders.integration.test.tsx` and
 * `purchase-order-receipt.integration.test.tsx`.
 */

/** What a form of a new order that starts with the suggestions of a supplier says above its rows */
const SUGGESTED = /の発注の提案の数量を/

describe('the purchase orders, a new one and the suggestions, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('the orders', () => {
    it('should say that the orders could not be read, and list them when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(
        'purchase_orders',
        'createdAt',
        await orderIdOf('PO-SEED-0001'),
      )
      await openAs(purchaseOrdersHrefOf(await salonIdOf(TOKYO)), OWNER)
      expect(
        await screen.findByText(
          '発注を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      await openedOrders()
      expect(rowsOf(ORDERS)).toHaveLength(2)
    })

    it('should say that the orders after a page could not be read, and read them when asked again', async () => {
      // Arrange: 21 orders, the oldest of which cannot be read but on a page of its own
      await padOrdersOf(TOKYO, 19)
      const readable = await unreadable(
        'purchase_orders',
        'createdAt',
        await orderIdOf('PO-PAD-19'),
      )
      const user = userEvent.setup()
      await openAs(purchaseOrdersHrefOf(await salonIdOf(TOKYO)), OWNER)
      await openedOrders()
      expect(rowsOf(ORDERS)).toHaveLength(20)

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(await screen.findByText(REST_UNREAD)).toBeVisible()
      expect(rowsOf(ORDERS)).toHaveLength(20)

      // Act
      await readable()
      await readAgain(user)

      // Assert
      await waitFor(() => expect(rowsOf(ORDERS)).toHaveLength(21))
      expect(rowsOf(ORDERS)[20]?.[0]).toBe('PO-PAD-19')
    })

    it('should end the orders where a page after the first was refused to an account that belongs to the salon no more', async () => {
      // Arrange
      await padOrdersOf(TOKYO, 19)
      const stylist = await displayNameOf(STYLIST)
      const user = userEvent.setup()
      await openAs(purchaseOrdersHrefOf(await salonIdOf(TOKYO)), STYLIST)
      await openedOrders()
      whenAskedFor('GET /purchase-orders', () => staffRemovedMeanwhile(stylist))

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(await screen.findByText(REST_UNREAD)).toBeVisible()
      expect(rowsOf(ORDERS)).toHaveLength(20)
    })
  })

  describe('a new order', () => {
    it.each<[string, () => Promise<() => Promise<void>>, string]>([
      [
        'the stock rows',
        async () =>
          unreadable(
            'inventory',
            'createdAt',
            await rowIdOf(TOKYO, 'COLOR001'),
          ),
        '在庫の行を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ],
      [
        'the products',
        async () =>
          unreadable(
            'products',
            'createdAt',
            await productIdOf(TOKYO, 'COLOR001'),
          ),
        PRODUCTS_UNREAD,
      ],
    ])(
      'should say that %s could not be read, and open the form when asked again',
      async (_, arranged, said) => {
        // Arrange
        const user = userEvent.setup()
        const readable = await arranged()
        await openAs(purchaseOrderEntryHrefOf(await salonIdOf(TOKYO)), STYLIST)
        expect(await screen.findByText(said)).toBeVisible()
        await readable()

        // Act
        await readAgain(user)

        // Assert
        await openedEntry()
      },
    )

    it('should say above the form that the order could not be made, and keep what was entered', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAs(purchaseOrderEntryHrefOf(await salonIdOf(TOKYO)), STYLIST)
      await openedEntry()
      await user.type(
        screen.getByRole('textbox', { name: '仕入先' }),
        'Tokyo Beauty Supply',
      )
      await user.type(ofRow('Professional Shampoo 500ml', '数量'), '10')
      await user.type(screen.getByRole('textbox', { name: '税額（円）' }), '0')
      await refuse('insert', 'purchase_orders')

      // Act
      await user.click(screen.getByRole('button', { name: ENTRY }))

      // Assert
      expect(
        await screen.findByText(
          '発注を作れませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(ofRow('Professional Shampoo 500ml', '数量')).toHaveValue('10')
      expect(await storedOrdersOf(TOKYO)).toHaveLength(2)
    })

    it('should say that the suggestions could not be read, and start the order with them when asked again', async () => {
      // Arrange: the rows and the products are read apart from the items of the orders
      const user = userEvent.setup()
      await takeAway('purchase_order_items')
      await openAs(
        suggestedOrderHrefOf(await salonIdOf(TOKYO), 'ColorTech Japan'),
        STYLIST,
      )
      expect(
        await screen.findByText(
          '発注の提案を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('purchase_order_items')

      // Act
      await readAgain(user)

      // Assert
      expect(await screen.findByText(SUGGESTED)).toBeVisible()
      expect(screen.getByRole('textbox', { name: '仕入先' })).toHaveValue(
        'ColorTech Japan',
      )
    })

    it('should say that the suggestions are not shown to an account that belongs to the salon no more once the rows were read', async () => {
      // Arrange: the suggestions are asked for when the rows and the products were read
      const stylist = await displayNameOf(STYLIST)
      whenAskedFor('GET /purchase-orders/reorder-suggestions', async () => {
        await screen.findByText('発注の提案を読み込んでいます')
        await staffRemovedMeanwhile(stylist)
      })

      // Act
      await openAs(
        suggestedOrderHrefOf(await salonIdOf(TOKYO), 'ColorTech Japan'),
        STYLIST,
      )

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('textbox', { name: '仕入先' })).toBeNull()
    })
  })

  describe('the suggestions', () => {
    it('should say that the suggestions could not be read, and show them when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      await takeAway('purchase_order_items')
      await openAs(reorderSuggestionsHrefOf(await salonIdOf(TOKYO)), STYLIST)
      expect(
        await screen.findByText(
          '発注の提案を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('purchase_order_items')

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByRole('region', { name: 'ColorTech Japan' }),
      ).toBeVisible()
    })
  })
})
