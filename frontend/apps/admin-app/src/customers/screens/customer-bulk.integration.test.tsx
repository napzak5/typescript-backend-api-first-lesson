import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { refuse, salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import {
  address,
  heading,
  notifications,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  OWNER,
  STYLIST,
  TOKYO,
  VIP,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import type { Locale } from '@beauty-salon-shared/i18n'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import { customerImportHrefOf, customersHrefOf } from '../../navigation'
import {
  arrangeCustomers,
  customerIdOf,
  finishBookingsOf,
  giveReferralCode,
  isInLedger,
  removeMeanwhile,
  storedCustomerCount,
  storedCustomerOf,
} from '../__tests__/arrangements'

/*
 * The customers these tests choose are those of the seed data: Tanaka
 * Yuki, tagged vip and organic-preference, whose bookings are not all
 * finished; Yamamoto Kenji, tagged regular and monthly; Nakamura Hiroshi,
 * tagged vip, platinum and high-value. A file registers customers with
 * addresses of mail of its own. A member of the staff chooses and gives
 * tags, an owner removes.
 */

/**
 * The names in the ledger, in alphabetical order. The name of a customer
 * is the second cell of a row, after the cell that chooses them.
 */
const namesInLedger = (): string[] =>
  rowsOf('顧客台帳')
    .map(([, customer]) => customer ?? '')
    .toSorted()

/** The part of a page under a heading. */
const part = (name: string): HTMLElement => screen.getByRole('region', { name })

/** Opens a page of the salon in Tokyo at its address, signed in. */
const openAt = async (
  path: (tokyo: string) => string,
  email: string,
  language: Locale = 'ja',
) => {
  const tokyo = await salonIdOf(TOKYO)
  renderAt(path(tokyo))
  await signInAs(email, language)

  return tokyo
}

/** Waits for the ledger: its heading, then its table. */
const theLedger = async (caption = '顧客台帳'): Promise<void> => {
  await heading('顧客台帳')
  await screen.findByRole('table', { name: caption })
}

/** The control that chooses the file, as the page names it. */
const fileInput = (label = 'CSV ファイル'): HTMLElement =>
  screen.getByLabelText(label)

/** A CSV file as a spreadsheet saves it in UTF-8: the mark of the byte order, CRLF. */
const fileOf = (rows: string[]): File =>
  new File([`﻿${rows.map((row) => `${row}\r\n`).join('')}`], 'customers.csv', {
    type: 'text/csv',
  })

const NEEDED = 'lastName,firstName,email,phoneNumber'

/** The rows of a file of one customer, and of another */
const HANAKO = [NEEDED, '山田,花子,hanako.yamada@example.com,090-1234-5678']
const ICHIRO = [NEEDED, '鈴木,一郎,ichiro.suzuki@example.com,03-1234-5678']

/** A file whose bytes the browser gives once the test lets it, as a slow disk gives them. */
const heldFileOf = (rows: string[], held: Promise<unknown>): File => {
  const bytes = fileOf(rows).arrayBuffer()

  return Object.assign(fileOf(rows), {
    arrayBuffer: () => held.then(() => bytes),
  })
}

/** Lets what was started finish: every promise the screen chained, before the test goes on. */
const settled = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

/** What the screen of the import says, as a page in Japanese and in English names it */
const IMPORT_SAYS = {
  ja: { file: 'CSV ファイル', reading: 'ファイルを読んでいます' },
  en: { file: 'CSV file', reading: 'Reading the file' },
} satisfies Record<Locale, { file: string; reading: string }>

/** Chooses a file on the screen of the import, and waits until it is read. */
const chooseFile = async (
  user: ReturnType<typeof userEvent.setup>,
  rows: string[],
  language: Locale = 'ja',
): Promise<void> => {
  const says = IMPORT_SAYS[language]
  await user.upload(fileInput(says.file), fileOf(rows))
  await waitFor(() => expect(screen.queryByText(says.reading)).toBeNull())
}

/** What the alert of the file lists. */
const problemsShown = (): string[] =>
  within(screen.getByRole('alert'))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')

/** Chooses customers in the ledger by their names. */
const chooseInLedger = async (
  user: ReturnType<typeof userEvent.setup>,
  ...names: string[]
): Promise<void> => {
  for (const name of names) {
    await user.click(screen.getByRole('checkbox', { name: `${name} 様を選ぶ` }))
  }
}

/** The dialog of the tag of the chosen customers, open. */
const tagDialog = (count: number): HTMLElement =>
  screen.getByRole('dialog', { name: `選んだ ${count} 人のタグ` })

/** Gives the chosen customers a tag, or takes it away, in the dialog. */
const retag = async (
  user: ReturnType<typeof userEvent.setup>,
  count: number,
  way: '付ける' | '外す',
  tag: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: 'タグを付ける・外す' }))
  await user.click(within(tagDialog(count)).getByRole('radio', { name: way }))
  await user.type(
    within(tagDialog(count)).getByRole('textbox', { name: 'タグ' }),
    tag,
  )
  await user.click(
    within(tagDialog(count)).getByRole('button', { name: '反映する' }),
  )
}

