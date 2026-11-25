import { languageStore } from '@beauty-salon-frontend/io'
import {
  giveBack,
  salonIdOf,
  takeAway,
  testApi,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  readAgain,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import { OWNER, STYLIST, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import {
  arrange,
  bookingRemovedMeanwhile,
} from '../../bookings/__tests__/arrangements'
import { staffRemovedMeanwhile } from '../../customers/__tests__/arrangements'
import { describedIn, openAt, part } from '../__tests__/screens'

/*
 * The checkout of a booking when what it reads or sends fails, or changes
 * between two requests of the screen. The failures are arranged in the
 * database; what goes well is in `sales.integration.test.tsx`.
 */

/** The member of the staff the stylist of the seed data is */
const STYLIST_NAME = 'Hiroshi Tanaka'

/** The checkout of a visit of today at 10:00, opened as somebody */
const openTheCheckout = async (
  number: string,
  email = OWNER,
): Promise<string> => {
  const id = await arrange({
    bookingNumber: `BK-TEST-${number}`,
    day: 0,
    at: '10:00',
    status: 'completed',
  })
  await openAt((salon) => `/salons/${salon}/bookings/${id}/checkout`, email)

  return id
}

/** Waits for the amounts of the bill as the API calculated them. */
const theAmounts = async (): Promise<void> => {
  await within(await screen.findByRole('region', { name: '金額' })).findByText(
    '合計',
  )
}

const combobox = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

describe('the checkout of a booking, when a request fails or something changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the sales of the booking could not be read, and open the checkout when asked again', async () => {
    // Arrange
    await takeAway('sales')
    const user = userEvent.setup()
    await openTheCheckout('0401')
    expect(
      await screen.findByText(
        '会計を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await giveBack('sales')

    // Act
    await readAgain(user)

    // Assert
    expect(
      await screen.findByRole('table', { name: '予約の施術' }),
    ).toBeVisible()
  })

  it('should tell an account that belongs to the salon no more that its checkouts are not for it', async () => {
    // Arrange
    whenAskedFor('GET /sales', () => staffRemovedMeanwhile(STYLIST_NAME))

    // Act
    await openTheCheckout('0402', STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'このサロンの会計は、見られません。会計を見られるのは、そのサロンのスタッフと、管理者です。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: '会計を入れる' })).toBeNull()
  })

  it('should say that the amounts could not be calculated, ask for them before the sale is entered, and calculate them again', async () => {
    // Arrange: the calculation reads the payment methods, the screens before it do not
    await takeAway('payment_methods')
    const user = userEvent.setup()
    await openTheCheckout('0403')
    expect(
      await screen.findByText(
        '金額を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: '会計を入れる' }))

    // Assert
    expect(
      await screen.findByText('金額が出てから、会計を入れてください。'),
    ).toBeVisible()
    expect(
      await testApi().query('select count(*)::int as count from sales'),
    ).toEqual([{ count: 0 }])

    // Act
    await giveBack('payment_methods')
    await readAgain(user)

    // Assert
    await theAmounts()
    expect(describedIn('金額')['合計']).toBe('￥5,500')
  })

  it('should say that the account calculates no bill of the salon when it belongs to it no more', async () => {
    // Arrange
    whenAskedFor('POST /sales/calculate', () =>
      staffRemovedMeanwhile(STYLIST_NAME),
    )

    // Act
    await openTheCheckout('0404', STYLIST)

    // Assert
    expect(
      await within(
        await screen.findByRole('region', { name: '金額' }),
      ).findByText('このサロンの会計は、入れられません。'),
    ).toBeVisible()
    expect(
      within(part('金額')).getByRole('button', { name: '計算し直す' }),
    ).toBeVisible()
  })

  it('should say that the account enters no sale of the salon when it belonged to it no more as the sale was sent', async () => {
    // Arrange
    const user = userEvent.setup()
    await openTheCheckout('0405', STYLIST)
    await theAmounts()
    whenAskedFor('POST /sales', () => staffRemovedMeanwhile(STYLIST_NAME))

    // Act
    await user.click(screen.getByRole('button', { name: '会計を入れる' }))

    // Assert
    expect(
      await screen.findByText(
        'このサロンの会計は、入れられません。会計を入れられるのは、そのサロンのスタッフと、管理者です。',
      ),
    ).toBeVisible()
    expect(
      await testApi().query('select count(*)::int as count from sales'),
    ).toEqual([{ count: 0 }])
  })

  it('should say that a booking removed while the sale was sent is billed no more', async () => {
    // Arrange
    const user = userEvent.setup()
    const id = await openTheCheckout('0406')
    await theAmounts()
    whenAskedFor('POST /sales', () => bookingRemovedMeanwhile(id))

    // Act
    await user.click(screen.getByRole('button', { name: '会計を入れる' }))

    // Assert
    expect(
      await screen.findByText(
        'この予約は、会計を入れられる予約ではなくなっていました。予約を確かめてください。',
      ),
    ).toBeVisible()
    expect(
      await testApi().query('select count(*)::int as count from sales'),
    ).toEqual([{ count: 0 }])
  })

  it('should record nobody as the cashier at first when the member of the booking is no longer on the staff', async () => {
    // Arrange
    const id = await arrange({
      bookingNumber: 'BK-TEST-0407',
      day: 0,
      at: '10:00',
      status: 'completed',
    })
    await staffRemovedMeanwhile(STYLIST_NAME)

    // Act
    await openAt((salon) => `/salons/${salon}/bookings/${id}/checkout`)

    // Assert
    await screen.findByRole('table', { name: '予約の施術' })
    expect(rowsOf('予約の施術')).toEqual([
      ['Ladies Cut', '一覧にないスタッフ', '￥5,500', '￥0'],
    ])
    expect(combobox('会計の担当')).toHaveDisplayValue('記録しない')
  })

  it('should take a service that was removed from the menu off the bill once the menu is read again', async () => {
    // Arrange: the menu the screen read still has the service
    const user = userEvent.setup()
    await openTheCheckout('0408')
    await theAmounts()
    await user.selectOptions(combobox('足す施術'), 'Mens Cut（￥4,000）')
    await user.click(screen.getByRole('button', { name: '施術を足す' }))
    await waitFor(() => expect(describedIn('金額')['合計']).toBe('￥9,500'))
    await testApi().query(
      `update services set "deletedAt" = now()
       where name = 'Mens Cut' and "salonId" = (select id from salons where name = $1)`,
      [TOKYO],
    )
    await user.selectOptions(combobox('足す施術'), 'Ladies Cut（￥5,500）')
    await user.click(screen.getByRole('button', { name: '施術を足す' }))
    expect(
      await screen.findByText(
        'Mens Cutは、メニューから削除されていました。外してください。',
      ),
    ).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: '計算し直す' }))

    // Assert
    await waitFor(() => expect(describedIn('金額')['合計']).toBe('￥11,000'))
    expect(rowsOf('足した施術')).toEqual([
      ['Ladies Cut', 'Hiroshi Tanaka', '￥5,500', '￥0', '外す'],
    ])
    expect(screen.queryByRole('option', { name: /^Mens Cut/ })).toBeNull()
  })
})

describe('the checkout of a booking on a page in English, when the account belongs to the salon no more', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should say in English that the account calculates no bill of the salon', async () => {
    // Arrange
    const id = await arrange({
      bookingNumber: 'BK-TEST-0409',
      day: 0,
      at: '10:00',
      status: 'completed',
    })
    whenAskedFor('POST /sales/calculate', () =>
      staffRemovedMeanwhile(STYLIST_NAME),
    )

    // Act
    await openAs(
      `/salons/${await salonIdOf(TOKYO)}/bookings/${id}/checkout`,
      STYLIST,
      'en',
    )

    // Assert
    await heading('Check out')
    expect(
      await screen.findByText('You cannot check out at this salon.'),
    ).toBeVisible()
  })
})
