import { OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from '../support/applications'
import { salonId } from '../support/bookings'
import { expectSoundPage } from '../support/checks'
import { expect, type TestApi, test } from '../support/fixtures'
import { part, pressWithTheKeyboard } from '../support/screen'
import { enterCredentials, heading } from '../support/sign-in'

/*
 * The status of the purchase orders of the salon in Tokyo: a draft asked
 * to be approved, approved and placed with the supplier by its owner with
 * the keyboard alone, and an order cancelled after a dialog asks for the
 * reason. The status, the dialog and the form of the day of the delivery
 * and the notes are shown on a screen as narrow as a phone as well. The
 * seed data has the orders PO-SEED-0001, waiting for approval, and
 * PO-SEED-0002, placed with the supplier.
 */

const storedSchema = z.tuple([
  z.object({
    status: z.string(),
    approvedByStaff: z.boolean(),
    cancellationReason: z.string().nullable(),
  }),
])

/** An order as the database of the API has it: its status, whether a member of the staff approved it, and why it was cancelled. */
const stored = async (api: TestApi, orderNumber: string) =>
  storedSchema.parse(
    await api.query(
      `select status::text, "approvedBy" is not null as "approvedByStaff",
              "cancellationReason"
       from purchase_orders where "orderNumber" = $1`,
      [orderNumber],
    ),
  )[0]

/** The address of an order of the seed data */
const orderAt = async (api: TestApi, orderNumber: string): Promise<string> => {
  const [order] = z
    .array(z.object({ id: z.string() }))
    .parse(
      await api.query(
        'select id::text from purchase_orders where "orderNumber" = $1',
        [orderNumber],
      ),
    )

  return `${ADMIN.origin}/salons/${await salonId(api)}/purchase-orders/${order?.id ?? ''}`
}

const status = (page: Page): Locator => part(page, '状態')

const statusHeading = (page: Page): Locator =>
  page.getByRole('heading', { name: '状態' })

const CANCELLATION = '発注を取り消しますか？'

test.describe('the status of a purchase order, in a browser', () => {
  test('should let the owner ask for the approval of a draft, approve it and record that it was placed, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await api.query(
      `update purchase_orders set status = 'draft' where "orderNumber" = 'PO-SEED-0001'`,
    )
    await page.goto(await orderAt(api, 'PO-SEED-0001'))
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '発注 PO-SEED-0001')).toBeVisible()
    await expect(status(page)).toContainText('下書き')

    // Act
    await pressWithTheKeyboard(
      status(page).getByRole('button', { name: '承認を依頼する' }),
    )

    // Assert
    await expect(
      page.getByText('発注 PO-SEED-0001 の承認を依頼しました。'),
    ).toBeVisible()
    await expect(statusHeading(page)).toBeFocused()
    await expect(status(page)).toContainText('承認待ち')

    // Act
    await pressWithTheKeyboard(
      status(page).getByRole('button', { name: '承認する' }),
    )

    // Assert
    await expect(
      page.getByText('発注 PO-SEED-0001 を承認しました。'),
    ).toBeVisible()
    await expect(statusHeading(page)).toBeFocused()
    await expect(status(page)).toContainText('承認済み')

    // Act
    await pressWithTheKeyboard(
      status(page).getByRole('button', { name: '発注済みにする' }),
    )

    // Assert
    await expect(
      page.getByText('発注 PO-SEED-0001 を発注済みにしました。'),
    ).toBeVisible()
    await expect(statusHeading(page)).toBeFocused()
    await expect(status(page)).toContainText('発注済み')
    expect(await stored(api, 'PO-SEED-0001')).toEqual({
      status: 'ordered',
      approvedByStaff: true,
      cancellationReason: null,
    })
  })

  test('should cancel an order with its reason after asking, and leave it as it was when the dialog is closed', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(await orderAt(api, 'PO-SEED-0002'))
    await enterCredentials(page, OWNER, api.seedPassword)
    const cancel = status(page).getByRole('button', { name: '発注を取り消す' })
    const cancellation = page.getByRole('dialog', { name: CANCELLATION })

    // Act: asked, and not cancelled
    await pressWithTheKeyboard(cancel)
    await expect(cancellation.getByLabel('取り消す理由')).toBeFocused()
    await page.keyboard.press('Escape')

    // Assert
    await expect(cancellation).toBeHidden()
    await expect(cancel).toBeFocused()
    expect((await stored(api, 'PO-SEED-0002')).status).toBe('ordered')

    // Act: asked again, and cancelled
    await pressWithTheKeyboard(cancel)
    await page.keyboard.type('仕入先の在庫切れ')
    await pressWithTheKeyboard(
      cancellation.getByRole('button', { name: '取り消す' }),
    )

    // Assert
    await expect(cancellation).toBeHidden()
    await expect(statusHeading(page)).toBeFocused()
    await expect(
      page.getByText('発注 PO-SEED-0002 を取り消しました。'),
    ).toBeVisible()
    expect(await stored(api, 'PO-SEED-0002')).toMatchObject({
      status: 'cancelled',
      cancellationReason: '仕入先の在庫切れ',
    })
  })
})

test.describe('the status of a purchase order, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the status, the dialog of the cancellation with what is wrong, and the form of the delivery into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(await orderAt(api, 'PO-SEED-0002'))
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(status(page)).toContainText('発注済み')
    await expectSoundPage(page)

    // Act
    await status(page).getByRole('button', { name: '発注を取り消す' }).click()
    await page
      .getByRole('dialog', { name: CANCELLATION })
      .getByRole('button', { name: '取り消す' })
      .click()

    // Assert
    await expect(
      page.getByRole('dialog').getByLabel('取り消す理由'),
    ).toHaveAccessibleDescription(/取り消す理由を入力してください。$/)
    await expectSoundPage(page)

    // Act
    await page.getByRole('dialog').getByRole('button', { name: '戻る' }).click()
    await page.getByRole('link', { name: '納品予定日とメモを直す' }).click()

    // Assert
    await expect(heading(page, '発注を直す')).toBeFocused()
    await expect(page.getByLabel('納品予定日')).toBeVisible()
    await expectSoundPage(page)
  })
})
