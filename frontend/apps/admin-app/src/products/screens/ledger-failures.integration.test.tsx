import {
  salonIdOf,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { OWNER, STYLIST, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { staffRemovedMeanwhile } from '../../customers/__tests__/arrangements'
import { displayNameOf } from '../../inventory/__tests__/arrangements'
import { productEntryHrefOf, productsHrefOf } from '../../navigation'
import {
  everyProductRemoved,
  padsOf,
  productIdOf,
} from '../__tests__/arrangements'
import { openedLedger } from '../__tests__/screens'

/*
 * The product ledger of a salon when a request fails, when the account
 * changes between two requests of the screen, when the same products are
 * asked for again, and when the salon has none. The failures are
 * arranged in the database; what goes well is in
 * `products.integration.test.tsx`.
 */

const LEDGER = '商品台帳'

/** The codes of the products the ledger lists, in its order */
const codesListed = (): string[] => rowsOf(LEDGER).map(([code]) => code ?? '')

describe('the product ledger, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the ledger could not be read, and list it when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    const readable = await unreadable(
      'products',
      'createdAt',
      await productIdOf(TOKYO, 'COLOR001'),
    )
    await openAs(productsHrefOf(await salonIdOf(TOKYO)), OWNER)
    expect(
      await screen.findByText(
        '商品台帳を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await readable()

    // Act
    await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

    // Assert
    await openedLedger()
    expect(codesListed()).toHaveLength(7)
  })

  it('should say that the products after a page could not be read, and read them when asked again', async () => {
    // Arrange: 27 products, the last of which, the wax, cannot be read but on the second page
    await padsOf(TOKYO, 20)
    const readable = await unreadable(
      'products',
      'createdAt',
      await productIdOf(TOKYO, 'WAX001'),
    )
    const user = userEvent.setup()
    await openAs(productsHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedLedger()
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
    await waitFor(() => expect(codesListed()).toHaveLength(27))
    expect(codesListed().at(-1)).toBe('WAX001')
  })

  it('should end the ledger where a page after the first was refused to an account that belongs to the salon no more', async () => {
    // Arrange
    await padsOf(TOKYO, 20)
    const stylist = await displayNameOf(STYLIST)
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    await openAs(productsHrefOf(salonId), STYLIST)
    await openedLedger()
    whenAskedFor(`GET /salons/${salonId}/products`, () =>
      staffRemovedMeanwhile(stylist),
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(codesListed()).toHaveLength(20)
  })

  it('should say what is wrong with the barcode asked for, and read nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(productsHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedLedger()
    const barcode = screen.getByRole('textbox', { name: 'バーコード' })
    await user.type(barcode, '4'.repeat(101))

    // Act
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(barcode).toHaveAccessibleDescription(
      expect.stringContaining('バーコードは、100 文字以内で入力してください。'),
    )
    expect(codesListed()).toHaveLength(7)
  })

  it('should read the ledger anew when the same products are asked for again', async () => {
    // Arrange: a product added by somebody else after the ledger was read
    const user = userEvent.setup()
    await openAs(productsHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedLedger()
    await padsOf(TOKYO, 1)

    // Act
    await user.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    await waitFor(() => expect(codesListed()).toContain('PAD01'))
    expect(codesListed()).toHaveLength(8)
  })

  it('should lead an owner of a salon without products to add one', async () => {
    // Arrange
    await everyProductRemoved(TOKYO)
    const salonId = await salonIdOf(TOKYO)

    // Act
    await openAs(productsHrefOf(salonId), OWNER)

    // Assert
    expect(await screen.findByText('台帳に商品はありません')).toBeVisible()
    expect(
      screen.getByText('店頭で売るものと、施術で使うものを足してください。'),
    ).toBeVisible()
    expect(
      screen
        .getAllByRole('link', { name: '商品を足す' })
        .map((link) => link.getAttribute('href')),
    ).toEqual([productEntryHrefOf(salonId), productEntryHrefOf(salonId)])
  })

  it('should tell a stylist of a salon without products who adds them', async () => {
    // Arrange
    await everyProductRemoved(TOKYO)

    // Act
    await openAs(productsHrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Assert
    expect(await screen.findByText('台帳に商品はありません')).toBeVisible()
    expect(
      screen.getByText(
        '商品を足せるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: '商品を足す' })).toBeNull()
  })
})
