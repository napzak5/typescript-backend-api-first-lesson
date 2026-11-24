import {
  giveBack,
  refuse,
  salonIdOf,
  takeAway,
  unreadable,
} from '@beauty-salon-frontend/testing/api'
import { MANAGER, OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { madeStaffMeanwhile } from '../../customers/__tests__/arrangements'
import { stockCountHrefOf, stockValueHrefOf } from '../../navigation'
import { productIdOf } from '../../products/__tests__/arrangements'
import { PRODUCTS_UNREAD } from '../../products/__tests__/screens'
import { countsOf, rowIdOf } from '../__tests__/arrangements'
import { openedCount, openedValue } from '../__tests__/screens'

/*
 * The count of the stock and its value when a request fails, and when the
 * account changes between two requests of the screen. The failures are
 * arranged in the database; what goes well is in
 * `count.integration.test.tsx`.
 */

/** The control of what was counted of the row of the colour */
const countedColour = (): HTMLElement =>
  screen.getByRole('textbox', { name: /^Hair Color - Natural Brown/ })

describe('the count and the value of the stock, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('a count', () => {
    it('should say that the rows could not be read, and open the form when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(
        'inventory',
        'createdAt',
        await rowIdOf(TOKYO, 'COLOR001'),
      )
      await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), OWNER)
      expect(
        await screen.findByText(
          '在庫の行を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await openedCount()
    })

    it('should say that the products could not be read, and open the form when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(
        'products',
        'createdAt',
        await productIdOf(TOKYO, 'COLOR001'),
      )
      await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), OWNER)
      expect(await screen.findByText(PRODUCTS_UNREAD)).toBeVisible()
      await readable()

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await openedCount()
    })

    it('should say that the account records no count when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await countsOf(TOKYO)
      await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), MANAGER)
      await openedCount()
      await user.type(countedColour(), '18')
      await madeStaffMeanwhile(MANAGER)

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'このアカウントでは、棚卸しを記録できません。棚卸しを記録できるのは、サロンのオーナーとマネージャーと、管理者です。',
      )
      expect(await countsOf(TOKYO)).toEqual(before)
    })

    it('should say that the count could not be recorded, and keep what was entered', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await countsOf(TOKYO)
      await openAs(stockCountHrefOf(await salonIdOf(TOKYO)), OWNER)
      await openedCount()
      await user.type(countedColour(), '18')
      await refuse('insert', 'inventory_transactions')

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '棚卸しを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(countedColour()).toHaveValue('18')
      expect(await countsOf(TOKYO)).toEqual(before)
    })
  })

  it('should say that the value could not be read, and show it when asked again', async () => {
    // Arrange: the value is worked out from the purchase prices
    const user = userEvent.setup()
    await takeAway('products', 'purchasePrice')
    await openAs(stockValueHrefOf(await salonIdOf(TOKYO)), OWNER)
    expect(
      await screen.findByText(
        '在庫評価額を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await giveBack('products', 'purchasePrice')

    // Act
    await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

    // Assert
    await openedValue()
  })
})
