import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import { heading, notifications } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OWNER,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../__tests__/screens'
import { customerHrefOf } from '../navigation'
import {
  askedForErasure,
  cancelledMeanwhile,
  customerIdOf,
  erasedMeanwhile,
  removedMeanwhile,
  storedErasureRequestsOf,
} from './__tests__/arrangements'

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

/** The part of the erasure, below the part of the requests. */
const erasure = (): HTMLElement =>
  screen.getByRole('region', { name: 'データの消去' })

const dialog = (name: string): HTMLElement =>
  screen.getByRole('dialog', { name })

/** What the part of the erasure describes, term by term. */
const described = (): Record<string, string> =>
  Object.fromEntries(
    within(erasure())
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
): Promise<string> => {
  const yuki = customerId ?? (await customerIdOf(YUKI.email))
  renderAt(customerHrefOf(await salonIdOf(TOKYO), yuki))
  await signInAs(email)
  await heading('お客様の台帳')
  await screen.findByRole('region', { name: 'ご本人からの請求' })

  return yuki
}

/** Waits for the request, or for none, in the part of the erasure. */
const theRequest = async (): Promise<void> => {
  await screen.findByRole('region', { name: 'データの消去' })
  await waitFor(() =>
    expect(
      within(erasure()).queryByText('消去の依頼を読み込んでいます'),
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