describe('writing customers at once, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('registering the customers of a file', () => {
    it('should lead from the ledger to the file, register every customer of it, and show them in the ledger', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedCustomerCount()
      const tokyo = await openAt(customersHrefOf, STYLIST)
      await theLedger()

      // Act
      await user.click(screen.getByRole('link', { name: 'CSV から登録する' }))
      await heading('CSV から登録する')
      await chooseFile(user, [
        `${NEEDED},lastNameKana,firstNameKana,membershipTier,tags`,
        '山田,花子,Hanako.Yamada@example.com,090-1234-5678,ヤマダ,ハナコ,gold,"紹介、秋"',
        '鈴木,一郎,ichiro.suzuki@example.com,03-1234-5678,,,regular,',
      ])
      const read = rowsOf('登録するお客様')
      await user.click(screen.getByRole('button', { name: '2 人を登録する' }))
      await theLedger()

      // Assert
      expect(read).toEqual([
        [
          '2',
          '山田 花子',
          'ヤマダ ハナコ',
          'Hanako.Yamada@example.com',
          '090-1234-5678',
          'ゴールド',
        ],
        [
          '3',
          '鈴木 一郎',
          '',
          'ichiro.suzuki@example.com',
          '03-1234-5678',
          'レギュラー',
        ],
      ])
      expect(address()).toBe(customersHrefOf(tokyo))
      expect(notifications()).toContain('2 人を台帳に登録しました。')
      expect(await storedCustomerCount()).toBe(before + 2)
      expect(await storedCustomerOf('hanako.yamada@example.com')).toMatchObject(
        {
          lastName: '山田',
          lastNameKana: 'ヤマダ',
          membershipTier: 'gold',
          customerStatus: 'active',
          isActive: true,
          tags: ['紹介', '秋'],
          allowEmail: false,
        },
      )
      expect(
        rowsOf('顧客台帳')
          .slice(0, 2)
          .map(([, name]) => name)
          .toSorted(),
      ).toEqual(['山田 花子', '鈴木 一郎'].toSorted())
    })

    it('should say what is wrong with a file, row by row, and send nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedCustomerCount()
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')

      // Act
      await chooseFile(user, [
        `${NEEDED},membershipTier`,
        '山田,花子,hanako@,090-1234-5678,regular',
        '鈴木,一郎,ichiro.suzuki@example.com,090-1234-5678,diamond',
      ])
      const problems = problemsShown()
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert
      expect(problems).toEqual([
        '2 行目 メールアドレス: メールアドレスは、hanako@example.com のような形で入力してください。',
        '3 行目 会員ランク: 会員ランクは、regular、silver、gold、platinum、vip のどれかで書いてください。',
      ])
      expect(fileInput()).toBeInvalid()
      expect(fileInput()).toHaveAccessibleDescription(
        expect.stringContaining(
          'ファイルに誤りがあります。下の一覧を確かめて、直したファイルを選び直してください。',
        ),
      )
      expect(fileInput()).toHaveFocus()
      expect(screen.queryByRole('table', { name: '登録するお客様' })).toBeNull()
      expect(await storedCustomerCount()).toBe(before)
    })

    it('should ask for a file when none is chosen', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')

      // Act
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert
      expect(fileInput()).toHaveAccessibleDescription(
        expect.stringContaining('ファイルを選んでください。'),
      )
      expect(fileInput()).toHaveFocus()
    })

    it('should ask for a file again when the one chosen is taken away', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedCustomerCount()
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')
      await chooseFile(user, HANAKO)

      // Act
      await user.upload(fileInput(), [])
      await user.click(screen.getByRole('button', { name: '登録する' }))

      // Assert
      expect(screen.queryByRole('table', { name: '登録するお客様' })).toBeNull()
      expect(fileInput()).toHaveAccessibleDescription(
        expect.stringContaining('ファイルを選んでください。'),
      )
      expect(await storedCustomerCount()).toBe(before)
    })

    it('should say that a file the browser could not read was not read, and send nothing', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedCustomerCount()
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')
      const moved = Object.assign(fileOf(HANAKO), {
        arrayBuffer: () => Promise.reject(new Error('moved away')),
      })

      // Act
      await user.upload(fileInput(), moved)

      // Assert
      await waitFor(() =>
        expect(problemsShown()).toEqual([
          'ファイルを読み込めませんでした。もう一度、ファイルを選んでください。',
        ]),
      )
      await user.click(screen.getByRole('button', { name: '登録する' }))
      expect(fileInput()).toBeInvalid()
      expect(await storedCustomerCount()).toBe(before)
    })

    it('should show the file chosen last, not one chosen before it that is read after it', async () => {
      // Arrange
      const user = userEvent.setup()
      const held = Promise.withResolvers<void>()
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')
      await user.upload(fileInput(), heldFileOf(HANAKO, held.promise))
      await chooseFile(user, ICHIRO)

      // Act: the first file is read only now
      held.resolve()
      await settled()

      // Assert
      expect(rowsOf('登録するお客様')).toEqual([
        [
          '2',
          '鈴木 一郎',
          '',
          'ichiro.suzuki@example.com',
          '03-1234-5678',
          'レギュラー',
        ],
      ])
    })

    it('should send nothing while the file is read, and show what it holds once it is', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedCustomerCount()
      const held = Promise.withResolvers<void>()
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')
      await user.upload(fileInput(), heldFileOf(HANAKO, held.promise))
      expect(screen.getByText('ファイルを読んでいます')).toBeVisible()

      // Act
      await user.click(screen.getByRole('button', { name: '登録する' }))
      held.resolve()

      // Assert
      expect(
        await screen.findByRole('button', { name: '1 人を登録する' }),
      ).toBeVisible()
      expect(fileInput()).not.toHaveAttribute('aria-invalid', 'true')
      expect(await storedCustomerCount()).toBe(before)
    })

    it('should say at its row that a customer of the file is in the ledger already, and register nobody', async () => {
      // Arrange
      const user = userEvent.setup()
      const before = await storedCustomerCount()
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')
      await chooseFile(user, [
        NEEDED,
        '山田,花子,hanako.yamada@example.com,090-1234-5678',
        '田中,由紀,Customer1@Example.com,090-1234-5678',
      ])

      // Act
      await user.click(screen.getByRole('button', { name: '2 人を登録する' }))

      // Assert
      await screen.findByRole('alert')
      expect(problemsShown()).toEqual([
        '3 行目 メールアドレス: このメールアドレスのお客様が、もう台帳にいます。台帳で探して、このお客様の行を外してください。',
      ])
      expect(
        screen.getByRole('table', { name: '登録するお客様' }),
      ).toBeVisible()
      expect(await storedCustomerCount()).toBe(before)
    })

    it('should say at its row that a referral code of the file is taken', async () => {
      // Arrange
      const user = userEvent.setup()
      await giveReferralCode(YUKI.email, 'YUKI2026')
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')
      await chooseFile(user, [
        `${NEEDED},referralCode`,
        '山田,花子,hanako.yamada@example.com,090-1234-5678,YUKI2026',
      ])

      // Act
      await user.click(screen.getByRole('button', { name: '1 人を登録する' }))

      // Assert
      await screen.findByRole('alert')
      expect(problemsShown()).toEqual([
        '2 行目 紹介コード: この紹介コードは、ほかのお客様が使っています（台帳から削除したお客様も含みます）。別のコードを書いてください。',
      ])
    })

    it('should say at its row that the referrer of a customer of the file has left the ledger', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await removeMeanwhile(KENJI.email)
      const before = await storedCustomerCount()
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')
      await chooseFile(user, [
        `${NEEDED},referredBy`,
        '山田,花子,hanako.yamada@example.com,090-1234-5678,',
        `鈴木,一郎,ichiro.suzuki@example.com,090-1234-5678,${kenji}`,
      ])

      // Act
      await user.click(screen.getByRole('button', { name: '2 人を登録する' }))

      // Assert
      await screen.findByRole('alert')
      expect(problemsShown()).toEqual([
        '3 行目 紹介元: 台帳にいないお客様の ID です。台帳の出力の id を書くか、空にしてください。',
      ])
      expect(await storedCustomerCount()).toBe(before)
    })

    it('should say that nobody was registered when the database fails', async () => {
      // Arrange
      const user = userEvent.setup()
      await refuse('insert', 'customers')
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')
      await chooseFile(user, [
        NEEDED,
        '山田,花子,hanako.yamada@example.com,090-1234-5678',
      ])

      // Act
      await user.click(screen.getByRole('button', { name: '1 人を登録する' }))

      // Assert
      expect(
        await screen.findByText(
          'お客様を登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('table', { name: '登録するお客様' }),
      ).toBeVisible()
    })

    it('should have no violations of accessibility with the customers of a file read', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(customerImportHrefOf, STYLIST)
      await heading('CSV から登録する')

      // Act
      await chooseFile(user, [
        NEEDED,
        '山田,花子,hanako.yamada@example.com,090-1234-5678',
      ])

      // Assert
      expect(await findAccessibilityViolations(document.body)).toEqual([])
    })
  })

  describe('choosing customers in the ledger', () => {
    // That the focus goes back to the button that opened the dialog is the browser's (`admin/customer-bulk.e2e.test.ts`)
    it('should give a tag to the chosen customers who lack it, keep the tags they have, and keep them chosen', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await storedCustomerOf(YUKI.email)
      await openAt(customersHrefOf, STYLIST)
      await theLedger()

      // Act
      await chooseInLedger(user, YUKI.name, KENJI.name)
      await retag(user, 2, '付ける', 'vip')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      // Assert
      expect(notifications()).toContain('1 人にタグ「vip」を付けました。')
      expect((await storedCustomerOf(KENJI.email)).tags).toEqual([
        'regular',
        'monthly',
        'vip',
      ])
      expect(await storedCustomerOf(YUKI.email)).toEqual(yuki)
      expect(part('2 人を選んでいます')).toBeVisible()
    })

    it('should take a tag away from the chosen customers who have it, and leave the others as they are', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await storedCustomerOf(KENJI.email)
      await openAt(customersHrefOf, STYLIST)
      await theLedger()

      // Act
      await chooseInLedger(user, YUKI.name, VIP.name, KENJI.name)
      await retag(user, 3, '外す', 'vip')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      // Assert
      expect(notifications()).toContain('2 人からタグ「vip」を外しました。')
      expect((await storedCustomerOf(YUKI.email)).tags).toEqual([
        'organic-preference',
      ])
      expect((await storedCustomerOf(VIP.email)).tags).toEqual([
        'platinum',
        'high-value',
      ])
      expect(await storedCustomerOf(KENJI.email)).toEqual(kenji)
    })

    it('should write nobody when every chosen customer has the tag already', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await storedCustomerOf(YUKI.email)
      const hiroshi = await storedCustomerOf(VIP.email)
      await openAt(customersHrefOf, STYLIST)
      await theLedger()

      // Act
      await chooseInLedger(user, YUKI.name, VIP.name)
      await retag(user, 2, '付ける', 'vip')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      // Assert
      expect(notifications()).toContain(
        '選んだお客様には、もうタグ「vip」が付いています。',
      )
      expect(await storedCustomerOf(YUKI.email)).toEqual(yuki)
      expect(await storedCustomerOf(VIP.email)).toEqual(hiroshi)
    })

    it('should refuse two tags at once, at the field of the dialog', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await storedCustomerOf(YUKI.email)
      await openAt(customersHrefOf, STYLIST)
      await theLedger()

      // Act
      await chooseInLedger(user, YUKI.name)
      await retag(user, 1, '付ける', 'vip、常連')

      // Assert
      const tag = within(tagDialog(1)).getByRole('textbox', { name: 'タグ' })
      expect(tag).toBeInvalid()
      expect(tag).toHaveAccessibleDescription(
        expect.stringContaining(
          'タグは 1 つずつ入力してください。「、」とカンマは使えません。',
        ),
      )
      expect(tag).toHaveFocus()
      expect(await storedCustomerOf(YUKI.email)).toEqual(yuki)
    })

    it('should write no tags when a chosen customer left the ledger meanwhile, and choose them no more', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await storedCustomerOf(YUKI.email)
      await openAt(customersHrefOf, STYLIST)
      await theLedger()
      await chooseInLedger(user, YUKI.name, KENJI.name)
      await removeMeanwhile(KENJI.email)

      // Act
      await retag(user, 2, '付ける', '秋のキャンペーン')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      // Assert
      expect(notifications()).toContain(
        '選んだお客様のうち、Yamamoto Kenji 様は、もう台帳にいません。そのお客様を選ぶのをやめ、台帳を読み直しました。だれのタグも変えていません。',
      )
      expect(part('1 人を選んでいます')).toBeVisible()
      await waitFor(() => expect(namesInLedger()).not.toContain(KENJI.name))
      expect(await storedCustomerOf(YUKI.email)).toEqual(yuki)
    })

    it('should say in the dialog that no tag was written when the database fails', async () => {
      // Arrange
      const user = userEvent.setup()
      await refuse('update', 'customers')
      await openAt(customersHrefOf, STYLIST)
      await theLedger()

      // Act
      await chooseInLedger(user, KENJI.name)
      await retag(user, 1, '付ける', 'vip')

      // Assert
      expect(
        await within(tagDialog(1)).findByText(
          'タグを変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
    })

    it('should not offer a member of the staff to remove customers', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(customersHrefOf, STYLIST)
      await theLedger()
      const before = part('選んだお客様はいません').textContent

      // Act
      await chooseInLedger(user, KENJI.name)

      // Assert
      expect(before).toContain(
        '表でお客様を選ぶと、まとめてタグを付けたり外したりできます。',
      )
      expect(
        screen.queryByRole('button', { name: '台帳から削除する' }),
      ).toBeNull()
    })

    it('should remove the chosen customers from the ledger, for an owner, and put the focus on what is chosen', async () => {
      // Arrange
      const user = userEvent.setup()
      await finishBookingsOf(KENJI.email)
      await arrangeCustomers(1, 'walk-in')
      const kenji = await customerIdOf(KENJI.email)
      const walkIn = await customerIdOf('walk-in-01@example.com')
      await openAt(customersHrefOf, OWNER)
      await theLedger()

      // Act
      await chooseInLedger(user, KENJI.name, 'Walk In 01')
      await user.click(screen.getByRole('button', { name: '台帳から削除する' }))
      const dialog = screen.getByRole('dialog', {
        name: '2 人のお客様を台帳から削除しますか？',
      })
      const names = within(
        within(dialog).getByRole('list', { name: '削除するお客様' }),
      )
        .getAllByRole('listitem')
        .map((item) => item.textContent)
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      // Assert
      expect(names).toEqual(['Yamamoto Kenji 様', 'Walk In 01 様'])
      expect(notifications()).toContain('2 人を台帳から削除しました。')
      expect(
        screen.getByRole('heading', { name: '選んだお客様はいません' }),
      ).toHaveFocus()
      expect(await isInLedger(kenji)).toBe(false)
      expect(await isInLedger(walkIn)).toBe(false)
      await waitFor(() => expect(namesInLedger()).not.toContain('Walk In 01'))
      expect(namesInLedger()).not.toContain(KENJI.name)
    })

    it('should remove nobody when a chosen customer has bookings that are not finished, and say who', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await customerIdOf(YUKI.email)
      const kenji = await customerIdOf(KENJI.email)
      await openAt(customersHrefOf, OWNER)
      await theLedger()

      // Act
      await chooseInLedger(user, YUKI.name, KENJI.name)
      await user.click(screen.getByRole('button', { name: '台帳から削除する' }))
      await user.click(
        within(
          screen.getByRole('dialog', {
            name: '2 人のお客様を台帳から削除しますか？',
          }),
        ).getByRole('button', { name: '削除する' }),
      )

      // Assert
      expect(
        await screen.findByText(
          'Tanaka Yuki 様には、終わっていない予約があります。予約を完了、キャンセル、または削除してから、もう一度お試しください。だれも削除していません。',
        ),
      ).toBeVisible()
      expect(await isInLedger(yuki)).toBe(true)
      expect(await isInLedger(kenji)).toBe(true)
    })

    it('should give up the choice, and keep the focus in its part', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(customersHrefOf, STYLIST)
      await theLedger()
      await chooseInLedger(user, YUKI.name, KENJI.name)

      // Act
      await user.click(screen.getByRole('button', { name: '選ぶのをやめる' }))

      // Assert
      expect(
        screen.getByRole('heading', { name: '選んだお客様はいません' }),
      ).toHaveFocus()
      expect(
        screen.getByRole('checkbox', { name: `${YUKI.name} 様を選ぶ` }),
      ).not.toBeChecked()
    })

    it('should keep the focus at the checkbox of the last customer let go of in the table', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(customersHrefOf, STYLIST)
      await theLedger()
      await chooseInLedger(user, YUKI.name)

      // Act
      await chooseInLedger(user, YUKI.name)

      // Assert
      expect(part('選んだお客様はいません')).toBeVisible()
      expect(
        screen.getByRole('checkbox', { name: `${YUKI.name} 様を選ぶ` }),
      ).toHaveFocus()
    })

    it('should remove nobody when a chosen customer left the ledger meanwhile, and choose them no more', async () => {
      // Arrange
      const user = userEvent.setup()
      await finishBookingsOf(KENJI.email)
      await arrangeCustomers(1, 'walk-in')
      const kenji = await customerIdOf(KENJI.email)
      await openAt(customersHrefOf, OWNER)
      await theLedger()
      await chooseInLedger(user, KENJI.name, 'Walk In 01')
      await removeMeanwhile('walk-in-01@example.com')

      // Act
      await user.click(screen.getByRole('button', { name: '台帳から削除する' }))
      await user.click(
        within(
          screen.getByRole('dialog', {
            name: '2 人のお客様を台帳から削除しますか？',
          }),
        ).getByRole('button', { name: '削除する' }),
      )
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      // Assert
      expect(notifications()).toContain(
        '選んだお客様のうち、Walk In 01 様は、もう台帳にいません。そのお客様を選ぶのをやめ、台帳を読み直しました。だれも削除していません。',
      )
      expect(part('1 人を選んでいます')).toBeVisible()
      expect(await isInLedger(kenji)).toBe(true)
      await waitFor(() => expect(namesInLedger()).not.toContain('Walk In 01'))
    })

    it('should choose nobody under other conditions, nor when they are taken back', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(customersHrefOf, STYLIST)
      await theLedger()
      await chooseInLedger(user, YUKI.name)

      // Act
      await user.type(
        screen.getByRole('searchbox', { name: 'キーワード' }),
        'Tanaka',
      )
      await user.click(screen.getByRole('button', { name: '探す' }))
      await theLedger('条件に合うお客様')
      const narrowed = part('選んだお客様はいません').textContent
      await user.click(screen.getByRole('link', { name: '条件を外す' }))
      await theLedger()

      // Assert
      expect(narrowed).toContain('表でお客様を選ぶと')
      expect(part('選んだお客様はいません')).toBeVisible()
      expect(
        screen.getByRole('checkbox', { name: `${YUKI.name} 様を選ぶ` }),
      ).not.toBeChecked()
    })

    it('should have no violations of accessibility with the dialog of the tag open', async () => {
      // Arrange
      const user = userEvent.setup()
      await openAt(customersHrefOf, OWNER)
      await theLedger()

      // Act
      await chooseInLedger(user, YUKI.name)
      await user.click(
        screen.getByRole('button', { name: 'タグを付ける・外す' }),
      )

      // Assert
      expect(tagDialog(1)).toBeVisible()
      expect(await findAccessibilityViolations(document.body)).toEqual([])
    })
  })
})

