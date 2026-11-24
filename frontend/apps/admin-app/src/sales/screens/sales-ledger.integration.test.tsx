import { languageStore } from '@beauty-salon-frontend/io'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import {
  dayFromToday,
  idOf,
  salonIdOf,
  unreadable,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { heading, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { OWNER, STYLIST, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { staffRemovedMeanwhile } from '../../customers/__tests__/arrangements'
import { arrangeCounterSales, arrangeVisit } from '../__tests__/arrangements'
import { openAt } from '../__tests__/screens'

/*
 * The ledger of the sales when it is longer than a page, when a page
 * cannot be read, when it is asked for again as it is, and when nothing
 * matches. The failures are arranged in the database; the ledger of a few
 * sales is in `sales.integration.test.tsx`.
 */

/** The member of the staff the stylist of the seed data is */
const STYLIST_NAME = 'Hiroshi Tanaka'

/** The ID of a sale, by its number. */
const saleIdOf = (saleNumber: string): Promise<string> =>
  idOf('select id::text from sales where "saleNumber" = $1', [saleNumber])

/** The caption of the ledger of today. */
const todaysCaption = async (): Promise<string> =>
  `${dayNameOf(await dayFromToday(0)).ja}の売上`

/** The numbers of the sales the ledger of today lists, in its order. */
const numbersListed = async (): Promise<string[]> =>
  rowsOf(await todaysCaption()).map(([number]) => number ?? '')

/** Opens the ledger of today of the salon in Tokyo, and waits for its table. */
const openTheLedger = async (email = OWNER): Promise<void> => {
  await openAt((salon) => `/salons/${salon}/sales`, email)
  await heading('売上台帳')
  await screen.findByRole('table', { name: await todaysCaption() })
}

describe('the ledger of the sales, a page at a time and when a request fails, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should list the sales a page at a time, and read a page again that did not come', async () => {
    // Arrange: 51 sales, the oldest of which cannot be read but on a page of its own
    await arrangeCounterSales(51)
    const readable = await unreadable(
      'sales',
      'createdAt',
      await saleIdOf('SL-MANY-001'),
    )
    const user = userEvent.setup()
    await openTheLedger()
    expect(await numbersListed()).toHaveLength(50)
    expect(screen.getByText('51 件（50 件を表示しています）')).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(await numbersListed()).toHaveLength(50)

    // Act
    await readable()
    await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

    // Assert
    await waitFor(async () =>
      expect((await numbersListed()).at(-1)).toBe('SL-MANY-001'),
    )
    expect(await numbersListed()).toHaveLength(51)
    expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
  })

  it('should end the ledger where a page after the first was refused to an account that belongs to the salon no more', async () => {
    // Arrange
    await arrangeCounterSales(51)
    const user = userEvent.setup()
    await openTheLedger(STYLIST)
    whenAskedFor('GET /sales', () => staffRemovedMeanwhile(STYLIST_NAME))

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(await numbersListed()).toHaveLength(50)
  })

  it('should say that the ledger could not be read, and list it when asked again', async () => {
    // Arrange
    const { saleId } = await arrangeVisit('0801')
    const readable = await unreadable('sales', 'createdAt', saleId)
    const user = userEvent.setup()
    await openAt((salon) => `/salons/${salon}/sales`)
    expect(
      await screen.findByText(
        '売上を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
    await readable()

    // Act
    await user.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

    // Assert
    expect(
      await screen.findByRole('table', { name: await todaysCaption() }),
    ).toBeVisible()
    expect(await numbersListed()).toEqual(['SL-TEST-0801'])
  })

  it('should read the ledger anew when it is asked for again as it is', async () => {
    // Arrange: a sale entered at the counter after the ledger was read
    const user = userEvent.setup()
    await arrangeVisit('0802')
    await openTheLedger()
    await arrangeCounterSales(1)

    // Act
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await waitFor(async () =>
      expect(await numbersListed()).toEqual(['SL-TEST-0802', 'SL-MANY-001']),
    )
  })

  it('should say that none of the sales of the days match the state asked for', async () => {
    // Arrange
    await arrangeVisit('0804')
    const today = await dayFromToday(0)

    // Act
    await openAt(
      (salon) =>
        `/salons/${salon}/sales?from=${today}&to=${today}&paymentStatus=refunded`,
    )

    // Assert
    expect(
      await screen.findByText(
        `${dayNameOf(today).ja}の売上のうち、条件に合うものはありません`,
      ),
    ).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('the ledger of the sales on a page in English, when nothing matches', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should say in English that none of the sales of the days match the state asked for', async () => {
    // Arrange
    await arrangeVisit('0805')
    const today = await dayFromToday(0)

    // Act
    await openAs(
      `/salons/${await salonIdOf(TOKYO)}/sales?from=${today}&to=${today}&paymentStatus=refunded`,
      OWNER,
      'en',
    )

    // Assert
    expect(
      await screen.findByText(
        `None of the sales of ${dayNameOf(today).en} match the filters`,
      ),
    ).toBeVisible()
  })
})
