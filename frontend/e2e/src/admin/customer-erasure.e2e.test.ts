import { OWNER, YUKI } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from '../support/applications'
import { salonId } from '../support/bookings'
import { expectSoundPage } from '../support/checks'
import { expect, type TestApi, test } from '../support/fixtures'
import { part, pressWithTheKeyboard } from '../support/screen'
import { enterCredentials, heading } from '../support/sign-in'

/*
 * Tanaka Yuki of the seed data asks the salon to erase their data: an
 * owner takes the request, with its reason, and calls it off again, with
 * the keyboard alone.
 */

const REASON = '店頭で、ご本人から口頭でお申し出がありました。'

const yukiId = (api: TestApi): Promise<string> =>
  api.idOf(
    'select id::text from customers where email = $1 and "deletedAt" is null',
    [YUKI.email],
  )

const requestsSchema = z.array(
  z.object({ status: z.string(), reason: z.string() }),
)

/** The requests of Tanaka Yuki as the database holds them, oldest first. */
const storedRequests = async (api: TestApi, yuki: string) =>
  requestsSchema.parse(
    await api.query(
      `select status::text, reason from customer_deletion_requests
       where "customerId" = $1 order by "requestedAt"`,
      [yuki],
    ),
  )

const erasure = (page: Page): Locator => part(page, 'データの消去')

test.describe('the request of a customer to have their data erased, in a browser', () => {
  test('should take the request with its reason, and call it off, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const yuki = await yukiId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/${yuki}`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'お客様の台帳')).toBeFocused()

    // Act: the request, its reason typed where the dialog put the focus
    await pressWithTheKeyboard(
      erasure(page).getByRole('button', { name: '消去の依頼を受け付ける' }),
    )
    const asking = page.getByRole('dialog', {
      name: '消去の依頼を受け付けますか？',
    })
    await expect(
      asking.getByRole('textbox', { name: '依頼の理由' }),
    ).toBeFocused()
    await page.keyboard.type(REASON)
    await pressWithTheKeyboard(
      asking.getByRole('button', { name: '受け付ける' }),
    )

    // Assert
    await expect(asking).toBeHidden()
    const scheduled = erasure(page)
      .getByRole('term')
      .filter({ hasText: '消去の予定' })
      .locator('xpath=following-sibling::dd[1]')
    await expect(scheduled).toHaveText(
      /^\d{4}年\d{1,2}月\d{1,2}日（.） \d{2}:\d{2} 以降$/,
    )
    await expect(
      page.getByText(
        new RegExp(
          `^${YUKI.name} 様のデータの消去の依頼を受け付けました。.* 以降に消去します。$`,
        ),
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 3, name: 'データの消去' }),
    ).toBeFocused()
    expect(await storedRequests(api, yuki)).toEqual([
      { status: 'pending', reason: REASON },
    ])

    // Act: the calling off, which asks first with the focus on 「戻る」
    await pressWithTheKeyboard(
      erasure(page).getByRole('button', { name: '依頼を取り消す' }),
    )
    const cancelling = page.getByRole('dialog', {
      name: '消去の依頼を取り消しますか？',
    })
    await expect(cancelling.getByRole('button', { name: '戻る' })).toBeFocused()
    await pressWithTheKeyboard(
      cancelling.getByRole('button', { name: '取り消す' }),
    )

    // Assert
    await expect(cancelling).toBeHidden()
    await expect(
      erasure(page).getByText(/に受け付けた依頼は、.*に取り消しました。$/),
    ).toBeVisible()
    await expect(
      page.getByText(`${YUKI.name} 様のデータの消去の依頼を取り消しました。`),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 3, name: 'データの消去' }),
    ).toBeFocused()
    expect(await storedRequests(api, yuki)).toEqual([
      { status: 'cancelled', reason: REASON },
    ])
  })
})

test.describe('the request of a customer to have their data erased, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit a pending request and the dialog that calls it off into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const yuki = await yukiId(api)
    await api.query(
      `insert into customer_deletion_requests ("customerId", reason, "requestedBy", "requestedAt", "scheduledAt")
       select $1, $2, users.id, now(), now() + interval '336 hours'
       from users where email = $3`,
      [yuki, REASON, OWNER],
    )
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/${yuki}`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(
      erasure(page).getByRole('button', { name: '依頼を取り消す' }),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act
    await erasure(page).getByRole('button', { name: '依頼を取り消す' }).click()

    // Assert
    await expect(
      page.getByRole('dialog', { name: '消去の依頼を取り消しますか？' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
