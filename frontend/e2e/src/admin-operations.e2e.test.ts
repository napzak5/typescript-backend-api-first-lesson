import * as z from 'zod'
import { ADMIN } from './applications'
import { part } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { pressWithTheKeyboard } from './sales'
import { CUSTOMER, enterCredentials, heading, OPERATOR } from './sign-in'

/*
 * The operations of the platform, from the side of its operator, with the
 * keyboard alone: the state of the system read again, and the three
 * operations that are meant to run at intervals run by hand, each after
 * its dialog. The seed data has nothing for them to handle, so each test
 * gives the database what they handle. The screen, a dialog and the
 * requests a run carried out are shown on a screen as narrow as a phone as
 * well.
 */

const OWNER = 'owner@beautysalon.jp'

/**
 * The customer whose data is erased: another than the one whose points
 * expire, since the erasure expires what is left of the balance as well
 */
const ERASED = 'customer2@example.com'

/** Lets the customer of the seed data have earned 300 points that expired three days ago. */
const arrangeExpiredPoints = (api: TestApi): Promise<unknown> =>
  api.query(
    `with customer as (
       select id, "loyaltyPoints" as opening from customers where email = $1
     ), made as (
       insert into customer_points ("customerId", "transactionType", points, balance, "expiryDate", "createdAt")
       select id, 'earned', 300, opening + 300, current_date - 3, now() - interval '400 days'
       from customer
     )
     update customers set "loyaltyPoints" = customer.opening + 300
     from customer where customers.id = customer.id`,
    [CUSTOMER],
  )

/** Lets the owner have taken the request of a customer to have their data erased fifteen days ago: it is due. */
const arrangeDueRequest = (api: TestApi): Promise<unknown> =>
  api.query(
    `insert into customer_deletion_requests ("customerId", reason, "requestedBy", "requestedAt", "scheduledAt")
     select customers.id, 'ご本人からのお申し出', users.id,
            now() - interval '15 days', now() - interval '1 day'
     from customers cross join users
     where customers.email = $1 and users.email = $2`,
    [ERASED, OWNER],
  )

/** Lets the owner have uploaded a file an hour ago and removed it: its address for the upload has run out. */
const arrangeRemovedFile = (api: TestApi): Promise<unknown> =>
  api.query(
    `insert into attachments
       ("salonId", filename, "contentType", size, status, "uploadedBy",
        "uploadExpiresAt", "uploadedAt", "deletedAt", "createdAt", "updatedAt")
     select s.id, '削除した見積書.pdf', 'application/pdf', 1024, 'uploaded', u.id,
            now() - interval '45 minutes', now() - interval '1 hour', now(),
            now() - interval '61 minutes', now()
     from salons s cross join users u
     where s.name = 'Beauty Studio Tokyo' and u.email = $1`,
    [OWNER],
  )

const storedSchema = z.tuple([
  z.object({
    expired: z.number(),
    erased: z.boolean(),
    attachments: z.number(),
  }),
])

/** What the three operations leave in the database of the API: the expiry of the points of the customer of the seed data, the erasure, and the attachments left */
const stored = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select (select count(*)::int from customer_points
               where "transactionType" = 'expired'
                 and "customerId" = (select id from customers where email = $1)) as expired,
              (select "deletedAt" is not null from customers
               where id = (select "customerId" from customer_deletion_requests)) as erased,
              (select count(*)::int from attachments) as attachments`,
      [CUSTOMER],
    ),
  )[0]

test.describe('the operations of the platform, in a browser', () => {
  test('should let the operator read the state of the system again and run the three operations with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await arrangeExpiredPoints(api)
    await arrangeDueRequest(api)
    await arrangeRemovedFile(api)
    await page.goto(`${ADMIN.origin}/`)
    await enterCredentials(page, OPERATOR, api.seedPassword)

    // Act
    await pressWithTheKeyboard(page.getByRole('link', { name: '運用' }))

    // Assert
    await expect(heading(page, '運用')).toBeFocused()
    const system = part(page, 'システムの状態')
    await expect(system).toContainText('受け付けています')
    await expect(system).toContainText('正常です')

    // Act
    const check = system.getByRole('button', { name: 'もう一度確かめる' })
    await pressWithTheKeyboard(check)

    // Assert
    await expect(check).toBeFocused()
    await expect(check).not.toHaveAttribute('aria-busy', 'true')

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: 'ポイントを失効させる' }),
    )
    await pressWithTheKeyboard(
      page
        .getByRole('dialog', {
          name: '有効期限の過ぎたポイントを失効させますか？',
        })
        .getByRole('button', { name: '失効させる' }),
    )

    // Assert
    await expect(part(page, 'ポイントの失効')).toContainText(
      'に実行しました。1 人のお客様の、合わせて 300 ポイントを失効させました。',
    )
    await expect(
      page.getByRole('button', { name: 'ポイントを失効させる' }),
    ).toBeFocused()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '消去の依頼を実行する' }),
    )
    await pressWithTheKeyboard(
      page
        .getByRole('dialog', {
          name: '予定日時を過ぎた消去の依頼を、すべて実行しますか？',
        })
        .getByRole('button', { name: '実行する' }),
    )

    // Assert
    const erasure = part(page, 'データの消去の依頼の実行')
    await expect(
      erasure.getByRole('table', { name: '実行した依頼' }),
    ).toContainText('ご本人からのお申し出')

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '添付ファイルを掃除する' }),
    )
    await pressWithTheKeyboard(
      page
        .getByRole('dialog', {
          name: '要らなくなった添付ファイルを消しますか？',
        })
        .getByRole('button', { name: '消す' }),
    )

    // Assert
    await expect(part(page, '添付ファイルの掃除')).toContainText(
      'に実行しました。1 件の添付ファイルを、保存先のファイルと一緒に消しました。',
    )
    expect(await stored(api)).toEqual({
      expired: 1,
      erased: true,
      attachments: 0,
    })
  })
})

test.describe('the operations of the platform, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the state of the system, a dialog and the requests a run carried out into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await arrangeDueRequest(api)
    await page.goto(`${ADMIN.origin}/operations`)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(
      part(page, 'システムの状態').getByRole('table', { name: '依存先の状態' }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('button', { name: '消去の依頼を実行する' }).click()
    const dialog = page.getByRole('dialog', {
      name: '予定日時を過ぎた消去の依頼を、すべて実行しますか？',
    })
    await expect(dialog).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await dialog.getByRole('button', { name: '実行する' }).click()

    // Assert
    await expect(
      page.getByRole('table', { name: '実行した依頼' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
