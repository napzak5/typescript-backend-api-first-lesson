import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import {
  address,
  columnsOf,
  heading,
  notifications,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import { refuse } from '../../bookings/__tests__/arrangements'
import {
  arrangeChart,
  arrangePoints,
  askedForErasure,
  customerIdOf,
  keepBalance,
  registeredMeanwhile,
  removeMeanwhile,
  storedBalanceOf,
  storedBookingCountOf,
  storedMergeOf,
} from '../__tests__/arrangements'

/*
 * Yamamoto Kenji of the seed data was registered again, by phone, with
 * another address of mail and no kana: the second record is merged into
 * the first. Kenji has an account of his own in the portal, as Tanaka Yuki
 * has; the second record has none. An owner merges, unless a test says
 * otherwise.
 */

/** The second record of Kenji */
const AGAIN = {
  lastName: 'Yamamoto',
  firstName: 'Kenji',
  email: 'kenji.yamamoto@example.com',
}

/** The part of a page under a heading. */
const part = (name: string): HTMLElement => screen.getByRole('region', { name })

/** The row of the items the two differ in that the term heads: the item, the kept one, the merged one, the merge. */
const differenceOf = (term: string, table = '2 人で違う項目'): string[] => {
  const row = within(screen.getByRole('table', { name: table })).getByRole(
    'rowheader',
    { name: term },
  ).parentElement

  return row === null
    ? []
    : [
        ...within(row).getAllByRole('rowheader'),
        ...within(row).getAllByRole('cell'),
      ].map((cell) => cell.textContent ?? '')
}

/** Opens the merge of the customer, at its address, signed in. */
const openMergeOf = async (email: string, account = OWNER) => {
  const id = await customerIdOf(email)
  const tokyo = await salonIdOf(TOKYO)
  renderAt(`/salons/${tokyo}/customers/${id}/merge`)
  await signInAs(account)
  await heading('ほかのお客様とまとめる')

  return { tokyo, id }
}

/** Searches the ledger for the keyword, in the part where the other is chosen. */
const searchFor = async (
  user: ReturnType<typeof userEvent.setup>,
  keyword: string,
): Promise<void> => {
  const chosen = await screen.findByRole('region', { name: 'まとめる相手' })
  await user.type(
    within(chosen).getByRole('searchbox', { name: 'キーワード' }),
    keyword,
  )
  await user.click(within(chosen).getByRole('button', { name: '探す' }))
}

/** Searches the ledger for the keyword and chooses the customer of the name that leads on. */
const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  keyword: string,
  name: string,
): Promise<void> => {
  await searchFor(user, keyword)
  await user.click(await screen.findByRole('link', { name }))
  await screen.findByRole('radio', { name: /^このお客様: / })
}

/** Presses the button that merges, and the one of the dialog that asks first. */
const merge = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(
    within(part('まとめる相手')).getByRole('button', { name: 'まとめる' }),
  )
  const dialog = screen.getByRole('dialog', {
    name: '2 人のお客様を 1 人にまとめますか？',
  })
  await user.click(within(dialog).getByRole('button', { name: 'まとめる' }))

  return dialog
}

