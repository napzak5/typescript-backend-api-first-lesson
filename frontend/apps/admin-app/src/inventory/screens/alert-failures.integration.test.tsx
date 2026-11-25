import {
  giveBack,
  refuse,
  salonIdOf,
  takeAway,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { readAgain, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { OWNER, STYLIST, TOKYO } from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, REST_UNREAD } from '../../__tests__/screens'
import { staffRemovedMeanwhile } from '../../customers/__tests__/arrangements'
import { stockAlertsHrefOf } from '../../navigation'
import {
  acknowledgedMeanwhile,
  acknowledgementsOf,
  displayNameOf,
  padAlertsOf,
  rowIdOf,
} from '../__tests__/arrangements'
import { ALERTS, openedAlerts } from '../__tests__/screens'

/*
 * The alerts of the stock when a request fails, and when the account
 * changes between two requests of the screen. The failures are arranged
 * in the database; what goes well is in `alerts.integration.test.tsx`.
 * The count of the alerts and their list are worked out from the same
 * facts, so what breaks one breaks both.
 */

/** A moment on the clock of the salon, as the screens say it */
const MOMENT = String.raw`\d{4}年\d{1,2}月\d{1,2}日（.） \d{2}:\d{2}`

/** What the alerts say when they could not be read, and when their count could not */
const UNREAD = {
  alerts:
    '在庫のアラートを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
  count:
    'アラートの件数を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
}

/** The buttons that read again what could not be read: of the count first, which is above the list */
const retries = (): HTMLElement[] =>
  screen.getAllByRole('button', { name: 'もう一度読み込む' })

describe('the alerts of the stock, when something fails or changes meanwhile, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should say that the alerts and their count could not be read, and read each when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await takeAway('inventory_alert_acknowledgements')
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), OWNER)
    expect(await screen.findByText(UNREAD.count)).toBeVisible()
    expect(await screen.findByText(UNREAD.alerts)).toBeVisible()
    expect(retries()).toHaveLength(2)
    await giveBack('inventory_alert_acknowledgements')

    // Act
    await user.click(retries()[0] ?? document.body)

    // Assert
    expect(
      await screen.findByText(
        '今出ているアラートは 6 件で、そのうち 6 件が未確認です。',
      ),
    ).toBeVisible()
    expect(screen.getByText(UNREAD.alerts)).toBeVisible()

    // Act
    await user.click(retries()[0] ?? document.body)

    // Assert
    await openedAlerts()
    expect(rowsOf(ALERTS)).toHaveLength(6)
  })

  it('should say that the alerts after a page could not be read, and read them when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await padAlertsOf(TOKYO, 15)
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedAlerts()
    expect(rowsOf(ALERTS)).toHaveLength(20)
    whenAskedFor('GET /inventory-alerts', () =>
      takeAway('inventory_alert_acknowledgements'),
    )

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(rowsOf(ALERTS)).toHaveLength(20)

    // Act
    await giveBack('inventory_alert_acknowledgements')
    await readAgain(user)

    // Assert
    await waitFor(() => expect(rowsOf(ALERTS)).toHaveLength(21))
  })

  it('should end the alerts where a page after the first was refused to an account that belongs to the salon no more', async () => {
    // Arrange
    const user = userEvent.setup()
    await padAlertsOf(TOKYO, 15)
    const stylist = await displayNameOf(STYLIST)
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await openedAlerts()
    whenAskedFor('GET /inventory-alerts', () => staffRemovedMeanwhile(stylist))

    // Act
    await user.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(await screen.findByText(REST_UNREAD)).toBeVisible()
    expect(rowsOf(ALERTS)).toHaveLength(20)
  })

  it('should say when an alert was seen to, without who, while the staff cannot be read', async () => {
    // Arrange: the sign-in reads a few columns of the staff, the profiles all of them
    await acknowledgedMeanwhile(
      await rowIdOf(TOKYO, 'COLOR001'),
      await displayNameOf(OWNER),
      '返品の手続きをする。',
    )
    await takeAway('staff', 'bio')

    // Act
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), OWNER)

    // Assert
    await openedAlerts()
    expect(rowsOf(ALERTS)[1]?.[3]).toMatch(
      new RegExp(`^${MOMENT}返品の手続きをする。$`),
    )
  })

  it('should say in the dialog that the alert could not be seen to, and keep it open to try again', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(stockAlertsHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedAlerts()
    await user.click(
      screen.getByRole('button', {
        name: /^Hair Color - Natural Brown（ロット .+）の期限切れを確認済みにする$/,
      }),
    )
    const dialog = screen.getByRole('dialog')
    await refuse('insert', 'inventory_alert_acknowledgements')

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: '確認済みにする' }),
    )

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'アラートを確認済みにできませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(await acknowledgementsOf(TOKYO)).toEqual([])
  })
})
