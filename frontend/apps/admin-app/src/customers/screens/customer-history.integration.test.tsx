import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { asked } from '@beauty-salon-frontend/testing/answers'
import { refuse, salonIdOf } from '@beauty-salon-frontend/testing/api'
import {
  address,
  firstSight,
  heading,
  notifications,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  KENJI,
  MANAGER,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import type { Locale } from '@beauty-salon-shared/i18n'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'
import { openAs } from '../../__tests__/screens'
import {
  changedMeanwhile,
  customerIdOf,
  finishBookingsOf,
  isInLedger,
  notesChangedMeanwhile,
  registeredMeanwhile,
  removedMeanwhile,
  restoredMeanwhile,
} from '../__tests__/arrangements'

/*
 * The customer these tests remove is Yamamoto Kenji of the seed data,
 * whose bookings that are not finished are cancelled first; Tanaka Yuki
 * keeps hers. Both have a version from the start of the history, and
 * an account of their own in the portal. An owner removes and brings
 * back, unless a test says otherwise.
 */

/** What a member of the staff is told where the ledger is kept */
const KEPT =
  '台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。'

/** The rows of the history without the times, which are those of the test: the version, what made it, who, and the items. */
const versionsShown = (): string[][] =>
  rowsOf('版の一覧').map(([version, operation, , changer, items]) => [
    version ?? '',
    operation ?? '',
    changer ?? '',
    items ?? '',
  ])

/** The part of a page under a heading. */
const part = (name: string): HTMLElement => screen.getByRole('region', { name })

/** What a part of a page describes, term by term. */
const describedIn = (name: string): Record<string, string> =>
  Object.fromEntries(
    within(part(name))
      .getAllByRole('term')
      .map((term) => [
        term.textContent ?? '',
        term.nextElementSibling?.textContent ?? '',
      ]),
  )

/** Opens a page of the salon in Tokyo at its address, signed in. */
const openAt = async (
  path: (tokyo: string) => string,
  email = OWNER,
  language: Locale = 'ja',
) => {
  const tokyo = await salonIdOf(TOKYO)
  await openAs(path(tokyo), email, language)

  return tokyo
}

/** Waits for the page of a customer: its heading, then the part that keeps the ledger. */
const theCustomer = async (): Promise<void> => {
  await heading('お客様の台帳')
  await screen.findByRole('region', { name: '台帳' })
  await screen.findByRole('region', { name: '台帳の管理' })
}

/** Waits for the page of a customer who left the ledger. */
const theRemoved = async (): Promise<void> => {
  await heading('お客様の台帳')
  await screen.findByRole('region', { name: '削除されたときの台帳' })
}

/** Opens the dialog of the page of a customer that asks before they are removed. */
const askToRemove = async (
  user: ReturnType<typeof userEvent.setup>,
  name = KENJI.name,
): Promise<HTMLElement> => {
  await user.click(
    within(part('台帳の管理')).getByRole('button', {
      name: '台帳から削除する',
    }),
  )

  return screen.getByRole('dialog', {
    name: `${name} 様を台帳から削除しますか？`,
  })
}

describe('removing customers, bringing them back, and their history, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('removing a customer and bringing them back', () => {
    it('should remove a customer once the dialog asked, keep them at the address as the ledger kept them, and bring them back', async () => {
      // Arrange
      const user = userEvent.setup()
      await finishBookingsOf(KENJI.email)
      const kenji = await customerIdOf(KENJI.email)
      await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`)
      await theCustomer()
      const dialog = await askToRemove(user)
      expect(dialog).toHaveAccessibleDescription(
        '顧客台帳と予約で、このお客様を選べなくなります。予約と売上の記録は残ります。削除したあとも、台帳に戻せます。',
      )

      // Act
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))

      // Assert
      await theRemoved()
      expect(await heading('お客様の台帳')).toHaveFocus()
      expect(notifications()).toContain(
        `${KENJI.name} 様を台帳から削除しました。`,
      )
      expect(
        screen.getByText(/ に、あなたが台帳から削除しました。$/),
      ).toBeVisible()
      expect(describedIn('削除されたときの台帳')).toMatchObject({
        お名前: KENJI.name,
        メールアドレス: KENJI.email,
      })
      expect(await isInLedger(kenji)).toBe(false)
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(screen.getByRole('button', { name: '台帳に戻す' }))

      // Assert
      await theCustomer()
      expect(await heading('お客様の台帳')).toHaveFocus()
      expect(notifications()).toContain(`${KENJI.name} 様を台帳に戻しました。`)
      expect(await isInLedger(kenji)).toBe(true)
    })

    it('should not show a removed customer in the ledger that was read before the removal', async () => {
      // Arrange
      const user = userEvent.setup()
      await finishBookingsOf(KENJI.email)
      await openAt((tokyo) => `/salons/${tokyo}/customers`)
      await screen.findByRole('table', { name: '顧客台帳' })
      await user.click(screen.getByRole('link', { name: KENJI.name }))
      await theCustomer()
      const dialog = await askToRemove(user)
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))
      await theRemoved()

      // Act
      await user.click(screen.getByRole('link', { name: '顧客' }))

      // Assert
      await heading('顧客台帳')
      // The notification of the removal stays, and names the customer
      expect(
        firstSight()[1].replace(`${KENJI.name} 様を台帳から削除しました。`, ''),
      ).not.toContain(KENJI.name)
      await screen.findByRole('table', { name: '顧客台帳' })
      expect(screen.queryByRole('link', { name: KENJI.name })).toBeNull()
    })

    it('should say beside the buttons that a customer with a booking that is not finished stays, and close the dialog', async () => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await customerIdOf(YUKI.email)
      await openAt((tokyo) => `/salons/${tokyo}/customers/${yuki}`)
      await theCustomer()
      const dialog = await askToRemove(user, YUKI.name)

      // Act
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))

      // Assert
      expect(
        await within(part('台帳の管理')).findByRole('alert'),
      ).toHaveTextContent(
        '終わっていない予約があるため、削除できませんでした。予約を完了、キャンセル、または削除してから、もう一度お試しください。',
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await isInLedger(yuki)).toBe(true)
    })

    it('should say in the dialog that the customer was not removed when the database fails, and keep them', async () => {
      // Arrange
      const user = userEvent.setup()
      await finishBookingsOf(KENJI.email)
      const kenji = await customerIdOf(KENJI.email)
      await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`)
      await theCustomer()
      const dialog = await askToRemove(user)
      await refuse('update', 'customers')

      // Act
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))

      // Assert
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'お客様を台帳から削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(dialog).toBeVisible()
      expect(await isInLedger(kenji)).toBe(true)
    })

    it('should show the customer as removed by another account when they were removed while the dialog asked', async () => {
      // Arrange
      const user = userEvent.setup()
      await finishBookingsOf(KENJI.email)
      const kenji = await customerIdOf(KENJI.email)
      await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`)
      await theCustomer()
      const dialog = await askToRemove(user)
      await removedMeanwhile(kenji, MANAGER)

      // Act
      await user.click(within(dialog).getByRole('button', { name: '削除する' }))

      // Assert
      await theRemoved()
      expect(await heading('お客様の台帳')).toHaveFocus()
      expect(
        screen.getByText(/ に、ほかのアカウントが台帳から削除しました。$/),
      ).toBeVisible()
      expect(notifications()).not.toContain(
        `${KENJI.name} 様を台帳から削除しました。`,
      )
    })

    it('should not bring back a customer whose address of mail a customer registered since has, and lead to that customer', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await removedMeanwhile(kenji, OWNER)
      await registeredMeanwhile(
        { lastName: 'Kobayashi', firstName: 'Ken', email: KENJI.email },
        MANAGER,
      )
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/customers/${kenji}`,
      )
      await theRemoved()

      // Act
      await user.click(screen.getByRole('button', { name: '台帳に戻す' }))

      // Assert
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        `このお客様のメールアドレス（${KENJI.email}）は、削除のあとに登録されたお客様が使っています。そのお客様のメールアドレスを変えてから、台帳に戻してください。`,
      )
      expect(await isInLedger(kenji)).toBe(false)

      // Act
      await user.click(
        within(alert).getByRole('link', { name: 'そのお客様を台帳で探す' }),
      )

      // Assert
      await heading('顧客台帳')
      expect(address()).toBe(
        `/salons/${tokyo}/customers?search=customer2%40example.com`,
      )
      expect(
        await screen.findByRole('link', { name: 'Kobayashi Ken' }),
      ).toBeVisible()
    })

    it('should show a customer who was brought back meanwhile when they are brought back again', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await removedMeanwhile(kenji, OWNER)
      await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`)
      await theRemoved()
      await restoredMeanwhile(kenji, MANAGER)

      // Act
      await user.click(screen.getByRole('button', { name: '台帳に戻す' }))

      // Assert
      await theCustomer()
      expect(notifications()).not.toContain(
        `${KENJI.name} 様を台帳に戻しました。`,
      )
    })

    it('should say that a customer who was merged into another cannot come back, and offer no way back', async () => {
      // Arrange
      const kenji = await customerIdOf(KENJI.email)
      await removedMeanwhile(kenji, OWNER, 'merge')

      // Act
      await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`)

      // Assert
      await theRemoved()
      expect(
        screen.getByText(/ に、あなたがほかのお客様に統合しました。$/),
      ).toBeVisible()
      expect(
        screen.getByText('ほかのお客様に統合されたため、台帳に戻せません。'),
      ).toBeVisible()
      expect(screen.queryByRole('button', { name: '台帳に戻す' })).toBeNull()
    })

    it('should say to an owner that no customer has an ID nobody has', async () => {
      // Act
      await openAt(
        (tokyo) =>
          `/salons/${tokyo}/customers/0b6e2f4a-8c1d-4e3f-9a5b-7c9d1e3f5a7b`,
      )

      // Assert
      await heading('お客様が見つかりません')
      expect(
        screen.getByText('アドレスが正しいか、お確かめください。'),
      ).toBeVisible()
    })
  })

  describe('the history of a customer and its versions', () => {
    it('should lead from the page to the history, name who made each version and the items it changed, and lead to a version and back', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await changedMeanwhile(kenji, MANAGER, {
        phoneNumber: '080-3333-4444',
        city: '渋谷区',
      })
      await changedMeanwhile(kenji, KENJI.email, {
        phoneNumber: '080-5555-6666',
        city: '渋谷区',
      })
      const tokyo = await openAt(
        (salon) => `/salons/${salon}/customers/${kenji}`,
      )
      await theCustomer()

      // Act
      await user.click(
        within(part('台帳の管理')).getByRole('link', { name: '変更履歴' }),
      )

      // Assert
      await heading('変更履歴')
      await screen.findByRole('table', { name: '版の一覧' })
      expect(address()).toBe(`/salons/${tokyo}/customers/${kenji}/history`)
      expect(versionsShown()).toEqual([
        ['版 3', '更新', 'お客様ご本人', '電話番号'],
        ['版 2', '更新', 'ほかのアカウント', '電話番号、住所'],
        ['版 1', '記録の開始', '', ''],
      ])
      expect(screen.getByText('3 件')).toBeVisible()
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(screen.getByRole('link', { name: '版 2' }))

      // Assert
      await heading('台帳の版')
      await screen.findByRole('table', { name: '前の版から変えた項目' })
      expect(address()).toBe(`/salons/${tokyo}/customers/${kenji}/history/2`)
      expect(
        screen.getByText(/^版 2・更新・.+・ほかのアカウント$/),
      ).toBeVisible()
      expect(
        rowsOf('前の版から変えた項目').map(([term, , after]) => [term, after]),
      ).toEqual([
        ['電話番号', '080-3333-4444'],
        ['住所', '〒105-0001 Tokyo渋谷区2-3-4 Minato'],
      ])
      expect(describedIn('この版の台帳')).toMatchObject({
        電話番号: '080-3333-4444',
      })
      expect(await findAccessibilityViolations(document.body)).toEqual([])

      // Act
      await user.click(screen.getByRole('link', { name: '変更履歴へ' }))

      // Assert
      await heading('変更履歴')
      expect(address()).toBe(`/salons/${tokyo}/customers/${kenji}/history`)
    })

    it('should show the history twenty versions at a time, and the next ones when asked', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await notesChangedMeanwhile(kenji, MANAGER, 21)
      await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}/history`)
      await screen.findByRole('table', { name: '版の一覧' })
      expect(versionsShown()).toHaveLength(20)
      expect(versionsShown()[0]).toEqual([
        '版 22',
        '更新',
        'ほかのアカウント',
        '備考',
      ])

      // Act
      await user.click(screen.getByRole('button', { name: 'さらに表示' }))

      // Assert
      await waitFor(() => expect(versionsShown()).toHaveLength(22))
      expect(versionsShown().at(-1)).toEqual(['版 1', '記録の開始', '', ''])
    })

    it('should show the history and the versions of a customer who left the ledger, from the page that keeps them', async () => {
      // Arrange
      const user = userEvent.setup()
      const kenji = await customerIdOf(KENJI.email)
      await removedMeanwhile(kenji, OWNER)
      await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`)
      await theRemoved()

      // Act
      await user.click(screen.getByRole('link', { name: '変更履歴' }))

      // Assert
      await screen.findByRole('table', { name: '版の一覧' })
      expect(versionsShown()).toEqual([
        ['版 2', '削除', 'あなた', ''],
        ['版 1', '記録の開始', '', ''],
      ])

      // Act
      await user.click(screen.getByRole('link', { name: '版 2' }))

      // Assert
      await heading('台帳の版')
      expect(await screen.findByText(/^版 2・削除・.+・あなた$/)).toBeVisible()
      expect(screen.queryByRole('table')).toBeNull()
      expect(describedIn('この版の台帳')).toMatchObject({ お名前: KENJI.name })
    })

    it('should say that the customer has no version of a number', async () => {
      // Arrange
      const kenji = await customerIdOf(KENJI.email)

      // Act
      await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}/history/9`)

      // Assert
      await heading('台帳の版')
      expect(
        await screen.findByText(
          'この番号の版はありません。アドレスが正しいか、お確かめください。',
        ),
      ).toBeVisible()
      expect(screen.getByRole('link', { name: '変更履歴へ' })).toBeVisible()
    })
  })

  describe('a member of the staff', () => {
    it('should be told on the page of a customer who removes customers and reads their history, and offered neither', async () => {
      // Act
      const yuki = await customerIdOf(YUKI.email)
      await openAt((tokyo) => `/salons/${tokyo}/customers/${yuki}`, STYLIST)
      await theCustomer()

      // Assert
      expect(within(part('台帳の管理')).getByText(KEPT)).toBeVisible()
      expect(within(part('台帳の管理')).queryByRole('button')).toBeNull()
      expect(within(part('台帳の管理')).queryByRole('link')).toBeNull()
    })

    it('should be told at the address of the history, as somebody passed it on, who reads it', async () => {
      // Act
      const yuki = await customerIdOf(YUKI.email)
      await openAt(
        (tokyo) => `/salons/${tokyo}/customers/${yuki}/history`,
        STYLIST,
      )

      // Assert
      await heading('変更履歴')
      expect(await screen.findByText(KEPT)).toBeVisible()
      expect(screen.queryByRole('table')).toBeNull()
    })

    it('should not be shown a customer who left the ledger, and not ask for a history the API refuses them', async () => {
      // Arrange
      const kenji = await customerIdOf(KENJI.email)
      await removedMeanwhile(kenji, OWNER)
      const fetched: MockInstance<typeof fetch> = vi.spyOn(globalThis, 'fetch')

      // Act
      await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`, STYLIST)

      // Assert
      await heading('お客様が見つかりません')
      expect(
        screen.getByText(
          'アドレスが正しいか、お確かめください。台帳から削除されたお客様は、表示できません。',
        ),
      ).toBeVisible()
      expect(
        asked(fetched).filter((line) =>
          line.includes(`/customers/${kenji}/history`),
        ),
      ).toEqual([])
    })
  })
})

