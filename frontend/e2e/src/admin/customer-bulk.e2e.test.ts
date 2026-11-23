import { OWNER, YUKI } from '@beauty-salon-frontend/testing/seed'
import type { Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from '../support/applications'
import { salonId } from '../support/bookings'
import { expectSoundPage } from '../support/checks'
import { expect, type TestApi, test } from '../support/fixtures'
import { type Language, openInLanguage } from '../support/language'
import {
  chooseWithTheKeyboard,
  part,
  pressWithTheKeyboard,
} from '../support/screen'
import { enterCredentials, heading } from '../support/sign-in'

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

const idsSchema = z.array(z.object({ id: z.string() }))

/** The customers of the file as the database of the API has them: their tags, and whether they are in the ledger. */
const storedCustomers = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select email, tags, "deletedAt" is null as present
       from customers where email in ($1, $2) order by email`,
      [HANAKO.email, ICHIRO.email],
    ),
  )

/** The heading of the ledger, in the language of the page */
const LEDGER: Record<Language, string> = {
  ja: '顧客台帳',
  en: 'Customer ledger',
}

/** The name of the box that chooses a customer in the ledger, in the language of the page */
const CHOICE: Record<Language, (name: string) => string> = {
  ja: (name) => `${name} 様を選ぶ`,
  en: (name) => `Select ${name}`,
}

/** Chooses a customer in the ledger with the keyboard. */
const chooseCustomer = async (
  page: Page,
  name: string,
  language: Language = 'ja',
): Promise<void> => {
  const choice = page.getByRole('checkbox', { name: CHOICE[language](name) })
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

/**
 * The pages a screen reads a sentence of the API on: the API answers in
 * the language of the page, and the screen finds what it looks for in the
 * sentence of either. The ledger says its texts in the language of the
 * page; the screens of a file and of the customers written at once are
 * written in Japanese alone yet.
 */
const PAGES: { language: Language; open: (page: Page) => Promise<void> }[] = [
  // Japanese is the language of a page whose visitor chose none
  { language: 'ja', open: async () => {} },
  { language: 'en', open: (page) => openInLanguage(page, 'en') },
]

/** What the API says of an address of mail that a customer of the ledger has */
const TAKEN: Record<Language, (email: string) => string> = {
  ja: (email) => `email が ${email} の顧客は、すでにあります`,
  en: (email) => `Customer with email ${email} already exists`,
}

/** What the API says of a customer whose booking is not finished */
const UNFINISHED: Record<Language, (customerId: string) => string> = {
  ja: (customerId) =>
    `顧客 ${customerId} は削除できません。終わっていない予約が参照しています`,
  en: (customerId) =>
    `Customer ${customerId} cannot be deleted: bookings that are not finished refer to it`,
}

for (const { language, open } of PAGES) {
  test.describe(`a file with a customer of the ledger, on a page whose language is ${language}`, () => {
    test('should find the address of mail that is taken in what the API says in that language, and say so at its row', async ({
      page,
      api,
    }) => {
      // Arrange
      await open(page)
      const salon = await salonId(api)
      await page.goto(`${ADMIN.origin}/salons/${salon}/customers/import`)
      await enterCredentials(page, OWNER, api.seedPassword, language)
      await expect(heading(page, 'CSV から登録する')).toBeFocused()
      await page
        .getByLabel('CSV ファイル')
        .setInputFiles(
          fileOf([
            'lastName,firstName,email,phoneNumber',
            `山田,花子,${HANAKO.email},090-1234-5678`,
            `田中,由紀,${YUKI.email},090-1234-5678`,
          ]),
        )
      const answered = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/customers/bulk'),
      )

      // Act
      await page.getByRole('button', { name: '2 人を登録する' }).click()

      // Assert
      const answer = await answered
      expect(answer.status()).toBe(409)
      expect(answer.headers()['content-language']).toBe(language)
      expect(await answer.json()).toMatchObject({
        detail: TAKEN[language](YUKI.email),
      })
      const refusal = page.getByRole('alert')
      await expect(refusal).toContainText('3 行目 メールアドレス')
      await expect(refusal).toContainText(
        'このメールアドレスのお客様が、もう台帳にいます。',
      )
      expect(await storedCustomers(api)).toEqual([])
    })
  })

  test.describe(`a customer of the ledger whose booking is not finished, on a page whose language is ${language}`, () => {
    test('should find the customer in what the API says in that language, and say who it is', async ({
      page,
      api,
    }) => {
      // Arrange
      await open(page)
      const salon = await salonId(api)
      const [yuki] = idsSchema.parse(
        await api.query('select id from customers where email = $1', [
          YUKI.email,
        ]),
      )
      await page.goto(`${ADMIN.origin}/salons/${salon}/customers`)
      await enterCredentials(page, OWNER, api.seedPassword, language)
      await expect(heading(page, LEDGER[language])).toBeFocused()
      await chooseCustomer(page, YUKI.name, language)
      await page.getByRole('button', { name: '台帳から削除する' }).click()
      const removal = page.getByRole('dialog', {
        name: '1 人のお客様を台帳から削除しますか？',
      })
      const answered = page.waitForResponse(
        (response) =>
          response.request().method() === 'DELETE' &&
          response.url().endsWith('/customers/bulk'),
      )

      // Act
      await removal.getByRole('button', { name: '削除する' }).click()

      // Assert
      const answer = await answered
      expect(answer.status()).toBe(409)
      expect(answer.headers()['content-language']).toBe(language)
      expect(await answer.json()).toMatchObject({
        detail: UNFINISHED[language](yuki?.id ?? ''),
      })
      await expect(removal).toContainText(
        `${YUKI.name} 様には、終わっていない予約があります。`,
      )
      await expect(
        page.getByRole('checkbox', { name: CHOICE[language](YUKI.name) }),
      ).toBeChecked()
    })
  })
}

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
