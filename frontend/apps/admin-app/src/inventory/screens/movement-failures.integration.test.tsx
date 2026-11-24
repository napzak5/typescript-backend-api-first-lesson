import {
  giveBack,
  idOf,
  refuse,
  salonIdOf,
  takeAway,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { heading, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { MANAGER, STYLIST, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import {
  madeStaffMeanwhile,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import { movementEntryHrefOf, stockMovementsHrefOf } from '../../navigation'
import {
  anotherRow,
  displayNameOf,
  recordedEarlier,
  rowIdOf,
  rowRemovedMeanwhile,
  storedMovementsOf,
} from '../__tests__/arrangements'
import {
  NOT_THEIRS,
  openedHistory,
  openedMovementEntry,
  REST_UNREAD,
} from '../__tests__/screens'

/*
 * The history of a stock row, and the form of a movement, when a request
 * fails, when the account or the row changes between two requests of the
 * screen, and when the same conditions are asked for again. The failures
 * are arranged in the database; what goes well is in
 * `movements.integration.test.tsx`.
 */

/** The ID of the oldest movement of a row. */
const oldestMovementOf = (inventoryId: string): Promise<string> =>
  idOf(
    `select id::text from inventory_transactions where "inventoryId" = $1
     order by "createdAt", id limit 1`,
    [inventoryId],
  )

/** Lets 25 purchases of one have been recorded of a row in January 2025, before the movement the seed began it with. */
const purchasedEarlier = (inventoryId: string): Promise<void> =>
  recordedEarlier(
    inventoryId,
    Array.from({ length: 25 }, (_, index) => ({
      transactionType: 'purchase',
      quantity: 1,
      createdAt: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
    })),
  )

/** How many movements the history of a row lists. */
const listed = (): number => rowsOf('在庫の移動').length

/** Opens the history of the row of the colour, as somebody. */
const openTheHistory = async (email = MANAGER): Promise<string> => {
  const rowId = await rowIdOf(TOKYO, 'COLOR001')
  await openAs(stockMovementsHrefOf(await salonIdOf(TOKYO), rowId), email)

  return rowId
}

describe('the movements of a row, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('the history', () => {
    it('should say that the row is not found when it was removed as its movements were read', async () => {
      // Arrange
      const emptied = await anotherRow({
        salon: TOKYO,
        productCode: 'COLOR001',
        lotNumber: 'LOT-2026-001',
      })
      whenAskedFor(`GET /inventory/${emptied}/movements`, () =>
        rowRemovedMeanwhile(emptied),
      )

      // Act
      await openAs(
        stockMovementsHrefOf(await salonIdOf(TOKYO), emptied),
        MANAGER,
      )

      // Assert
      await heading('在庫の行が見つかりません')
    })

    it('should say that the stock is not theirs to see to an account that belonged to the salon no more as the movements were read', async () => {
      // Arrange
      const rowId = await rowIdOf(TOKYO, 'COLOR001')
      const stylist = await displayNameOf(STYLIST)
      whenAskedFor(`GET /inventory/${rowId}/movements`, () =>
        staffRemovedMeanwhile(stylist),
      )

      // Act
      await openAs(stockMovementsHrefOf(await salonIdOf(TOKYO), rowId), STYLIST)

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
      expect(screen.queryByRole('table')).toBeNull()
    })

    it('should say that the movements could not be read, and list them when asked again', async () => {
      // Arrange
      const user = userEvent.setup()
      const rowId = await rowIdOf(TOKYO, 'COLOR001')
      const readable = await unreadable(
        'inventory_transactions',
        'createdAt',
        await oldestMovementOf(rowId),
      )
      await openTheHistory()
      expect(
        await screen.findByText(
          '在庫の移動を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await openedHistory()
      expect(listed()).toBe(1)
    })

    it('should say that the movements after a page could not be read, and read them when asked again', async () => {
      // Arrange: 26 movements, of which the API cannot read the page after the first
      const user = userEvent.setup()
      const rowId = await rowIdOf(TOKYO, 'COLOR001')
      await purchasedEarlier(rowId)
      await openTheHistory()
      await openedHistory()
      expect(listed()).toBe(20)
      whenAskedFor(`GET /inventory/${rowId}/movements`, () =>
        takeAway('inventory_transactions'),
      )

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(await screen.findByText(REST_UNREAD)).toBeVisible()
      expect(listed()).toBe(20)

      // Act
      await giveBack('inventory_transactions')
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await waitFor(() => expect(listed()).toBe(26))
    })

    it('should end the history where a page after the first was refused to an account that belongs to the salon no more', async () => {
      // Arrange
      const user = userEvent.setup()
      const rowId = await rowIdOf(TOKYO, 'COLOR001')
      await purchasedEarlier(rowId)
      const stylist = await displayNameOf(STYLIST)
      await openTheHistory(STYLIST)
      await openedHistory()
      whenAskedFor(`GET /inventory/${rowId}/movements`, () =>
        staffRemovedMeanwhile(stylist),
      )

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      expect(await screen.findByText(REST_UNREAD)).toBeVisible()
      expect(listed()).toBe(20)
    })

    it('should show the row, and wait with its history for the staff who recorded the movements', async () => {
      // Arrange: the staff come after the row and its products
      const staff = Promise.withResolvers<void>()
      whenAskedFor('GET /staff-profiles', () => staff.promise)

      // Act
      await openTheHistory()

      // Assert
      expect(
        await screen.findByRole('link', { name: '在庫の移動を記録する' }),
      ).toBeVisible()
      expect(screen.getByText('在庫の移動を読み込んでいます')).toBeVisible()
      expect(screen.queryByRole('table')).toBeNull()

      // Act
      staff.resolve()

      // Assert
      await openedHistory()
      expect(listed()).toBe(1)
    })

    it('should say that the staff could not be read, and show the history when asked again', async () => {
      // Arrange: the sign-in reads a few columns of the staff, the profiles all of them
      const user = userEvent.setup()
      await takeAway('staff', 'bio')
      await openTheHistory()
      expect(
        await screen.findByText(
          'スタッフを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await giveBack('staff', 'bio')

      // Act
      await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

      // Assert
      await openedHistory()
    })

    it('should say what is wrong with the days asked for, and read nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      await openTheHistory()
      await openedHistory()
      await user.type(screen.getByLabelText('記録した日（から）'), '2025-10-31')
      await user.type(screen.getByLabelText('記録した日（まで）'), '2025-10-01')

      // Act
      await user.click(screen.getByRole('button', { name: '表示する' }))

      // Assert
      expect(
        screen.getByLabelText('記録した日（まで）'),
      ).toHaveAccessibleDescription(
        '終わりの日は、始まりの日と同じか、その後にしてください。',
      )
      expect(listed()).toBe(1)
    })

    it('should read the movements anew when the same conditions are asked for again', async () => {
      // Arrange: a movement recorded by somebody else after the history was read
      const user = userEvent.setup()
      const rowId = await openTheHistory()
      await openedHistory()
      await purchasedEarlier(rowId)

      // Act
      await user.click(screen.getByRole('button', { name: '表示する' }))

      // Assert
      await waitFor(() => expect(listed()).toBe(20))
    })
  })

  describe('recording a movement', () => {
    /** The form of a movement of the row of the colour, opened by the manager, with an adjustment filled in. */
    const fillTheAdjustment = async (
      user: ReturnType<typeof userEvent.setup>,
    ): Promise<string> => {
      const rowId = await rowIdOf(TOKYO, 'COLOR001')
      await openAs(movementEntryHrefOf(await salonIdOf(TOKYO), rowId), MANAGER)
      await openedMovementEntry()
      await user.click(screen.getByRole('radio', { name: '在庫の調整' }))
      await user.click(screen.getByRole('radio', { name: '在庫が減る' }))
      await user.type(screen.getByRole('textbox', { name: /^数量/ }), '3')
      await user.type(
        screen.getByRole('textbox', { name: /^理由/ }),
        '数え直したら 17 本だった',
      )

      return rowId
    }

    it('should say that the account records no adjustment when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const rowId = await fillTheAdjustment(user)
      await madeStaffMeanwhile(MANAGER)

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      expect(
        await screen.findByText(
          'このアカウントでは、この在庫の移動を記録できません。在庫の調整、廃棄、サロン間の移動を記録できるのは、サロンのオーナーとマネージャーと、管理者です。',
        ),
      ).toBeVisible()
      expect(await storedMovementsOf(rowId)).toHaveLength(1)
    })

    it('should say that the movement could not be recorded', async () => {
      // Arrange
      const user = userEvent.setup()
      const rowId = await fillTheAdjustment(user)
      await refuse('insert', 'inventory_transactions')

      // Act
      await user.click(screen.getByRole('button', { name: '記録する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '在庫の移動を記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(await storedMovementsOf(rowId)).toHaveLength(1)
    })
  })
})
