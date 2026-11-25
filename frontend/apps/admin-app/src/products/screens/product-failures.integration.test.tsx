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
  OWNER,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { salonRemovedMeanwhile } from '../../bookings/__tests__/arrangements'
import {
  madeStaffMeanwhile,
  staffRemovedMeanwhile,
} from '../../customers/__tests__/arrangements'
import { displayNameOf } from '../../inventory/__tests__/arrangements'
import {
  productChangeHrefOf,
  productEntryHrefOf,
  productHrefOf,
} from '../../navigation'
import {
  productIdOf,
  removalsOf,
  storedProductsOf,
} from '../__tests__/arrangements'
import {
  NOT_THEIRS,
  openedForm,
  openedProduct,
  PRODUCTS_UNREAD,
} from '../__tests__/screens'

/*
 * A product, its form and its removal when a request fails, and when the
 * account or the salon changes between two requests of the screen. The
 * failures are arranged in the database; what goes well is in
 * `products.integration.test.tsx`.
 */

/** What the form says to an account that may not keep the products */
const FORBIDDEN =
  'このサロンの商品は、変えられません。商品を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。'

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

/** The address of the wax of the salon in Tokyo, the product it keeps no stock of, on a screen of a product */
const waxAt = async (
  hrefOf: (salonId: string, productId: string) => string,
): Promise<string> =>
  hrefOf(await salonIdOf(TOKYO), await productIdOf(TOKYO, 'WAX001'))

/** Fills what a new product must have */
const fillNewProduct = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.type(text(/^商品コード/), 'OIL001')
  await user.type(text(/^単位/), 'bottle')
  await user.type(text(/^商品名/), 'Hair Oil 100ml')
}

/** Changes the sale price of the product on its form */
const changePrice = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.clear(text(/^販売価格/))
  await user.type(text(/^販売価格/), '1900')
}

describe('a product, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each<
    [
      string,
      (salonId: string, productId: string) => string,
      () => Promise<void>,
    ]
  >([
    ['the product', productHrefOf, openedProduct],
    [
      'the form of a change',
      productChangeHrefOf,
      () => openedForm('商品を直す'),
    ],
  ])(
    'should say that %s could not be read, and show it when asked again',
    async (_, hrefOf, opened) => {
      // Arrange
      const user = userEvent.setup()
      const readable = await unreadable(
        'products',
        'createdAt',
        await productIdOf(TOKYO, 'WAX001'),
      )
      await openAs(await waxAt(hrefOf), OWNER)
      expect(await screen.findByText(PRODUCTS_UNREAD)).toBeVisible()
      await readable()

      // Act
      await readAgain(user)

      // Assert
      await opened()
    },
  )

  it('should say that the product is not shown to an account that belongs to the salon no more', async () => {
    // Arrange
    const manager = await displayNameOf(MANAGER)
    const salonId = await salonIdOf(TOKYO)
    const productId = await productIdOf(TOKYO, 'WAX001')
    whenAskedFor(`GET /salons/${salonId}/products/${productId}`, () =>
      staffRemovedMeanwhile(manager),
    )

    // Act
    await openAs(productChangeHrefOf(salonId, productId), MANAGER)

    // Assert
    expect(await screen.findByText(NOT_THEIRS)).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('should say what is wrong before sending a change, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedProductsOf(TOKYO)
    await openAs(await waxAt(productChangeHrefOf), OWNER)
    await openedForm('商品を直す')
    await user.clear(text(/^商品名/))

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(text(/^商品名/)).toHaveAccessibleDescription(
      '255 文字まで。 商品名を、255 文字以内で入力してください。',
    )
    expect(text(/^商品名/)).toHaveFocus()
    expect(await storedProductsOf(TOKYO)).toEqual(before)
  })

  it('should say at the code that another product has it when it is changed to that one', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedProductsOf(TOKYO)
    await openAs(await waxAt(productChangeHrefOf), OWNER)
    await openedForm('商品を直す')
    await user.clear(text(/^商品コード/))
    await user.type(text(/^商品コード/), 'SHMP001')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText(
        /^この商品コードは、このサロンのほかの商品が使っています。/,
      ),
    ).toBeInTheDocument()
    expect(text(/^商品コード/)).toHaveFocus()
    expect(await storedProductsOf(TOKYO)).toEqual(before)
  })

  it('should say that the account changes no product when it was made a member of the staff meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedProductsOf(TOKYO)
    await openAs(await waxAt(productChangeHrefOf), MANAGER)
    await openedForm('商品を直す')
    await changePrice(user)
    await madeStaffMeanwhile(MANAGER)

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(await screen.findByText(FORBIDDEN)).toBeVisible()
    expect(await storedProductsOf(TOKYO)).toEqual(before)
  })

  it('should say in the dialog that the product could not be removed, and keep it open to try again', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(await waxAt(productChangeHrefOf), OWNER)
    await openedForm('商品を直す')
    await user.click(screen.getByRole('button', { name: '削除' }))
    const dialog = screen.getByRole('dialog')
    await refuse('update', 'products')

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '商品を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(await removalsOf(TOKYO, 'WAX001')).toEqual([false])
  })

  it('should close the dialog and say above the form that the account removes no product when it was made a member of the staff meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(await waxAt(productChangeHrefOf), OWNER)
    await openedForm('商品を直す')
    await user.click(screen.getByRole('button', { name: '削除' }))
    await madeStaffMeanwhile(OWNER)

    // Act
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '削除する',
      }),
    )

    // Assert
    expect(await screen.findByText(FORBIDDEN)).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await removalsOf(TOKYO, 'WAX001')).toEqual([false])
  })

  it('should say that the salon is not found when it was removed as a new product was sent', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(productEntryHrefOf(await salonIdOf(TOKYO)), OPERATOR)
    await openedForm('商品を足す')
    await fillNewProduct(user)
    await salonRemovedMeanwhile(TOKYO)

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    await heading('サロンが見つかりません')
  })

  it('should say that the account adds no product when it was made a member of the staff meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedProductsOf(TOKYO)
    await openAs(productEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedForm('商品を足す')
    await fillNewProduct(user)
    await madeStaffMeanwhile(MANAGER)

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(await screen.findByText(FORBIDDEN)).toBeVisible()
    expect(await storedProductsOf(TOKYO)).toEqual(before)
  })
})
