import { OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { chooseWithTheKeyboard, part, pressWithTheKeyboard } from './screen'
import { enterCredentials, heading } from './sign-in'

/*
 * Customers moved to the ledger from a file of another system, then
 * written all at once from the ledger: given a tag, and removed. Both
 * customers of the file are new to the ledger.
 */

const HANAKO = { email: 'hanako.yamada@example.com', name: '山田 花子' }
const ICHIRO = { email: 'ichiro.suzuki@example.com', name: '鈴木 一郎' }

/** A file as a spreadsheet saves it in UTF-8: the mark of the byte order, CRLF. */
const fileOf = (rows: string[]) => ({
  name: 'customers.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(`﻿${rows.map((row) => `${row}\r\n`).join('')}`),
})

const FILE = fileOf([
  'lastName,firstName,lastNameKana,firstNameKana,email,phoneNumber,membershipTier,tags',
  `山田,花子,ヤマダ,ハナコ,${HANAKO.email},090-1234-5678,gold,紹介`,
  `鈴木,一郎,スズキ,イチロウ,${ICHIRO.email},03-1234-5678,regular,`,
])

const storedSchema = z.array(
  z.object({
    email: z.string(),
    tags: z.array(z.string()),
    present: z.boolean(),
  }),
)

/** The customers of the file as the database of the API has them: their tags, and whether they are in the ledger. */
const storedCustomers = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select email, tags, "deletedAt" is null as present
       from customers where email in ($1, $2) order by email`,
      [HANAKO.email, ICHIRO.email],
    ),
  )

/** Chooses a customer in the ledger with the keyboard. */
const chooseCustomer = async (page: Page, name: string): Promise<void> => {
  const choice = page.getByRole('checkbox', { name: `${name} 様を選ぶ` })
  await chooseWithTheKeyboard(choice)
  await expect(choice).toBeChecked()
}

test.describe('writing customers at once, in a browser', () => {
  test('should register the customers of a file, give them a tag and remove them from the ledger, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '顧客台帳')).toBeFocused()

    // Act: the file
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'CSV から登録する' }),
    )
    await expect(heading(page, 'CSV から登録する')).toBeFocused()
    await page.getByLabel('CSV ファイル').setInputFiles(FILE)
    await expect(
      page.getByRole('table', { name: '登録するお客様' }).getByRole('row'),
    ).toHaveCount(3)
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '2 人を登録する' }),
    )

    // Assert
    await expect(heading(page, '顧客台帳')).toBeFocused()
    await expect(page.getByText('2 人を台帳に登録しました。')).toBeVisible()
    expect(page.url()).toBe(`${ADMIN.origin}/salons/${salon}/customers`)

    // Act: a tag given to both
    await chooseCustomer(page, HANAKO.name)
    await chooseCustomer(page, ICHIRO.name)
    const tagButton = part(page, '2 人を選んでいます').getByRole('button', {
      name: 'タグを付ける・外す',
    })
    await pressWithTheKeyboard(tagButton)
    const tagDialog = page.getByRole('dialog', { name: '選んだ 2 人のタグ' })
    await expect(tagDialog.getByRole('radio', { name: '付ける' })).toBeFocused()
    const tag = tagDialog.getByRole('textbox', { name: 'タグ' })
    await tag.fill('秋のキャンペーン')
    await expectSoundPage(page)
    // Sent as somebody sends it who has typed the tag: with the Enter key
    await tag.press('Enter')

    // Assert: the focus is given back to the button that opened the dialog
    await expect(tagDialog).toBeHidden()
    await expect(tagButton).toBeFocused()
    await expect(
      page.getByText('2 人にタグ「秋のキャンペーン」を付けました。'),
    ).toBeVisible()

    // Act: both removed
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '台帳から削除する' }),
    )
    const removal = page.getByRole('dialog', {
      name: '2 人のお客様を台帳から削除しますか？',
    })
    await expect(removal.getByRole('listitem')).toHaveText([
      `${HANAKO.name} 様`,
      `${ICHIRO.name} 様`,
    ])
    await pressWithTheKeyboard(
      removal.getByRole('button', { name: '削除する' }),
    )

    // Assert: the buttons went with the customers, so the focus is on the heading of what is chosen
    await expect(removal).toBeHidden()
    await expect(
      page.getByRole('heading', { name: '選んだお客様はいません' }),
    ).toBeFocused()
    await expect(page.getByText('2 人を台帳から削除しました。')).toBeVisible()
    await expect(
      page.getByRole('checkbox', { name: `${HANAKO.name} 様を選ぶ` }),
    ).toHaveCount(0)
    await expectSoundPage(page)
    expect(await storedCustomers(api)).toEqual([
      {
        email: HANAKO.email,
        tags: ['紹介', '秋のキャンペーン'],
        present: false,
      },
      { email: ICHIRO.email, tags: ['秋のキャンペーン'], present: false },
    ])
  })
})

test.describe('writing customers at once, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit a file, what is wrong with one, and the customers chosen in the ledger into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/import`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'CSV から登録する')).toBeFocused()
    await expectSoundPage(page)

    // Act: a file with a value that is wrong, then a right one
    await page
      .getByLabel('CSV ファイル')
      .setInputFiles(
        fileOf([
          'lastName,firstName,email,phoneNumber',
          `山田,花子,hanako@,090-1234-5678`,
        ]),
      )
    await expect(page.getByRole('alert')).toContainText('2 行目 メールアドレス')
    await expectSoundPage(page)
    await page.getByLabel('CSV ファイル').setInputFiles(FILE)
    await expect(
      page.getByRole('table', { name: '登録するお客様' }),
    ).toBeVisible()
    await expectSoundPage(page)
    await page.getByRole('button', { name: '2 人を登録する' }).click()
    await expect(heading(page, '顧客台帳')).toBeFocused()

    // Act: the customers chosen, and the dialog of the tag
    await page
      .getByRole('checkbox', { name: `${HANAKO.name} 様を選ぶ` })
      .check()
    await page
      .getByRole('checkbox', { name: `${ICHIRO.name} 様を選ぶ` })
      .check()

    // Assert
    await expect(part(page, '2 人を選んでいます')).toBeVisible()
    await expectSoundPage(page)
    await page.getByRole('button', { name: '台帳から削除する' }).click()
    await expect(
      page.getByRole('dialog', {
        name: '2 人のお客様を台帳から削除しますか？',
      }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
