import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import {
  address,
  heading,
  notifications,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  OWNER,
  STYLIST,
  TOKYO,
  VIP,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../__tests__/screens'
import { refuse } from '../bookings/__tests__/arrangements'
import { customerImportHrefOf, customersHrefOf } from '../navigation'
import {
  arrangeCustomers,
  customerIdOf,
  finishBookingsOf,
  giveReferralCode,
  isInLedger,
  removeMeanwhile,
  storedCustomerCount,
  storedCustomerOf,
} from './__tests__/arrangements'

/*
 * The customers these tests choose are those of the seed data: Tanaka
 * Yuki, tagged vip and organic-preference, whose bookings are not all
 * finished; Yamamoto Kenji, tagged regular and monthly; Nakamura Hiroshi,
 * tagged vip, platinum and high-value. A file registers customers with
 * addresses of mail of its own. A member of the staff chooses and gives
 * tags, an owner removes.
 */

/** The rows of a table, a list of the texts of their cells each. */
const rowsOf = (name: string): string[][] =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).queryAllByRole('rowheader'),
        ...within(row).queryAllByRole('cell'),
      ].map((cell) => cell.textContent ?? ''),
    )

/** The names in the ledger, in alphabetical order. */
const namesInLedger = (): string[] =>
  rowsOf('顧客台帳')
    .map(([customer]) => customer ?? '')
    .toSorted()

/** The part of a page under a heading. */
const part = (name: string): HTMLElement => screen.getByRole('region', { name })

/** Opens a page of the salon in Tokyo at its address, signed in. */
const openAt = async (path: (tokyo: string) => string, email: string) => {
  const tokyo = await salonIdOf(TOKYO)
  renderAt(path(tokyo))
  await signInAs(email)

  return tokyo
}

/** Waits for the ledger: its heading, then its table. */
const theLedger = async (caption = '顧客台帳'): Promise<void> => {
  await heading('顧客台帳')
  await screen.findByRole('table', { name: caption })
}

/** The control that chooses the file. */
const fileInput = (): HTMLElement => screen.getByLabelText('CSV ファイル')

/** A CSV file as a spreadsheet saves it in UTF-8: the mark of the byte order, CRLF. */
const fileOf = (rows: string[]): File =>
  new File([`﻿${rows.map((row) => `${row}\r\n`).join('')}`], 'customers.csv', {
    type: 'text/csv',
  })

const NEEDED = 'lastName,firstName,email,phoneNumber'

/** Chooses a file on the screen of the import, and waits until it is read. */
const chooseFile = async (
  user: ReturnType<typeof userEvent.setup>,
  rows: string[],
): Promise<void> => {
  await user.upload(fileInput(), fileOf(rows))
  await waitFor(() =>
    expect(screen.queryByText('ファイルを読んでいます')).toBeNull(),
  )
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
          '山田 花子',
          '2',
          'ヤマダ ハナコ',
          'Hanako.Yamada@example.com',
          '090-1234-5678',
          'ゴールド',
        ],
        [
          '鈴木 一郎',
          '3',
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
          .map(([name]) => name)
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
    // That the focus goes back to the button that opened the dialog is the browser's (`admin-customer-bulk.e2e.test.ts`)
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
