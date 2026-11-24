import {
  salonIdOf,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { heading, rowsOf } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { salonRemovedMeanwhile } from '../../bookings/__tests__/arrangements'
import {
  madeStaffMeanwhile,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import { inventoryHrefOf, stockEntryHrefOf } from '../../navigation'
import { productIdOf } from '../../products/__tests__/arrangements'
import { PRODUCTS_UNREAD } from '../../products/__tests__/screens'
import {
  anotherRow,
  carriesNothing,
  displayNameOf,
  padRowsOf,
  rowIdOf,
  storedRowsOf,
} from '../__tests__/arrangements'
import { openedStock, openedStockEntry } from '../__tests__/screens'

/*
 * The stock of a salon and the form of a new row when a request fails,
 * when the account, the salon or the products change between two
 * requests of the screen, and when the same view is asked for again. The
 * failures are arranged in the database; what goes well is in
 * `inventory.integration.test.tsx`.
 */

const product = (): HTMLElement =>
  screen.getByRole('combobox', { name: /^商品/ })

/** The codes of the products of the rows the stock lists, in its order. */
const codesListed = (): string[] => rowsOf('在庫').map(([code]) => code ?? '')

describe('the stock and a new row, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('the stock', () => {
    it('should say that the stock could not be read, and list it when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(
        'inventory',
        'createdAt',
        await rowIdOf(TOKYO, 'COLOR001'),
      )
      await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), OWNER)
      expect(
        await screen.findByText(
          '在庫を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await openedStock()
      expect(codesListed()).toHaveLength(6)
    })

    it('should say that the rows after a page could not be read, and read them when asked again', async () => {
      // Arrange: 21 rows, the last of which, of the mask, cannot be read but on a page of its own
      await padRowsOf(TOKYO, 15)
      const readable = await unreadable(
        'inventory',
        'createdAt',
        await rowIdOf(TOKYO, 'TREAT001'),
      )
      const user = userEvent.setup()
      await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), OWNER)
      await openedStock()
      expect(codesListed()).toHaveLength(20)

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(await screen.findByText(REST_UNREAD)).toBeVisible()
      expect(codesListed()).toHaveLength(20)

      // Act
      await readable()
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await waitFor(() => expect(codesListed().at(-1)).toBe('TREAT001'))
      expect(codesListed()).toHaveLength(21)
    })

    it('should end the rows where a page after the first was refused to an account that belongs to the salon no more', async () => {
      // Arrange
      await padRowsOf(TOKYO, 15)
      const stylist = await displayNameOf(STYLIST)
      const user = userEvent.setup()
      await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), STYLIST)
      await openedStock()
      whenAskedFor('GET /inventory', () => staffRemovedMeanwhile(stylist))

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(await screen.findByText(REST_UNREAD)).toBeVisible()
      expect(codesListed()).toHaveLength(20)
    })

    it('should say that the products could not be read, and show the stock when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(
        'products',
        'createdAt',
        await productIdOf(TOKYO, 'COLOR001'),
      )
      await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), OWNER)
      expect(await screen.findByText(PRODUCTS_UNREAD)).toBeVisible()
      await readable()

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await openedStock()
      expect(codesListed()).toHaveLength(6)
    })

    it('should say what is wrong with the lot asked for, and read nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), OWNER)
      await openedStock()
      const lot = screen.getByRole('textbox', { name: /^ロット番号/ })
      await user.type(lot, 'L'.repeat(101))

      // Act
      await user.click(screen.getByRole('button', { name: '探す' }))

      // Assert
      expect(lot).toHaveAccessibleDescription(
        'ロット番号のすべて。大文字と小文字を区別します。 ロット番号は、100 文字以内で入力してください。',
      )
      expect(codesListed()).toHaveLength(6)
    })

    it('should read the rows anew when the same rows are asked for again', async () => {
      // Arrange: a row added by somebody else after the stock was read
      const user = userEvent.setup()
      await openAs(inventoryHrefOf(await salonIdOf(TOKYO)), OWNER)
      await openedStock()
      await anotherRow({
        salon: TOKYO,
        productCode: 'COLOR001',
        lotNumber: 'LOT-2026-001',
      })

      // Act
      await user.click(screen.getByRole('button', { name: '探す' }))

      // Assert
      await waitFor(() => expect(codesListed()).toHaveLength(7))
    })
  })

  describe('a new row', () => {
    it('should say that the salon is not found when it was removed as the row was sent', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAs(stockEntryHrefOf(await salonIdOf(TOKYO)), OPERATOR)
      await openedStockEntry()
      await user.selectOptions(product(), 'Styling Wax 80g（WAX001）')
      await salonRemovedMeanwhile(TOKYO)

      // Act
      await user.click(screen.getByRole('button', { name: '足す' }))

      // Assert
      await heading('サロンが見つかりません')
    })

    it('should say that the account changes no stock when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedRowsOf(TOKYO)
      await openAs(stockEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)
      await openedStockEntry()
      await user.selectOptions(product(), 'Styling Wax 80g（WAX001）')
      await madeStaffMeanwhile(MANAGER)

      // Act
      await user.click(screen.getByRole('button', { name: '足す' }))

      // Assert
      expect(
        await screen.findByText(
          'このサロンの在庫は、変えられません。在庫の行を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
        ),
      ).toBeVisible()
      expect(await storedRowsOf(TOKYO)).toEqual(before)
    })

    it('should say that the products could not be read, and open the form when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(
        'products',
        'createdAt',
        await productIdOf(TOKYO, 'COLOR001'),
      )
      await openAs(stockEntryHrefOf(await salonIdOf(TOKYO)), OWNER)
      expect(await screen.findByText(PRODUCTS_UNREAD)).toBeVisible()
      await readable()

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await openedStockEntry()
    })

    it('should lead a salon that carries no product to add one first', async () => {
      // Arrange
      await carriesNothing(TOKYO)
      const tokyo = await salonIdOf(TOKYO)

      // Act
      await openAs(stockEntryHrefOf(tokyo), OWNER)

      // Assert
      expect(
        await screen.findByText('取り扱い中の商品はありません'),
      ).toBeVisible()
      expect(
        screen.getByText(
          '在庫の行は、取り扱い中の商品に足します。先に、商品台帳に商品を足してください。',
        ),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: '商品を足す' })).toHaveAttribute(
        'href',
        `/salons/${tokyo}/products/new`,
      )
      expect(screen.queryByRole('combobox', { name: /^商品/ })).toBeNull()
    })
  })
})