describe('removing customers, bringing them back, and their history on a page in English, against the API', () => {
  /** Waits for the page of a customer, as a page in English names its parts. */
  const theCustomerInEnglish = async (): Promise<void> => {
    await heading('Customer record')
    await screen.findByRole('region', { name: 'Ledger' })
    await screen.findByRole('region', { name: 'Record keeping' })
  }

  /** Waits for the page of a customer who left the ledger, in English. */
  const theRemovedInEnglish = async (): Promise<void> => {
    await heading('Customer record')
    await screen.findByRole('region', { name: 'The record when removed' })
  }

  /** The rows of the history without the times, as a page in English shows them. */
  const versionsInEnglish = (): string[][] =>
    rowsOf('Versions').map(([version, operation, , changer, items]) => [
      version ?? '',
      operation ?? '',
      changer ?? '',
      items ?? '',
    ])

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('should remove a customer in English once the dialog asked, say who removed them, and bring them back', async () => {
    // Arrange
    const user = userEvent.setup()
    await finishBookingsOf(KENJI.email)
    const kenji = await customerIdOf(KENJI.email)
    await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`, OWNER, 'en')
    await theCustomerInEnglish()
    await user.click(
      within(part('Record keeping')).getByRole('button', {
        name: 'Remove from the ledger',
      }),
    )
    const dialog = screen.getByRole('dialog', {
      name: `Remove ${KENJI.name} from the ledger?`,
    })
    expect(dialog).toHaveAccessibleDescription(
      'The customer can no longer be chosen in the customer ledger and in bookings. Their bookings and sales are kept. They can be brought back to the ledger afterwards.',
    )

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    // Assert
    await theRemovedInEnglish()
    expect(notifications()).toContain(
      `${KENJI.name} was removed from the ledger.`,
    )
    expect(
      screen.getByText(/^You removed this customer from the ledger on .+\.$/),
    ).toBeVisible()
    expect(describedIn('The record when removed')).toMatchObject({
      Name: KENJI.name,
      'Email address': KENJI.email,
    })
    expect(await findAccessibilityViolations(document.body)).toEqual([])

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Bring back to the ledger' }),
    )

    // Assert
    await theCustomerInEnglish()
    expect(notifications()).toContain(
      `${KENJI.name} was brought back to the ledger.`,
    )
    expect(await isInLedger(kenji)).toBe(true)
  })

  it('should say in English beside the buttons that a customer with a booking that is not finished stays', async () => {
    // Arrange
    const user = userEvent.setup()
    const yuki = await customerIdOf(YUKI.email)
    await openAt((tokyo) => `/salons/${tokyo}/customers/${yuki}`, OWNER, 'en')
    await theCustomerInEnglish()
    await user.click(
      within(part('Record keeping')).getByRole('button', {
        name: 'Remove from the ledger',
      }),
    )

    // Act
    await user.click(
      within(
        screen.getByRole('dialog', {
          name: `Remove ${YUKI.name} from the ledger?`,
        }),
      ).getByRole('button', { name: 'Remove' }),
    )

    // Assert
    expect(
      await within(part('Record keeping')).findByRole('alert'),
    ).toHaveTextContent(
      'The customer has bookings that are not finished, so they could not be removed. Complete, cancel or delete those bookings, then try again.',
    )
    expect(await isInLedger(yuki)).toBe(true)
  })

  it('should say in English that a customer whose address of mail another customer took does not come back, and lead to that customer', async () => {
    // Arrange
    const user = userEvent.setup()
    const kenji = await customerIdOf(KENJI.email)
    await removedMeanwhile(kenji, OWNER)
    await registeredMeanwhile(
      { lastName: 'Kobayashi', firstName: 'Ken', email: KENJI.email },
      MANAGER,
    )
    await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`, OWNER, 'en')
    await theRemovedInEnglish()

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Bring back to the ledger' }),
    )

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      `A customer registered after the removal uses this customer's email address (${KENJI.email}). Change that customer's email address, then bring this one back to the ledger.`,
    )

    // Act
    await user.click(
      within(alert).getByRole('link', {
        name: 'Find that customer in the ledger',
      }),
    )

    // Assert
    await heading('Customer ledger')
    expect(
      await screen.findByRole('link', { name: 'Kobayashi Ken' }),
    ).toBeVisible()
  })

  it('should say in English that a customer who was merged into another cannot come back', async () => {
    // Arrange
    const kenji = await customerIdOf(KENJI.email)
    await removedMeanwhile(kenji, MANAGER, 'merge')

    // Act
    await openAt((tokyo) => `/salons/${tokyo}/customers/${kenji}`, OWNER, 'en')

    // Assert
    await theRemovedInEnglish()
    expect(
      screen.getByText(
        /^Another account merged this customer into another on .+\.$/,
      ),
    ).toBeVisible()
    expect(
      screen.getByText(
        'This customer was merged into another, so they cannot be brought back to the ledger.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Bring back to the ledger' }),
    ).toBeNull()
  })

  it('should show the history in English, name who made each version and the items it changed, and a version beside the one before', async () => {
    // Arrange
    const user = userEvent.setup()
    const kenji = await customerIdOf(KENJI.email)
    await changedMeanwhile(kenji, MANAGER, {
      phoneNumber: '080-3333-4444',
      city: '渋谷区',
    })
    await changedMeanwhile(kenji, KENJI.email, {
      phoneNumber: '080-5555-6666',
      city: '渋谷区',
    })
    await openAt(
      (tokyo) => `/salons/${tokyo}/customers/${kenji}/history`,
      OWNER,
      'en',
    )

    // Assert
    await heading('Change history')
    await screen.findByRole('table', { name: 'Versions' })
    expect(versionsInEnglish()).toEqual([
      ['Version 3', 'Updated', 'The customer', 'Phone number'],
      ['Version 2', 'Updated', 'Another account', 'Phone number, Address'],
      ['Version 1', 'Start of the record', '', ''],
    ])
    expect(screen.getByText('3 items')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Back to the customer' }),
    ).toBeVisible()
    expect(await findAccessibilityViolations(document.body)).toEqual([])

    // Act
    await user.click(screen.getByRole('link', { name: 'Version 2' }))

    // Assert
    await heading('Record version')
    await screen.findByRole('table', {
      name: 'Items changed from the version before',
    })
    expect(
      screen.getByText(/^Version 2 · Updated · .+ · Another account$/),
    ).toBeVisible()
    expect(
      rowsOf('Items changed from the version before').map(([term, , after]) => [
        term,
        after,
      ]),
    ).toEqual([
      ['Phone number', '080-3333-4444'],
      ['Address', '105-0001 Tokyo 渋谷区 2-3-4 Minato'],
    ])
    expect(describedIn('The record in this version')).toMatchObject({
      'Phone number': '080-3333-4444',
    })

    // Act
    await user.click(
      screen.getByRole('link', { name: 'Back to the change history' }),
    )

    // Assert
    await heading('Change history')
  })

  it('should say in English that the customer has no version of a number', async () => {
    // Arrange
    const kenji = await customerIdOf(KENJI.email)

    // Act
    await openAt(
      (tokyo) => `/salons/${tokyo}/customers/${kenji}/history/9`,
      OWNER,
      'en',
    )

    // Assert
    await heading('Record version')
    expect(
      await screen.findByText(
        'There is no version of this number. Check that the address is right.',
      ),
    ).toBeVisible()
  })

  it('should tell a member of the staff in English who removes customers and reads their history', async () => {
    // Arrange
    const yuki = await customerIdOf(YUKI.email)

    // Act
    await openAt(
      (tokyo) => `/salons/${tokyo}/customers/${yuki}/history`,
      STYLIST,
      'en',
    )

    // Assert
    await heading('Change history')
    expect(
      await screen.findByText(
        'Owners and managers remove customers from the ledger, merge them and read the change history.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
