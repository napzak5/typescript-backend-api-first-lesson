import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  giveBack,
  refuse,
  salonIdOf,
  signInAs,
  takeAway,
  whenAskedFor,
} from '@beauty-salon-frontend/testing/api'
import { heading, notifications } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import type { Locale } from '@beauty-salon-shared/i18n'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import { customerHrefOf } from '../../navigation'
import {
  askedForErasure,
  cancelledMeanwhile,
  customerIdOf,
  erasedMeanwhile,
  madeStaffMeanwhile,
  removedMeanwhile,
  storedErasureRequestsOf,
} from '../__tests__/arrangements'

/*
 * The customer whose requests these tests take and call off is Tanaka
 * Yuki of the seed data, who never asked. An owner answers; a manager, or
 * the operator of the platform, did something meanwhile.
 */

const ASK = '消去の依頼を受け付けますか？'

const CANCEL = '消去の依頼を取り消しますか？'

const REASON = '店頭で、ご本人から口頭でお申し出がありました。'

/** A moment at the salon, as the screens show one: 「2026年12月4日（金） 10:30」 */
const MOMENT = /^\d{4}年\d{1,2}月\d{1,2}日（.） \d{2}:\d{2}$/

/** The part of the erasure, below the part of the requests, as the page names it. */
const erasure = (name = 'データの消去'): HTMLElement =>
  screen.getByRole('region', { name })

const dialog = (name: string): HTMLElement =>
  screen.getByRole('dialog', { name })

/** What the part of the erasure describes, term by term. */
const described = (part = erasure()): Record<string, string> =>
  Object.fromEntries(
    within(part)
      .getAllByRole('term')
      .map((term) => [
        term.textContent ?? '',
        term.nextElementSibling?.textContent ?? '',
      ]),
  )

/**
 * Opens the page of Tanaka Yuki in the salon in Tokyo, signed in, and
 * waits for the part of the requests. A customer who left the ledger is
 * named by their ID, which is found only while they are in it.
 */
const openYuki = async (
  email = OWNER,
  customerId?: string,
  language: Locale = 'ja',
): Promise<string> => {
  const parts = PARTS[language]
  const yuki = customerId ?? (await customerIdOf(YUKI.email))
  renderAt(customerHrefOf(await salonIdOf(TOKYO), yuki))
  await signInAs(email, language)
  await heading(parts.customer)
  await screen.findByRole('region', { name: parts.requests })

  return yuki
}

/** What the page of a customer names the parts of the requests, in Japanese and in English */
const PARTS = {
  ja: {
    customer: 'お客様の台帳',
    requests: 'ご本人からの請求',
    erasure: 'データの消去',
    loading: '消去の依頼を読み込んでいます',
  },
  en: {
    customer: 'Customer record',
    requests: 'Requests from the customer',
    erasure: 'Erasure of the data',
    loading: 'Loading the request to erase the data',
  },
} satisfies Record<
  Locale,
  { customer: string; requests: string; erasure: string; loading: string }
>

/** Waits for the request, or for none, in the part of the erasure. */
const theRequest = async (language: Locale = 'ja'): Promise<void> => {
  const parts = PARTS[language]
  await screen.findByRole('region', { name: parts.erasure })
  await waitFor(() =>
    expect(
      within(erasure(parts.erasure)).queryByText(parts.loading),
    ).toBeNull(),
  )
}