describe('merging two records of one customer, against the API', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_MODE', 'production')
    await registeredMeanwhile(AGAIN, OWNER)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead from the page of the customer to the other record, show what the merge makes, and merge it into the customer', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangePoints(AGAIN.email, [
      { type: 'earned', points: 300, daysAgo: 1, expiresIn: 365 },
    ])
    const kept = await storedBalanceOf(KENJI.email)
    const kenji = await customerIdOf(KENJI.email)
    const again = await customerIdOf(AGAIN.email)
    const tokyo = await salonIdOf(TOKYO)
    renderAt(`/salons/${tokyo}/customers/${kenji}`)
    await signInAs(OWNER)
    await heading('お客様の台帳')
    await user.click(
      within(
        await screen.findByRole('region', { name: '台帳の管理' }),
      ).getByRole('link', { name: 'ほかのお客様とまとめる' }),
    )
    await heading('ほかのお客様とまとめる')
    await searchFor(user, 'Yamamoto')
    expect(await screen.findByText(`${KENJI.name}（このお客様）`)).toBeVisible()

    // Act
    await user.click(screen.getByRole('link', { name: KENJI.name }))

    // Assert
    expect(
      await screen.findByRole('table', { name: '2 人で違う項目' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 2, name: 'まとめる相手' }),
    ).toHaveFocus()
    expect(address()).toBe(
      `/salons/${tokyo}/customers/${kenji}/merge?keyword=Yamamoto&with=${again}`,
    )
    expect(differenceOf('メールアドレス')).toEqual([
      'メールアドレス',
      KENJI.email,
      AGAIN.email,
      KENJI.email,
    ])
    expect(differenceOf('フリガナ')).toEqual([
      'フリガナ',
      'ヤマモト ケンジ',
      '記録なし',
      'ヤマモト ケンジ',
    ])
    expect(
      screen.getByText(
        `予約、売上、施術記録、レビューは、${KENJI.name} 様のものになります。好み設定、カルテ、アレルギーは、2 人のものを合わせます。ポイントは、2 人の残高を合わせて ${new Intl.NumberFormat('ja-JP').format(kept + 300)} ポイントになります。`,
      ),
    ).toBeVisible()

    // Act
    const dialog = await merge(user)

    // Assert
    expect(dialog).toHaveAccessibleDescription(
      `${KENJI.name} 様（${KENJI.email}）を残し、${KENJI.name} 様（${AGAIN.email}）を台帳から削除します。削除したお客様は、台帳に戻せません。`,
    )
    expect(await heading('お客様の台帳')).toBeVisible()
    expect(address()).toBe(`/salons/${tokyo}/customers/${kenji}`)
    expect(notifications()).toContain(
      `2 人のお客様を、${KENJI.name} 様にまとめました。`,
    )
    expect(await storedMergeOf(again)).toEqual({
      removed: true,
      email: AGAIN.email,
      operation: 'merge',
    })
    expect(await storedMergeOf(kenji)).toEqual({
      removed: false,
      email: KENJI.email,
      operation: 'merge',
    })
    expect(await storedBalanceOf(KENJI.email)).toBe(kept + 300)

    // Act: the ledger searched again, from the page of the customer
    await user.click(
      within(
        await screen.findByRole('region', { name: '台帳の管理' }),
      ).getByRole('link', { name: 'ほかのお客様とまとめる' }),
    )
    await heading('ほかのお客様とまとめる')
    await searchFor(user, 'Yamamoto')

    // Assert: what was found before the merge is not shown first
    expect(screen.queryByRole('link', { name: KENJI.name })).toBeNull()
    expect(await screen.findByText(`${KENJI.name}（このお客様）`)).toBeVisible()
    expect(screen.queryByRole('link', { name: KENJI.name })).toBeNull()
  })

  it('should offer the search, and no merge, at an address that names the customer as the other', async () => {
    // Arrange
    const kenji = await customerIdOf(KENJI.email)
    const tokyo = await salonIdOf(TOKYO)

    // Act
    renderAt(
      `/salons/${tokyo}/customers/${kenji}/merge?keyword=Yamamoto&with=${kenji}`,
    )
    await signInAs(OWNER)
    await heading('ほかのお客様とまとめる')

    // Assert
    expect(await screen.findByText(`${KENJI.name}（このお客様）`)).toBeVisible()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('should keep the other record when it is chosen, with the values of the one merged into it', async () => {
    // Arrange
    const user = userEvent.setup()
    const { tokyo, id: kenji } = await openMergeOf(KENJI.email)
    const again = await customerIdOf(AGAIN.email)
    const bookings = await storedBookingCountOf(kenji)
    expect(bookings).toBeGreaterThan(0)
    await choose(user, 'Yamamoto', KENJI.name)

    // Act
    await user.click(
      screen.getByRole('radio', {
        name: `選んだお客様: ${KENJI.name} 様（${AGAIN.email}）`,
      }),
    )
    await user.click(screen.getByRole('radio', { name: 'まとめるお客様の値' }))

    // Assert
    expect(differenceOf('メールアドレス')).toEqual([
      'メールアドレス',
      AGAIN.email,
      KENJI.email,
      KENJI.email,
    ])

    // Act
    await merge(user)

    // Assert
    expect(await heading('お客様の台帳')).toBeVisible()
    expect(address()).toBe(`/salons/${tokyo}/customers/${again}`)
    expect(await storedMergeOf(again)).toEqual({
      removed: false,
      email: KENJI.email,
      operation: 'merge',
    })
    expect(await storedMergeOf(kenji)).toEqual({
      removed: true,
      email: KENJI.email,
      operation: 'merge',
    })
    expect(await storedBookingCountOf(again)).toBe(bookings)
    expect(await storedBookingCountOf(kenji)).toBe(0)
  })

  it('should say that two customers with accounts of their own cannot be merged, and offer no merge', async () => {
    // Arrange
    const user = userEvent.setup()
    await openMergeOf(KENJI.email)

    // Act
    await choose(user, 'Tanaka', YUKI.name)

    // Assert
    const said = within(part('まとめる相手')).getByRole('status')
    expect(
      within(said)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      '2 人とも、ご自分のアカウントでサインインしているお客様です。アカウントは 1 つにまとめられないため、まとめられません。',
    ])
    expect(
      within(part('まとめる相手')).queryByRole('button', { name: 'まとめる' }),
    ).toBeNull()
  })

  it('should say who asked for their data to be erased, and the points and the lists of the charts that would be too many', async () => {
    // Arrange
    const user = userEvent.setup()
    await askedForErasure(AGAIN.email, OWNER)
    await keepBalance(KENJI.email, 2_000_000_000)
    await keepBalance(AGAIN.email, 147_483_648)
    await arrangeChart(KENJI.email, 0, 30)
    await arrangeChart(AGAIN.email, 30, 21)
    await openMergeOf(KENJI.email)

    // Act
    await choose(user, 'Yamamoto', KENJI.name)

    // Assert
    expect(
      within(within(part('まとめる相手')).getByRole('status'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      `${KENJI.name} 様（${AGAIN.email}）から、データの削除の依頼を受け付けています。依頼を取り消してから、まとめてください。`,
      '2 人のポイントを合わせると 2,147,483,648 ポイントになり、1 人が持てる 2,147,483,647 ポイントを超えます。',
      '2 人のカルテを合わせると、使いたい製品が 50 件を超えます。どちらかのカルテを短くしてから、まとめてください。',
    ])
  })

  it('should read the two again when the API refuses, and say why', async () => {
    // Arrange
    const user = userEvent.setup()
    const { id: kenji } = await openMergeOf(KENJI.email)
    const again = await customerIdOf(AGAIN.email)
    await choose(user, 'Yamamoto', KENJI.name)
    await askedForErasure(AGAIN.email, OWNER)

    // Act
    await merge(user)

    // Assert
    expect(
      await within(part('まとめる相手')).findByRole('alert'),
    ).toHaveTextContent(
      'その間に 2 人の記録が変わったため、まとめられませんでした。2 人の記録を読み直しました。',
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'まとめる相手' }),
    ).toHaveFocus()
    expect(
      await within(part('まとめる相手')).findByText(
        `${KENJI.name} 様（${AGAIN.email}）から、データの削除の依頼を受け付けています。依頼を取り消してから、まとめてください。`,
      ),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((await storedMergeOf(kenji)).removed).toBe(false)
    expect((await storedMergeOf(again)).removed).toBe(false)
  })

  it('should say that the other record left the ledger meanwhile, and lead back to the search', async () => {
    // Arrange
    const user = userEvent.setup()
    const { tokyo, id: kenji } = await openMergeOf(KENJI.email)
    await choose(user, 'Yamamoto', KENJI.name)
    await removeMeanwhile(AGAIN.email)

    // Act
    await merge(user)

    // Assert
    expect(
      await screen.findByText(
        '選んだお客様は、台帳にいません。まとめる相手を選び直してください。',
      ),
    ).toBeVisible()
    expect(within(part('まとめる相手')).getByRole('alert')).toHaveTextContent(
      `${KENJI.name} 様（${AGAIN.email}）は、もう台帳にいません。ほかの画面で、台帳から削除されたか、ほかのお客様にまとめられました。`,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'まとめる相手' }),
    ).toHaveFocus()
    expect((await storedMergeOf(kenji)).removed).toBe(false)

    // Act
    await user.click(screen.getByRole('link', { name: '相手を選び直す' }))

    // Assert
    expect(
      screen.getByRole('heading', { level: 2, name: 'まとめる相手' }),
    ).toHaveFocus()
    expect(address()).toBe(
      `/salons/${tokyo}/customers/${kenji}/merge?keyword=Yamamoto`,
    )
    expect(screen.getByRole('searchbox', { name: 'キーワード' })).toHaveValue(
      'Yamamoto',
    )
    expect(await screen.findByText(`${KENJI.name}（このお客様）`)).toBeVisible()
  })

  it('should say in the dialog that the merge was not done, when the database refuses it', async () => {
    // Arrange
    const user = userEvent.setup()
    const { id: kenji } = await openMergeOf(KENJI.email)
    const again = await customerIdOf(AGAIN.email)
    await choose(user, 'Yamamoto', KENJI.name)
    await refuse('update', 'customers')

    // Act
    const dialog = await merge(user)

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'お客様をまとめられませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect((await storedMergeOf(kenji)).removed).toBe(false)
    expect((await storedMergeOf(again)).removed).toBe(false)
  })

  it('should tell a member of the staff who merges, and offer no search', async () => {
    // Act
    await openMergeOf(KENJI.email, STYLIST)

    // Assert
    expect(
      await screen.findByText(
        '台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('should be accessible with the items the two differ in, and with the dialog open', async () => {
    // Arrange
    const user = userEvent.setup()
    await openMergeOf(KENJI.email)
    await choose(user, 'Yamamoto', KENJI.name)

    // Act
    const withItems = await findAccessibilityViolations(document.body)
    await user.click(
      within(part('まとめる相手')).getByRole('button', { name: 'まとめる' }),
    )
    const withDialog = await findAccessibilityViolations(document.body)

    // Assert
    expect(withItems).toEqual([])
    expect(withDialog).toEqual([])
  })
})

