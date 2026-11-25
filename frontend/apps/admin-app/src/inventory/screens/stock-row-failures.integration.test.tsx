import {
  refuse,
  salonIdOf,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { heading, readAgain } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
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
  madeStaffMeanwhile,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import { stockRowChangeHrefOf, stockRowHrefOf } from '../../navigation'
import { productIdOf } from '../../products/__tests__/arrangements'
import { PRODUCTS_UNREAD } from '../../products/__tests__/screens'
import {
  anotherRow,
  displayNameOf,
  lotsKeptMeanwhile,
  rowIdOf,
  storedRowsOf,
} from '../__tests__/arrangements'
import { NOT_THEIRS, openedChange } from '../__tests__/screens'

/*
 * A stock row, and the form that changes and removes it, when a request
 * fails, and when the account or the product changes between two
 * requests of the screen. The failures are arranged in the database; what
 * goes well is in `inventory.integration.test.tsx`.
 */

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

const lot = (): HTMLElement => text(/^ロット番号/)

/** What the screens say of the stock of a salon an account changes nothing of */
const NOT_TO_CHANGE =
  'このサロンの在庫は、変えられません。在庫の行を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。'

/** The screens of a row, by the address of each */
const SCREENS: [string, (salonId: string, rowId: string) => string][] = [
  ['the row', stockRowHrefOf],
  ['the change of the row', stockRowChangeHrefOf],
]

/** The form of the row of the colour, opened by somebody. */
const openTheChange = async (email = OWNER): Promise<string> => {
  const rowId = await rowIdOf(TOKYO, 'COLOR001')
  await openAs(stockRowChangeHrefOf(await salonIdOf(TOKYO), rowId), email)
  await openedChange()

  return rowId
}

/** The dialog of the removal of a row of the colour that counts no stock, opened by the owner. */
const askTheRemoval = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  const emptied = await anotherRow({
    salon: TOKYO,
    productCode: 'COLOR001',
    lotNumber: 'LOT-2026-001',
  })
  await openAs(stockRowChangeHrefOf(await salonIdOf(TOKYO), emptied), OWNER)
  await openedChange()
  await user.click(screen.getByRole('button', { name: '削除' }))

  return screen.getByRole('dialog', {
    name: '在庫の行「Hair Color - Natural Brown（ロット LOT-2026-001）」を削除しますか？',
  })
}