describe('the requests of a customer to have their data erased, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should take a request with its reason, and show from when the data is erased', async () => {
    // Arrange
    const user = userEvent.setup()
    const yuki = await openYuki()
    await theRequest()
    await user.click(
      within(erasure()).getByRole('button', {
        name: '消去の依頼を受け付ける',
      }),
    )

    // Act
    await user.type(
      within(dialog(ASK)).getByRole('textbox', { name: '依頼の理由' }),
      REASON,
    )
    await user.click(
      within(dialog(ASK)).getByRole('button', { name: '受け付ける' }),
    )

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const shown = described()
    const scheduled = (shown['消去の予定'] ?? '').replace(/ 以降$/, '')
    expect(shown['受け付けた日時']).toMatch(MOMENT)
    expect(scheduled).toMatch(MOMENT)
    expect(shown['依頼の理由']).toBe(REASON)
    expect(notifications()).toContain(
      `Tanaka Yuki 様のデータの消去の依頼を受け付けました。${scheduled} 以降に消去します。`,
    )
    expect(
      screen.getByRole('heading', { level: 3, name: 'データの消去' }),
    ).toHaveFocus()
    expect(
      within(erasure()).getByRole('button', { name: '依頼を取り消す' }),
    ).toBeVisible()
    expect(await storedErasureRequestsOf(yuki)).toEqual([
      {
        status: 'pending',
        reason: REASON,
        requestedBy: OWNER,
        cancelledBy: null,
        hours: 336,
      },
    ])
  })

  it.each<[string, string, string]>([
    ['of blanks alone', '   ', '依頼の理由を入力してください。'],
    [
      'longer than 1,000 characters',
      'あ'.repeat(1_001),
      '依頼の理由は、1,000 文字以内で入力してください。',
    ],
  ])(
    'should send no reason %s, and say so under it',
    async (_, written, error) => {
      // Arrange
      const user = userEvent.setup()
      const yuki = await openYuki()
      await theRequest()
      await user.click(
        within(erasure()).getByRole('button', {
          name: '消去の依頼を受け付ける',
        }),
      )
      const reason = within(dialog(ASK)).getByRole('textbox', {
        name: '依頼の理由',
      })
      await user.click(reason)
      await user.paste(written)

      // Act
      await user.click(
        within(dialog(ASK)).getByRole('button', { name: '受け付ける' }),
      )

      // Assert
      expect(reason).toBeInvalid()
      expect(reason).toHaveAccessibleDescription(expect.stringContaining(error))
      expect(reason).toHaveFocus()
      expect(await storedErasureRequestsOf(yuki)).toEqual([])
    },
  )

  it('should say in the dialog that the request was not taken when the database fails, and keep the reason', async () => {
    // Arrange
    const user = userEvent.setup()
    const yuki = await openYuki()
    await theRequest()
    await refuse('insert', 'customer_deletion_requests')
    await user.click(
      within(erasure()).getByRole('button', {
        name: '消去の依頼を受け付ける',
      }),
    )
    await user.type(
      within(dialog(ASK)).getByRole('textbox', { name: '依頼の理由' }),
      REASON,
    )

    // Act
    await user.click(
      within(dialog(ASK)).getByRole('button', { name: '受け付ける' }),
    )

    // Assert
    expect(await within(dialog(ASK)).findByRole('alert')).toHaveTextContent(
      '消去の依頼を受け付けられませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(
      within(dialog(ASK)).getByRole('textbox', { name: '依頼の理由' }),
    ).toHaveValue(REASON)
    expect(await storedErasureRequestsOf(yuki)).toEqual([])
  })

  it('should say that the account may not read the request when its role changed as it was asked for', async () => {
    // Arrange
    const yuki = await customerIdOf(YUKI.email)
    whenAskedFor(`GET /customers/${yuki}/deletion-request`, () =>
      madeStaffMeanwhile(OWNER),
    )

    // Act
    await openYuki(OWNER, yuki)

    // Assert
    expect(
      await within(
        await screen.findByRole('region', { name: 'データの消去' }),
      ).findByRole('alert'),
    ).toHaveTextContent('このアカウントでは、消去の依頼を読み込めません。')
  })

  it('should say that the request could not be read, and show it when asked again', async () => {
    // Arrange
    const user = userEvent.setup()
    await takeAway('customer_deletion_requests')
    await openYuki()
    expect(
      await within(
        await screen.findByRole('region', { name: 'データの消去' }),
      ).findByRole('alert'),
    ).toHaveTextContent(
      '消去の依頼を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    await giveBack('customer_deletion_requests')

    // Act
    await user.click(
      within(erasure()).getByRole('button', { name: 'もう一度読み込む' }),
    )

    // Assert
    expect(
      await within(erasure()).findByRole('button', {
        name: '消去の依頼を受け付ける',
      }),
    ).toBeVisible()
    expect(within(erasure()).queryByRole('alert')).toBeNull()
  })

  it('should close the dialog and say so when another account took a request meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const yuki = await openYuki()
    await theRequest()
    await user.click(
      within(erasure()).getByRole('button', {
        name: '消去の依頼を受け付ける',
      }),
    )
    await user.type(
      within(dialog(ASK)).getByRole('textbox', { name: '依頼の理由' }),
      REASON,
    )
    await askedForErasure(YUKI.email, MANAGER)

    // Act
    await user.click(
      within(dialog(ASK)).getByRole('button', { name: '受け付ける' }),
    )

    // Assert
    expect(
      await within(erasure()).findByText(
        'その間に、ほかのアカウントがこのお客様の消去の依頼を受け付けていました。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(described()['依頼の理由']).toBe('ご本人からのお申し出'),
    )
    expect(
      screen.getByRole('heading', { level: 3, name: 'データの消去' }),
    ).toHaveFocus()
    expect(await storedErasureRequestsOf(yuki)).toMatchObject([
      { status: 'pending', requestedBy: MANAGER },
    ])
  })

  it('should call off a pending request after asking, and take a new one', async () => {
    // Arrange
    const user = userEvent.setup()
    await askedForErasure(YUKI.email, MANAGER)
    const yuki = await openYuki()
    await theRequest()
    await user.click(
      within(erasure()).getByRole('button', { name: '依頼を取り消す' }),
    )

    // Act
    await user.click(
      within(dialog(CANCEL)).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    expect(
      await within(erasure()).findByText(
        /に受け付けた依頼は、.*に取り消しました。$/,
      ),
    ).toBeVisible()
    expect(notifications()).toContain(
      'Tanaka Yuki 様のデータの消去の依頼を取り消しました。',
    )
    expect(
      screen.getByRole('heading', { level: 3, name: 'データの消去' }),
    ).toHaveFocus()
    expect(
      within(erasure()).getByRole('button', {
        name: '消去の依頼を受け付ける',
      }),
    ).toBeVisible()
    expect(await storedErasureRequestsOf(yuki)).toMatchObject([
      { status: 'cancelled', requestedBy: MANAGER, cancelledBy: OWNER },
    ])
  })

  it('should leave the request pending when the dialog is closed from its button that changes nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await askedForErasure(YUKI.email, MANAGER)
    const yuki = await openYuki()
    await theRequest()
    await user.click(
      within(erasure()).getByRole('button', { name: '依頼を取り消す' }),
    )

    // Act
    await user.click(
      within(dialog(CANCEL)).getByRole('button', { name: '戻る' }),
    )

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await storedErasureRequestsOf(yuki)).toMatchObject([
      { status: 'pending' },
    ])
  })

  it('should say so, and show the request as it is, when it was called off meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await askedForErasure(YUKI.email, MANAGER)
    const yuki = await openYuki()
    await theRequest()
    await cancelledMeanwhile(yuki, MANAGER)
    await user.click(
      within(erasure()).getByRole('button', { name: '依頼を取り消す' }),
    )

    // Act
    await user.click(
      within(dialog(CANCEL)).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    expect(
      await within(erasure()).findByText(
        'この依頼は、その間に取り消されたか、消去が実行されていました。',
      ),
    ).toBeVisible()
    expect(
      await within(erasure()).findByText(/に取り消しました。$/),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 3, name: 'データの消去' }),
    ).toHaveFocus()
  })

  it('should show the customer as erased when the request was run meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await askedForErasure(YUKI.email, MANAGER)
    const yuki = await openYuki()
    await theRequest()
    await erasedMeanwhile(yuki, OPERATOR)
    await user.click(
      within(erasure()).getByRole('button', { name: '依頼を取り消す' }),
    )

    // Act
    await user.click(
      within(dialog(CANCEL)).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    expect(
      await screen.findByText(/が削除の依頼で消去しました。$/),
    ).toBeVisible()
    expect(
      await within(erasure()).findByText(
        /にデータを消去しました。消去したことを、ご本人にお知らせください。$/,
      ),
    ).toBeVisible()
  })

  it('should show the customer as removed when another account removed them before the request was taken', async () => {
    // Arrange
    const user = userEvent.setup()
    const yuki = await openYuki()
    await theRequest()
    await removedMeanwhile(yuki, MANAGER)
    await user.click(
      within(erasure()).getByRole('button', {
        name: '消去の依頼を受け付ける',
      }),
    )
    await user.type(
      within(dialog(ASK)).getByRole('textbox', { name: '依頼の理由' }),
      REASON,
    )

    // Act
    await user.click(
      within(dialog(ASK)).getByRole('button', { name: '受け付ける' }),
    )

    // Assert
    expect(
      await screen.findByRole('region', { name: '削除されたときの台帳' }),
    ).toBeVisible()
    expect(await heading('お客様の台帳')).toHaveFocus()
    expect(await storedErasureRequestsOf(yuki)).toEqual([])
  })

  it('should call off the pending request of a customer who left the ledger, and take none of theirs', async () => {
    // Arrange
    const user = userEvent.setup()
    const yuki = await customerIdOf(YUKI.email)
    await askedForErasure(YUKI.email, OWNER)
    await removedMeanwhile(yuki, MANAGER)
    await openYuki(OWNER, yuki)
    await screen.findByRole('region', { name: '削除されたときの台帳' })
    await theRequest()
    expect(
      screen.queryByRole('button', { name: 'データを出力する' }),
    ).toBeNull()
    await user.click(
      within(erasure()).getByRole('button', { name: '依頼を取り消す' }),
    )

    // Act
    await user.click(
      within(dialog(CANCEL)).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    expect(
      await within(erasure()).findByText(/に取り消しました。$/),
    ).toBeVisible()
    expect(
      within(erasure()).queryByRole('button', {
        name: '消去の依頼を受け付ける',
      }),
    ).toBeNull()
    expect(await storedErasureRequestsOf(yuki)).toMatchObject([
      { status: 'cancelled', cancelledBy: OWNER },
    ])
  })

  it('should say of an erased customer that the data was erased, and that they are to be told', async () => {
    // Arrange
    const yuki = await customerIdOf(YUKI.email)
    await askedForErasure(YUKI.email, OWNER)
    await erasedMeanwhile(yuki, OPERATOR)

    // Act
    await openYuki(OWNER, yuki)
    await theRequest()

    // Assert
    expect(
      within(erasure()).getByText(
        /に受け付けた依頼により、.*にデータを消去しました。消去したことを、ご本人にお知らせください。$/,
      ),
    ).toBeVisible()
    expect(within(erasure()).queryByRole('button')).toBeNull()
  })

  it('should take no request from a member of the staff, and tell them who answers', async () => {
    // Act
    await openYuki(STYLIST)

    // Assert
    expect(
      within(
        screen.getByRole('region', { name: 'ご本人からの請求' }),
      ).getByText(
        'ご本人からのデータの開示と消去の請求には、オーナーとマネージャーが応えます。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('region', { name: 'データの消去' })).toBeNull()
  })

  it('should have no accessibility violations on a pending request with the dialog that calls it off', async () => {
    // Arrange
    const user = userEvent.setup()
    await askedForErasure(YUKI.email, MANAGER)
    await openYuki()
    await theRequest()
    await user.click(
      within(erasure()).getByRole('button', { name: '依頼を取り消す' }),
    )
    dialog(CANCEL)

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })

  it('should have no accessibility violations on the dialog that says what is wrong with the reason', async () => {
    // Arrange
    const user = userEvent.setup()
    await openYuki()
    await theRequest()
    await user.click(
      within(erasure()).getByRole('button', {
        name: '消去の依頼を受け付ける',
      }),
    )
    await user.click(
      within(dialog(ASK)).getByRole('button', { name: '受け付ける' }),
    )
    await within(dialog(ASK)).findByText('依頼の理由を入力してください。')

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})

describe('the requests of a customer to have their data erased on a page in English, against the API', () => {
  /** A moment at the salon, as a page in English shows one: "Fri, December 4, 2026 at 10:30" */
  const MOMENT_IN_ENGLISH =
    /^[A-Z][a-z]{2}, [A-Z][a-z]+ \d{1,2}, \d{4} at \d{2}:\d{2}$/

  const ERASURE = 'Erasure of the data'

  const ASK_IN_ENGLISH = 'Take the request to erase the data?'

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should take a request with its reason in English, and show from when the data is erased', async () => {
    // Arrange
    const user = userEvent.setup()
    await openYuki(OWNER, undefined, 'en')
    await theRequest('en')
    await user.click(
      within(erasure(ERASURE)).getByRole('button', {
        name: 'Take a request to erase the data',
      }),
    )
    expect(dialog(ASK_IN_ENGLISH)).toHaveAccessibleDescription(
      `The request to erase the data of ${YUKI.name} will be taken. It can be cancelled for 14 days after it is taken.`,
    )

    // Act
    await user.type(
      within(dialog(ASK_IN_ENGLISH)).getByRole('textbox', {
        name: 'Reason for the request',
      }),
      'Asked in person at the counter.',
    )
    await user.click(
      within(dialog(ASK_IN_ENGLISH)).getByRole('button', {
        name: 'Take the request',
      }),
    )

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const shown = described(erasure(ERASURE))
    const scheduled = (shown['To be erased'] ?? '').replace(/^On or after /, '')
    expect(shown['Taken']).toMatch(MOMENT_IN_ENGLISH)
    expect(scheduled).toMatch(MOMENT_IN_ENGLISH)
    expect(shown['Reason for the request']).toBe(
      'Asked in person at the counter.',
    )
    expect(notifications()).toContain(
      `The request to erase the data of ${YUKI.name} was taken. The data will be erased on or after ${scheduled}.`,
    )
    expect(
      within(erasure(ERASURE)).getByRole('button', {
        name: 'Cancel the request',
      }),
    ).toBeVisible()
  })

  it('should send no reason of blanks alone, and say so in English under it', async () => {
    // Arrange
    const user = userEvent.setup()
    await openYuki(OWNER, undefined, 'en')
    await theRequest('en')
    await user.click(
      within(erasure(ERASURE)).getByRole('button', {
        name: 'Take a request to erase the data',
      }),
    )
    const reason = within(dialog(ASK_IN_ENGLISH)).getByRole('textbox', {
      name: 'Reason for the request',
    })
    await user.click(reason)
    await user.paste('   ')

    // Act
    await user.click(
      within(dialog(ASK_IN_ENGLISH)).getByRole('button', {
        name: 'Take the request',
      }),
    )

    // Assert
    expect(reason).toBeInvalid()
    expect(reason).toHaveAccessibleDescription(
      expect.stringContaining('Enter the reason for the request.'),
    )
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })

  it('should call off a pending request in English after asking', async () => {
    // Arrange
    const user = userEvent.setup()
    await askedForErasure(YUKI.email, MANAGER)
    await openYuki(OWNER, undefined, 'en')
    await theRequest('en')
    await user.click(
      within(erasure(ERASURE)).getByRole('button', {
        name: 'Cancel the request',
      }),
    )
    const cancel = dialog('Cancel the request to erase the data?')
    expect(cancel).toHaveAccessibleDescription(
      `The data of ${YUKI.name} will not be erased. Cancel a request when the customer withdraws it, or when it was taken by mistake.`,
    )

    // Act
    await user.click(within(cancel).getByRole('button', { name: 'Cancel it' }))

    // Assert
    expect(
      await within(erasure(ERASURE)).findByText(
        /^The request taken on .+ was cancelled on .+\.$/,
      ),
    ).toBeVisible()
    expect(notifications()).toContain(
      `The request to erase the data of ${YUKI.name} was cancelled.`,
    )
  })

  it('should say in English of an erased customer that the data was erased, and that they are to be told', async () => {
    // Arrange
    const yuki = await customerIdOf(YUKI.email)
    await askedForErasure(YUKI.email, OWNER)
    await erasedMeanwhile(yuki, OPERATOR)

    // Act
    await openYuki(OWNER, yuki, 'en')
    await theRequest('en')

    // Assert
    expect(
      within(erasure(ERASURE)).getByText(
        /^The data was erased on .+, on the request taken on .+\. Let the customer know that the data was erased\.$/,
      ),
    ).toBeVisible()
  })
})