describe('merging two records of one customer on a page in English, against the API', () => {
  /** Searches the ledger for the keyword, as a page in English names the part. */
  const searchInEnglish = async (
    user: ReturnType<typeof userEvent.setup>,
    keyword: string,
  ): Promise<void> => {
    const chosen = await screen.findByRole('region', {
      name: 'Customer to merge with',
    })
    await user.type(
      within(chosen).getByRole('searchbox', { name: 'Keyword' }),
      keyword,
    )
    await user.click(within(chosen).getByRole('button', { name: 'Search' }))
  }

  /** Opens the merge of the customer in English, at its address. */
  const openInEnglish = async (email: string, account = OWNER) => {
    const id = await customerIdOf(email)
    const tokyo = await salonIdOf(TOKYO)
    renderAt(`/salons/${tokyo}/customers/${id}/merge`)
    await signInAs(account, 'en')
    await heading('Merge with another customer')
  }

  beforeEach(async () => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
    await registeredMeanwhile(AGAIN, OWNER)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should lead from the page of the customer to the other record, show in English what the merge makes, and merge them', async () => {
    // Arrange
    const user = userEvent.setup()
    await arrangePoints(AGAIN.email, [
      { type: 'earned', points: 300, daysAgo: 1, expiresIn: 365 },
    ])
    const kept = await storedBalanceOf(KENJI.email)
    const kenji = await customerIdOf(KENJI.email)
    const tokyo = await salonIdOf(TOKYO)
    renderAt(`/salons/${tokyo}/customers/${kenji}`)
    await signInAs(OWNER, 'en')
    await heading('Customer record')
    await user.click(
      within(
        await screen.findByRole('region', { name: 'Record keeping' }),
      ).getByRole('link', { name: 'Merge with another customer' }),
    )
    await heading('Merge with another customer')
    expect(
      await screen.findByText(
        'When the same customer is in the ledger twice, find and choose the other record, and merge the two into one.',
      ),
    ).toBeVisible()
    await searchInEnglish(user, 'Yamamoto')
    expect(
      await screen.findByText(`${KENJI.name} (this customer)`),
    ).toBeVisible()

    // Act
    await user.click(screen.getByRole('link', { name: KENJI.name }))

    // Assert
    await screen.findByRole('table', { name: 'Items that differ' })
    expect(screen.getByText(`${KENJI.name} (${AGAIN.email})`)).toBeVisible()
    expect(
      screen.getByRole('radio', {
        name: `This customer: ${KENJI.name} (${KENJI.email})`,
      }),
    ).toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'The value of the customer kept' }),
    ).toBeChecked()
    expect(columnsOf('Items that differ')).toEqual([
      'Item',
      `${KENJI.name} (kept)`,
      `${KENJI.name} (merged)`,
      'After the merge',
    ])
    expect(differenceOf('Email address', 'Items that differ')).toEqual([
      'Email address',
      KENJI.email,
      AGAIN.email,
      KENJI.email,
    ])
    expect(differenceOf('Phonetic name', 'Items that differ')).toEqual([
      'Phonetic name',
      'ヤマモト ケンジ',
      'Not recorded',
      'ヤマモト ケンジ',
    ])
    expect(
      screen.getByText(
        `The bookings, sales, treatment records and reviews become those of ${KENJI.name}. The preferences, charts and allergies of the two are put together. The points of the two balances are added up to ${new Intl.NumberFormat('en').format(kept + 300)} points.`,
      ),
    ).toBeVisible()

    // Act
    await user.click(
      within(part('Customer to merge with')).getByRole('button', {
        name: 'Merge',
      }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Merge the two customers into one?',
    })
    expect(dialog).toHaveAccessibleDescription(
      `${KENJI.name} (${KENJI.email}) is kept, and ${KENJI.name} (${AGAIN.email}) is removed from the ledger. A customer removed by a merge cannot be brought back to the ledger.`,
    )
    expect(await findAccessibilityViolations(document.body)).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }))

    // Assert
    expect(await heading('Customer record')).toBeVisible()
    expect(address()).toBe(`/salons/${tokyo}/customers/${kenji}`)
    expect(notifications()).toContain(
      `The two customers were merged into ${KENJI.name}.`,
    )
    expect(await storedBalanceOf(KENJI.email)).toBe(kept + 300)
  })

  it('should say in English that two customers with accounts of their own cannot be merged', async () => {
    // Arrange
    const user = userEvent.setup()
    await openInEnglish(KENJI.email)
    await searchInEnglish(user, 'Tanaka')

    // Act
    await user.click(await screen.findByRole('link', { name: YUKI.name }))

    // Assert
    await screen.findByRole('radio', { name: /^This customer: / })
    const said = within(part('Customer to merge with')).getByRole('status')
    expect(said).toHaveTextContent('Cannot be merged')
    expect(
      within(said)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Both customers sign in with their own accounts. Accounts cannot be made one, so the two cannot be merged.',
    ])
    expect(screen.getByRole('link', { name: 'Choose again' })).toBeVisible()
  })

  it('should tell a member of the staff in English who merges', async () => {
    // Act
    await openInEnglish(KENJI.email, STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'Owners and managers remove customers from the ledger, merge them and read the change history.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})