describe('writing customers at once on a page in English, against the API', () => {
  /** Waits for the ledger in English: its heading, then its table. */
  const theLedgerInEnglish = async (): Promise<void> => {
    await heading('Customer ledger')
    await screen.findByRole('table', { name: 'Customer ledger' })
  }

  /** Chooses customers in the ledger by their names, in English. */
  const chooseInEnglish = async (
    user: ReturnType<typeof userEvent.setup>,
    ...names: string[]
  ): Promise<void> => {
    for (const name of names) {
      await user.click(screen.getByRole('checkbox', { name: `Select ${name}` }))
    }
  }

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should lead from the ledger to the file and register its customers, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedCustomerCount()
    await openAt(customersHrefOf, STYLIST, 'en')
    await theLedgerInEnglish()
    await user.click(
      screen.getByRole('link', { name: 'Register from a CSV file' }),
    )
    await heading('Register from a CSV file')
    expect(
      screen.getByRole('table', { name: 'Columns of the file' }),
    ).toBeVisible()

    // Act
    await chooseFile(
      user,
      [
        `${NEEDED},membershipTier`,
        'Yamada,Hanako,hanako.yamada@example.com,090-1234-5678,gold',
        'Suzuki,Ichiro,ichiro.suzuki@example.com,03-1234-5678,regular',
      ],
      'en',
    )
    const read = rowsOf('Customers to register')
    await user.click(
      screen.getByRole('button', { name: 'Register 2 customers' }),
    )
    await theLedgerInEnglish()

    // Assert
    expect(read.map((row) => row.at(-1))).toEqual(['Gold', 'Regular'])
    expect(notifications()).toContain('Registered 2 customers in the ledger.')
    expect(await storedCustomerCount()).toBe(before + 2)
  })

  it('should say in English what is wrong with a file, row by row, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedCustomerCount()
    await openAt(customerImportHrefOf, STYLIST, 'en')
    await heading('Register from a CSV file')

    // Act
    await chooseFile(
      user,
      [
        `${NEEDED},membershipTier`,
        'Yamada,Hanako,hanako@,090-1234-5678,regular',
        'Suzuki,Ichiro,ichiro.suzuki@example.com,090-1234-5678,diamond',
      ],
      'en',
    )
    const problems = problemsShown()
    await user.click(screen.getByRole('button', { name: 'Register' }))

    // Assert
    expect(problems).toEqual([
      'Row 2, Email address: Enter an email address in a form such as hanako@example.com.',
      'Row 3, Membership rank: Write one of regular, silver, gold, platinum, vip.',
    ])
    expect(fileInput('CSV file')).toHaveAccessibleDescription(
      expect.stringContaining(
        'The file has errors. Check the list below, then choose the corrected file.',
      ),
    )
    expect(fileInput('CSV file')).toHaveFocus()
    expect(await storedCustomerCount()).toBe(before)
  })

  it('should say in English at its row that a customer of the file is in the ledger already', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAt(customerImportHrefOf, STYLIST, 'en')
    await heading('Register from a CSV file')
    await chooseFile(
      user,
      [
        NEEDED,
        'Yamada,Hanako,hanako.yamada@example.com,090-1234-5678',
        'Tanaka,Yuki,Customer1@Example.com,090-1234-5678',
      ],
      'en',
    )

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Register 2 customers' }),
    )

    // Assert
    await screen.findByRole('alert')
    expect(problemsShown()).toEqual([
      'Row 3, Email address: A customer with this email address is already in the ledger. Find them in the ledger, and take the row of this customer out of the file.',
    ])
  })

  it('should give a tag to the chosen customers in English, and keep them chosen', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAt(customersHrefOf, STYLIST, 'en')
    await theLedgerInEnglish()
    await chooseInEnglish(user, YUKI.name, KENJI.name)
    await user.click(
      screen.getByRole('button', { name: 'Add or remove a tag' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Tag of the chosen customers (2)',
    })
    await user.click(within(dialog).getByRole('radio', { name: 'Add' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Tag' }), 'vip')

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(notifications()).toContain('Added the tag “vip” to 1 customer.')
    expect((await storedCustomerOf(KENJI.email)).tags).toContain('vip')
    expect(part('2 customers chosen')).toBeVisible()
  })

  it('should remove the chosen customers from the ledger in English, once the dialog asked', async () => {
    // Arrange
    const user = userEvent.setup()
    await finishBookingsOf(KENJI.email)
    await arrangeCustomers(1, 'walk-in')
    const kenji = await customerIdOf(KENJI.email)
    await openAt(customersHrefOf, OWNER, 'en')
    await theLedgerInEnglish()
    await chooseInEnglish(user, KENJI.name, 'Walk In 01')
    await user.click(
      screen.getByRole('button', { name: 'Remove from the ledger' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Remove 2 customers from the ledger?',
    })
    expect(dialog).toHaveAccessibleDescription(
      'These customers can no longer be chosen in the customer ledger and in bookings. Their bookings and sales are kept.',
    )
    expect(
      within(within(dialog).getByRole('list', { name: 'Customers to remove' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Yamamoto Kenji', 'Walk In 01'])

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(notifications()).toContain('Removed 2 customers from the ledger.')
    expect(
      screen.getByRole('heading', { name: 'No customers chosen' }),
    ).toHaveFocus()
    expect(await isInLedger(kenji)).toBe(false)
  })

  it('should remove nobody, and say in English who has bookings that are not finished', async () => {
    // Arrange
    const user = userEvent.setup()
    const yuki = await customerIdOf(YUKI.email)
    await openAt(customersHrefOf, OWNER, 'en')
    await theLedgerInEnglish()
    await chooseInEnglish(user, YUKI.name, KENJI.name)
    await user.click(
      screen.getByRole('button', { name: 'Remove from the ledger' }),
    )

    // Act
    await user.click(
      within(
        screen.getByRole('dialog', {
          name: 'Remove 2 customers from the ledger?',
        }),
      ).getByRole('button', { name: 'Remove' }),
    )

    // Assert
    expect(
      await screen.findByText(
        'Tanaka Yuki has bookings that are not finished. Complete, cancel or delete those bookings, then try again. Nobody was removed.',
      ),
    ).toBeVisible()
    expect(await isInLedger(yuki)).toBe(true)
  })
})