describe('a stock row and its change, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(SCREENS)(
    'should say on %s that the row could not be read, and show it when asked again',
    async (_, hrefOf) => {
      // Arrange
      const user = userEvent.setup()
      const rowId = await rowIdOf(TOKYO, 'COLOR001')
      const readable = await unreadable('inventory', 'createdAt', rowId)
      await openAs(hrefOf(await salonIdOf(TOKYO), rowId), OWNER)
      expect(
        await screen.findByText(
          '在庫の行を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByText('Hair Color - Natural Brown（COLOR001）'),
      ).toBeVisible()
    },
  )

  it.each(SCREENS)(
    'should say on %s that the products could not be read, and show the row when asked again',
    async (_, hrefOf) => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(
        'products',
        'createdAt',
        await productIdOf(TOKYO, 'COLOR001'),
      )
      await openAs(
        hrefOf(await salonIdOf(TOKYO), await rowIdOf(TOKYO, 'COLOR001')),
        OWNER,
      )
      expect(await screen.findByText(PRODUCTS_UNREAD)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      expect(
        await screen.findByText('Hair Color - Natural Brown（COLOR001）'),
      ).toBeVisible()
    },
  )

  it.each<[string, string, (salonId: string, rowId: string) => string]>([
    ['the row', STYLIST, stockRowHrefOf],
    ['the change of the row', MANAGER, stockRowChangeHrefOf],
  ])(
    'should say on %s that the stock is not theirs to see to an account that belonged to the salon no more as the row was read',
    async (_, email, hrefOf) => {
      // Arrange
      const rowId = await rowIdOf(TOKYO, 'COLOR001')
      const member = await displayNameOf(email)
      whenAskedFor(`GET /inventory/${rowId}`, () =>
        staffRemovedMeanwhile(member),
      )

      // Act
      await openAs(hrefOf(await salonIdOf(TOKYO), rowId), email)

      // Assert
      expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
    },
  )

  describe('changing a row', () => {
    it('should say that a row of another salon is not found at the address of this one', async () => {
      // Arrange
      const row = await anotherRow({
        salon: OSAKA,
        productCode: 'SPA001',
        lotNumber: 'LOT-OSAKA-1',
      })

      // Act
      await openAs(stockRowChangeHrefOf(await salonIdOf(TOKYO), row), OPERATOR)

      // Assert
      await heading('在庫の行が見つかりません')
    })

    it('should say what is wrong before sending, and send nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedRowsOf(TOKYO)
      await openTheChange()
      await user.clear(lot())
      await user.type(text('棚'), 'S'.repeat(51))

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(lot()).toHaveAccessibleDescription(
        expect.stringContaining(
          'ロット番号を、100 文字以内で入力してください。この商品は、在庫をロット番号で分けます。',
        ),
      )
      expect(lot()).toHaveFocus()
      expect(text('棚')).toHaveAccessibleDescription(
        expect.stringContaining('棚は、50 文字以内で入力してください。'),
      )
      expect(await storedRowsOf(TOKYO)).toEqual(before)
    })

    it('should follow a product no longer kept by lots meanwhile, and let its lot be cleared only', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedRowsOf(TOKYO)
      await openTheChange()
      await user.clear(lot())
      await user.type(lot(), 'LOT-NEW-1')
      await lotsKeptMeanwhile(TOKYO, 'COLOR001', false)

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'この商品の「在庫をロット番号で分ける」の印が、変わっていました。いまの印で読み直したので、ロット番号を確かめて、もう一度お試しください。',
      )
      expect(
        await screen.findByRole('textbox', {
          name: /^ロット番号/,
          description:
            'この商品は、在庫をロット番号で分けません。ロット番号は、消すことだけができます。',
        }),
      ).not.toBeRequired()
      expect(await storedRowsOf(TOKYO)).toEqual(before)
    })

    it('should say that the account changes no stock when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedRowsOf(TOKYO)
      await openTheChange(MANAGER)
      await user.clear(text('棚'))
      await user.type(text('棚'), 'B-1')
      await madeStaffMeanwhile(MANAGER)

      // Act
      await user.click(screen.getByRole('button', { name: '変更を保存する' }))

      // Assert
      expect(await screen.findByText(NOT_TO_CHANGE)).toBeVisible()
      expect(await storedRowsOf(TOKYO)).toEqual(before)
    })
  })

  describe('removing a row', () => {
    it('should say above the form that the account removes no row when it was made a member of the staff meanwhile', async () => {
      // Arrange
      const user = userEvent.setup()
      const dialog = await askTheRemoval(user)
      await madeStaffMeanwhile(OWNER)

      // Act
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))

      // Assert
      expect(await screen.findByText(NOT_TO_CHANGE)).toBeVisible()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(
        (await storedRowsOf(TOKYO)).map(({ lotNumber }) => lotNumber),
      ).toContain('LOT-2026-001')
    })

    it('should say in the dialog that the row could not be removed, and keep it', async () => {
      // Arrange
      const user = userEvent.setup()
      const dialog = await askTheRemoval(user)
      await refuse('delete', 'inventory')

      // Act
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        '在庫の行を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(
        (await storedRowsOf(TOKYO)).map(({ lotNumber }) => lotNumber),
      ).toContain('LOT-2026-001')

      // Act
      await user.click(within(dialog).getByRole('button', { name: '戻る' }))

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByRole('button', { name: '削除' })).toBeVisible()
    })
  })
})
