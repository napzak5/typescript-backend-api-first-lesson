import { languageStore } from '@beauty-salon-frontend/io'
import {
  salonIdOf,
  testApi,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { heading, readAgain } from '@beauty-salon-frontend/testing/screens'
import {
  OPERATOR,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { salonRemovedMeanwhile } from '../../bookings/__tests__/arrangements'
import { staffRemovedMeanwhile } from '../../customers/__tests__/arrangements'
import { methodIdOf } from '../../payment-methods/__tests__/arrangements'
import {
  arrangeVisit,
  saleRemovedMeanwhile,
  storedPaymentsOf,
} from '../__tests__/arrangements'
import { openAt } from '../__tests__/screens'

/*
 * Recording a payment when the payment methods cannot be read, or what
 * the payment names changes before it is recorded. The failures are
 * arranged in the database; what goes well is in
 * `sales.integration.test.tsx`.
 */

/** The member of the staff the stylist of the seed data is */
const STYLIST_NAME = 'Hiroshi Tanaka'

/** The form of a payment of a sale of today, nothing paid, opened as somebody. */
const openThePayment = async (
  number: string,
  email = OWNER,
): Promise<string> => {
  const { saleId } = await arrangeVisit(number)
  await openAt(
    (salon) => `/salons/${salon}/sales/${saleId}/payments/new`,
    email,
  )

  return saleId
}

/** The path of the payment methods of the salon in Tokyo, as the screens ask for them */
const methodsOfTokyo = async (): Promise<string> =>
  `GET /salons/${await salonIdOf(TOKYO)}/payment-methods`

describe('recording a payment, when a request fails or something changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the payment methods could not be read, and offer them when asked again', async () => {
    // Arrange
    const readable = await unreadable(
      'payment_methods',
      'createdAt',
      await methodIdOf(TOKYO, 'Cash'),
    )
    const user = userEvent.setup()
    await openThePayment('0601')
    expect(
      await screen.findByText(
        '支払い方法を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await readable()

    // Act
    await readAgain(user)

    // Assert
    expect(
      await screen.findByRole('radio', { name: 'Cash' }),
    ).toBeInTheDocument()
  })

  it('should tell an account that belongs to the salon no more that the payment methods are not for it', async () => {
    // Arrange
    whenAskedFor(await methodsOfTokyo(), () =>
      staffRemovedMeanwhile(STYLIST_NAME),
    )

    // Act
    await openThePayment('0602', STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'このサロンの売上は、見られません。売上を見られるのは、そのサロンのスタッフと、管理者です。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('radiogroup', { name: '支払い方法' })).toBeNull()
  })

  it('should say to the administrator that the payment methods could not be read when the salon was removed meanwhile', async () => {
    // Arrange: the API finds no salon for the administrator, and refuses its owner
    whenAskedFor(await methodsOfTokyo(), () => salonRemovedMeanwhile(TOKYO))

    // Act
    await openThePayment('0603', OPERATOR)

    // Assert
    expect(
      await screen.findByText(
        '支払い方法を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
  })

  it('should say that a salon that uses no payment method takes no payment', async () => {
    // Arrange
    await testApi().query(
      `update payment_methods set "isActive" = false
       where "salonId" = (select id from salons where name = $1)`,
      [TOKYO],
    )

    // Act
    await openThePayment('0604')

    // Assert
    expect(
      await screen.findByText(
        'このサロンには、使っている支払い方法がありません。サロンの設定で、支払い方法を使えるようにしてください。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: '売上の内容へ' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: '支払いを記録する' }),
    ).toBeNull()
  })

  it('should say at the methods that the one chosen was stopped meanwhile, and record nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const saleId = await openThePayment('0605')
    await user.click(await screen.findByRole('radio', { name: 'Cash' }))
    await testApi().query(
      `update payment_methods set "isActive" = false where id = $1`,
      [await methodIdOf(TOKYO, 'Cash')],
    )

    // Act
    await user.click(screen.getByRole('button', { name: '支払いを記録する' }))

    // Assert
    expect(
      await within(
        screen.getByRole('radiogroup', { name: '支払い方法' }),
      ).findByText('この支払い方法は、もう使えません。選び直してください。'),
    ).toBeVisible()
    expect(await storedPaymentsOf(saleId)).toEqual([])
  })

  it('should say that a sale that was gone when the payment was sent is not found', async () => {
    // Arrange
    const user = userEvent.setup()
    const saleId = await openThePayment('0606')
    await user.click(await screen.findByRole('radio', { name: 'Cash' }))
    whenAskedFor(`POST /sales/${saleId}/process`, () =>
      saleRemovedMeanwhile(saleId),
    )

    // Act
    await user.click(screen.getByRole('button', { name: '支払いを記録する' }))

    // Assert
    await heading('売上が見つかりません')
  })

  it('should say that the sale is not found by an account that belonged to the salon no more when the payment was sent', async () => {
    // Arrange
    const user = userEvent.setup()
    const saleId = await openThePayment('0607', STYLIST)
    await user.click(await screen.findByRole('radio', { name: 'Cash' }))
    whenAskedFor(`POST /sales/${saleId}/process`, () =>
      staffRemovedMeanwhile(STYLIST_NAME),
    )

    // Act
    await user.click(screen.getByRole('button', { name: '支払いを記録する' }))

    // Assert
    await heading('売上が見つかりません')
    expect(await storedPaymentsOf(saleId)).toEqual([])
  })
})

describe('recording a payment on a page in English, when the salon uses no payment method', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should say in English that the salon uses no payment method', async () => {
    // Arrange
    const { saleId } = await arrangeVisit('0608')
    await testApi().query(
      `update payment_methods set "isActive" = false
       where "salonId" = (select id from salons where name = $1)`,
      [TOKYO],
    )

    // Act
    await openAs(
      `/salons/${await salonIdOf(TOKYO)}/sales/${saleId}/payments/new`,
      OWNER,
      'en',
    )

    // Assert
    expect(
      await screen.findByText(
        'This salon uses no payment method. Turn a payment method on in the settings of the salon.',
      ),
    ).toBeVisible()
  })
})
