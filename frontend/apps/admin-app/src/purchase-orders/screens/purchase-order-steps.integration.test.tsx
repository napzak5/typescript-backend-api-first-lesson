import { languageStore } from '@beauty-salon-frontend/io'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { dayFromToday, salonIdOf } from '@beauty-salon-frontend/testing/api'
import { firstSight, heading } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { displayNameOf } from '../../inventory/__tests__/arrangements'
import {
  orderChangeHrefOf,
  purchaseOrderHrefOf,
  purchaseOrdersHrefOf,
} from '../../navigation'
import {
  orderIdOf,
  orderMovedTo,
  storedOrderOf,
} from '../__tests__/arrangements'

/*
 * The status of a purchase order and what is written down on it as it
 * goes on, against the API. The salon in Tokyo of the seed data has two
 * orders (`__tests__/arrangements.ts`): PO-SEED-0001, waiting for
 * approval, with the notes 「定期補充」 and no day of delivery; and
 * PO-SEED-0002, placed with the supplier after an administrator approved
 * it, to be delivered in a week. Its owner and manager approve and cancel
 * orders; its stylist moves them on and writes on them. Somebody did
 * something meanwhile where a test says so.
 */

/** The address of an order of the salon in Tokyo, by its number */
const orderAt = async (orderNumber: string): Promise<string> =>
  purchaseOrderHrefOf(await salonIdOf(TOKYO), await orderIdOf(orderNumber))

/** Opens an order, and waits for its status. */
const openOrderAs = async (
  orderNumber: string,
  email: string,
): Promise<void> => {
  await openAs(await orderAt(orderNumber), email)
  await heading(`発注 ${orderNumber}`)
}

const STATUS = '状態'

const part = (): HTMLElement => screen.getByRole('region', { name: STATUS })

/** The buttons of the status, in their order */
const buttonsOf = (): string[] =>
  within(part())
    .queryAllByRole('button')
    .map((button) => button.textContent ?? '')

/** What the order says of a term: 「承認」 */
const termOf = (term: string): string | undefined =>
  within(screen.getByRole('region', { name: '発注' }))
    .getAllByRole('term')
    .find((each) => each.textContent === term)?.nextElementSibling
    ?.textContent ?? undefined

const dialog = (): HTMLElement => screen.getByRole('dialog')

const REASON = '取り消す理由'

const CHANGE = '納品予定日とメモを直す'

const SAVE = '変更を保存する'

const APPROVERS_ONLY =
  '発注を承認し、取り消せるのは、サロンのオーナーとマネージャーと、管理者です。'
const CANCELLED_BY_APPROVERS =
  '発注を取り消せるのは、サロンのオーナーとマネージャーと、管理者です。'
const CHANGED_ELSEWHERE =
  '発注のステータスが、ほかの画面か端末で変わっていました。いまの発注を読み込み直しました。'

describe('the status of a purchase order, and what is written down on it', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should let the stylist ask for the approval of a draft at once, and tell them who approves and cancels it', async () => {
    // Arrange
    const user = userEvent.setup()
    await orderMovedTo('PO-SEED-0001', 'draft')
    await openOrderAs('PO-SEED-0001', STYLIST)
    expect(within(part()).getByText('下書き')).toBeVisible()
    expect(buttonsOf()).toEqual(['承認を依頼する'])
    expect(within(part()).getByText(CANCELLED_BY_APPROVERS)).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: '承認を依頼する' }))

    // Assert
    expect(
      await screen.findByText('発注 PO-SEED-0001 の承認を依頼しました。'),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: STATUS })).toHaveFocus()
    expect(within(part()).getByText('承認待ち')).toBeVisible()
    expect(buttonsOf()).toEqual([])
    expect(within(part()).getByText(APPROVERS_ONLY)).toBeVisible()
    expect(await storedOrderOf('PO-SEED-0001')).toMatchObject({
      status: 'pending',
      approved: false,
    })
  })

  it('should let a manager approve an order that waits for it, name them as who approved it, and show it so in the list', async () => {
    // Arrange
    const user = userEvent.setup()
    const manager = await displayNameOf(MANAGER)
    await openAs(purchaseOrdersHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await user.click(await screen.findByRole('link', { name: 'PO-SEED-0001' }))
    await heading('発注 PO-SEED-0001')
    expect(within(part()).getByText('承認待ち')).toBeVisible()
    expect(buttonsOf()).toEqual(['承認する', '発注を取り消す'])
    expect(termOf('承認')).toBeUndefined()

    // Act
    await user.click(screen.getByRole('button', { name: '承認する' }))

    // Assert
    expect(
      await screen.findByText('発注 PO-SEED-0001 を承認しました。'),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: STATUS })).toHaveFocus()
    expect(within(part()).getByText('承認済み')).toBeVisible()
    expect(buttonsOf()).toEqual(['発注済みにする', '発注を取り消す'])
    expect(termOf('承認')).toMatch(new RegExp(`（${manager}）$`))
    expect(await storedOrderOf('PO-SEED-0001')).toMatchObject({
      status: 'approved',
      approvedBy: manager,
      approved: true,
    })

    // Act
    await user.click(screen.getByRole('link', { name: '発注へ' }))

    // Assert: the list that was read before is read anew, not shown as it was
    const row = await screen.findByRole('row', { name: /PO-SEED-0001/ })
    expect(within(row).getByText('承認済み')).toBeVisible()
    expect(firstSight()[0]).toBe(purchaseOrdersHrefOf(await salonIdOf(TOKYO)))
    expect(firstSight()[1]).toContain('発注を読み込んでいます')
  })

  it.each<
    [string, string, () => Promise<void>, string, string, string, string[]]
  >([
    [
      'an approved order to ordered',
      'PO-SEED-0001',
      () => orderMovedTo('PO-SEED-0001', 'approved'),
      '発注済みにする',
      '発注済み',
      'ordered',
      ['出荷済みにする'],
    ],
    [
      'an order placed with the supplier to shipped',
      'PO-SEED-0002',
      async () => undefined,
      '出荷済みにする',
      '出荷済み',
      'shipped',
      [],
    ],
  ])(
    'should let the stylist move %s at once',
    async (_, orderNumber, arrange, button, status, stored, buttons) => {
      // Arrange
      const user = userEvent.setup()
      await arrange()
      await openOrderAs(orderNumber, STYLIST)

      // Act
      await user.click(screen.getByRole('button', { name: button }))

      // Assert
      expect(
        await screen.findByText(`発注 ${orderNumber} を${status}にしました。`),
      ).toBeVisible()
      expect(screen.getByRole('heading', { name: STATUS })).toHaveFocus()
      expect(within(part()).getByText(status)).toBeVisible()
      expect(buttonsOf()).toEqual(buttons)
      expect(within(part()).getByText(CANCELLED_BY_APPROVERS)).toBeVisible()
      expect((await storedOrderOf(orderNumber)).status).toBe(stored)
    },
  )

  it('should let the owner cancel an order after asking for its reason, and write nothing on it any more', async () => {
    // Arrange
    const user = userEvent.setup()
    const reason = '仕入先の在庫切れ。別の仕入先に頼み直す。'
    await openOrderAs('PO-SEED-0002', OWNER)
    expect(buttonsOf()).toEqual(['出荷済みにする', '発注を取り消す'])
    expect(screen.getByRole('link', { name: CHANGE })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '発注を取り消す' }))
    expect(dialog()).toHaveAccessibleDescription(
      '発注 PO-SEED-0002 を取り消します。取り消した発注は、元に戻せません。',
    )

    // Act
    await user.click(within(dialog()).getByRole('button', { name: '取り消す' }))

    // Assert
    expect(
      within(dialog()).getByRole('textbox', { name: REASON }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('取り消す理由を入力してください。'),
    )
    expect((await storedOrderOf('PO-SEED-0002')).status).toBe('ordered')

    // Act
    await user.type(
      within(dialog()).getByRole('textbox', { name: REASON }),
      reason,
    )
    await user.click(within(dialog()).getByRole('button', { name: '取り消す' }))

    // Assert
    expect(
      await screen.findByText('発注 PO-SEED-0002 を取り消しました。'),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: STATUS })).toHaveFocus()
    expect(within(part()).getByText('取り消し')).toBeVisible()
    expect(buttonsOf()).toEqual([])
    expect(
      within(part()).getByText(
        'この発注は取り消しました。ステータスは、もう変わりません。',
      ),
    ).toBeVisible()
    expect(termOf('取り消した理由')).toBe(reason)
    expect(screen.queryByRole('link', { name: CHANGE })).toBeNull()
    expect(await storedOrderOf('PO-SEED-0002')).toMatchObject({
      status: 'cancelled',
      cancellationReason: reason,
    })
  })

  it('should let an administrator approve an order, naming nobody', async () => {
    // Arrange
    const user = userEvent.setup()
    await openOrderAs('PO-SEED-0001', OPERATOR)

    // Act
    await user.click(screen.getByRole('button', { name: '承認する' }))

    // Assert
    expect(
      await screen.findByText('発注 PO-SEED-0001 を承認しました。'),
    ).toBeVisible()
    expect(termOf('承認')).toMatch(/\d{2}:\d{2}$/)
    expect(await storedOrderOf('PO-SEED-0001')).toMatchObject({
      status: 'approved',
      approvedBy: null,
      approved: true,
    })
  })

  it.each<[string, 'approved' | 'cancelled', string, string[]]>([
    ['approved', 'approved', '承認済み', ['発注済みにする', '発注を取り消す']],
    ['cancelled', 'cancelled', '取り消し', []],
  ])(
    'should say that the order was %s meanwhile, and show it as it is now',
    async (_, meanwhile, status, buttons) => {
      // Arrange
      const user = userEvent.setup()
      await openOrderAs('PO-SEED-0001', MANAGER)
      await orderMovedTo('PO-SEED-0001', meanwhile)

      // Act
      await user.click(screen.getByRole('button', { name: '承認する' }))

      // Assert
      expect(await screen.findByText(CHANGED_ELSEWHERE)).toBeVisible()
      expect(screen.getByRole('heading', { name: STATUS })).toHaveFocus()
      expect(await within(part()).findByText(status)).toBeVisible()
      expect(buttonsOf()).toEqual(buttons)
      expect((await storedOrderOf('PO-SEED-0001')).status).toBe(meanwhile)
    },
  )

  it('should let the stylist change the day of the delivery and the notes, and clear what was made empty', async () => {
    // Arrange
    const user = userEvent.setup()
    const salonId = await salonIdOf(TOKYO)
    const id = await orderIdOf('PO-SEED-0001')
    const delivery = await dayFromToday(10)
    await openOrderAs('PO-SEED-0001', STYLIST)
    await user.click(screen.getByRole('link', { name: CHANGE }))
    await heading('発注を直す')
    const day = await screen.findByLabelText('納品予定日')
    expect(firstSight()[0]).toBe(orderChangeHrefOf(salonId, id))
    expect(day).toHaveValue('')
    expect(screen.getByRole('textbox', { name: '納品のメモ' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'メモ' })).toHaveValue(
      '定期補充',
    )

    // Act
    await user.type(day, delivery)
    await user.type(
      screen.getByRole('textbox', { name: '納品のメモ' }),
      '午前中に、裏口へ。',
    )
    await user.clear(screen.getByRole('textbox', { name: 'メモ' }))
    await user.click(screen.getByRole('button', { name: SAVE }))

    // Assert
    await heading('発注 PO-SEED-0001')
    expect(
      await screen.findByText('発注 PO-SEED-0001 を直しました。'),
    ).toBeVisible()
    expect(firstSight()[0]).toBe(purchaseOrderHrefOf(salonId, id))
    expect(termOf('納品予定日')).toBe(dayNameOf(delivery).ja)
    expect(termOf('納品のメモ')).toBe('午前中に、裏口へ。')
    expect(termOf('メモ')).toBe('記録なし')
    expect(await storedOrderOf('PO-SEED-0001')).toMatchObject({
      status: 'pending',
      expectedDelivery: delivery,
      deliveryNotes: '午前中に、裏口へ。',
      notes: null,
    })
  })

  it('should send nothing for a form left as it was opened', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedOrderOf('PO-SEED-0002')
    await openAs(
      orderChangeHrefOf(
        await salonIdOf(TOKYO),
        await orderIdOf('PO-SEED-0002'),
      ),
      STYLIST,
    )
    await screen.findByLabelText('納品予定日')

    // Act
    await user.click(screen.getByRole('button', { name: SAVE }))

    // Assert
    await heading('発注 PO-SEED-0002')
    expect(
      await screen.findByText('変更された項目はありません。'),
    ).toBeVisible()
    expect(await storedOrderOf('PO-SEED-0002')).toEqual(before)
  })

  it.each<['delivered' | 'cancelled', string]>([
    ['delivered', 'この発注は納品済みです。納品済みの発注は、直せません。'],
    ['cancelled', 'この発注は取り消しました。取り消した発注は、直せません。'],
  ])(
    'should say that a %s order is not changed, and offer no form',
    async (status, said) => {
      // Arrange
      await orderMovedTo('PO-SEED-0002', status)

      // Act
      await openAs(
        orderChangeHrefOf(
          await salonIdOf(TOKYO),
          await orderIdOf('PO-SEED-0002'),
        ),
        MANAGER,
      )

      // Assert
      expect(await screen.findByText(said)).toBeVisible()
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.getByRole('link', { name: '発注へ戻る' })).toHaveAttribute(
        'href',
        await orderAt('PO-SEED-0002'),
      )
    },
  )

  it('should say that the order was cancelled while it was being changed, and change nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      orderChangeHrefOf(
        await salonIdOf(TOKYO),
        await orderIdOf('PO-SEED-0002'),
      ),
      OWNER,
    )
    await user.type(
      await screen.findByRole('textbox', { name: 'メモ' }),
      '急ぎ',
    )
    await orderMovedTo('PO-SEED-0002', 'cancelled')

    // Act
    await user.click(screen.getByRole('button', { name: SAVE }))

    // Assert
    expect(
      await screen.findByText(
        'この発注は取り消しました。取り消した発注は、直せません。',
      ),
    ).toBeVisible()
    expect((await storedOrderOf('PO-SEED-0002')).notes).toBeNull()
  })

  it.each<[string, () => Promise<string>, string, string]>([
    [
      'an order to change at the address of another salon',
      async () =>
        orderChangeHrefOf(
          await salonIdOf(OSAKA),
          await orderIdOf('PO-SEED-0001'),
        ),
      OPERATOR,
      'アドレスが正しいか、お確かめください。',
    ],
    [
      'an order to change that is none',
      async () =>
        orderChangeHrefOf(
          await salonIdOf(TOKYO),
          '7d1c9a52-3e4f-4b6a-9c8d-1e2f3a4b5c6d',
        ),
      STYLIST,
      'アドレスが正しいか、お確かめください。',
    ],
  ])('should say what %s is', async (_, pathOf, email, said) => {
    // Act
    await openAs(await pathOf(), email)

    // Assert
    expect(await screen.findByText(said)).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it.each<[string, string, () => Promise<string>, () => Promise<void>]>([
    [
      'the status of an order waiting for approval',
      MANAGER,
      () => orderAt('PO-SEED-0001'),
      async () => {
        await heading('発注 PO-SEED-0001')
      },
    ],
    [
      'the cancellation, with what is wrong',
      OWNER,
      () => orderAt('PO-SEED-0002'),
      async () => {
        await heading('発注 PO-SEED-0002')
        await userEvent.click(
          screen.getByRole('button', { name: '発注を取り消す' }),
        )
        await userEvent.click(
          within(dialog()).getByRole('button', { name: '取り消す' }),
        )
        await waitFor(() =>
          expect(
            within(dialog()).getByRole('textbox', { name: REASON }),
          ).toBeInvalid(),
        )
      },
    ],
    [
      'the form of the day of the delivery and the notes',
      STYLIST,
      async () =>
        orderChangeHrefOf(
          await salonIdOf(TOKYO),
          await orderIdOf('PO-SEED-0002'),
        ),
      async () => {
        await screen.findByLabelText('納品予定日')
      },
    ],
  ])('should show %s accessibly', async (_, email, pathOf, opened) => {
    // Arrange
    await openAs(await pathOf(), email)
    await opened()

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})

describe('the status of a purchase order, and what is written down on it, on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  /** The part of the status of the order */
  const status = (): HTMLElement =>
    screen.getByRole('region', { name: 'Status' })

  /** What the order says of a term: 「Approved」 */
  const termIn = (term: string): string | undefined =>
    within(screen.getByRole('region', { name: 'Purchase order' }))
      .getAllByRole('term')
      .find((each) => each.textContent === term)?.nextElementSibling
      ?.textContent ?? undefined

  /** Opens an order, and waits for its status. */
  const openInEnglish = async (
    orderNumber: string,
    email: string,
  ): Promise<void> => {
    await openAs(await orderAt(orderNumber), email, 'en')
    await heading(`Purchase order ${orderNumber}`)
  }

  it('should let a manager approve an order that waits for it, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const manager = await displayNameOf(MANAGER)
    await openInEnglish('PO-SEED-0001', MANAGER)
    expect(within(status()).getByText('Awaiting approval')).toBeVisible()
    expect(
      within(status())
        .getAllByRole('button')
        .map(({ textContent }) => textContent),
    ).toEqual(['Approve', 'Cancel the order'])

    // Act
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    // Assert
    expect(
      await screen.findByText('Approved order PO-SEED-0001.'),
    ).toBeVisible()
    expect(within(status()).getByText('Approved')).toBeVisible()
    expect(termIn('Approved')).toMatch(
      new RegExp(` at \\d{2}:\\d{2} \\(${manager}\\)$`),
    )
  })

  it('should ask an owner for the reason of a cancellation, then cancel the order, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const reason = 'The supplier is out of stock.'
    await openInEnglish('PO-SEED-0002', OWNER)
    await user.click(screen.getByRole('button', { name: 'Cancel the order' }))
    const asked = screen.getByRole('dialog', { name: 'Cancel the order?' })
    expect(asked).toHaveAccessibleDescription(
      'Order PO-SEED-0002 will be cancelled. A cancelled order cannot be restored.',
    )

    // Act
    await user.click(
      within(asked).getByRole('button', { name: 'Cancel the order' }),
    )

    // Assert
    const box = within(asked).getByRole('textbox', {
      name: 'Reason for the cancellation',
    })
    expect(box).toHaveAccessibleDescription(
      expect.stringContaining('Enter the reason for the cancellation.'),
    )

    // Act
    await user.type(box, reason)
    await user.click(
      within(asked).getByRole('button', { name: 'Cancel the order' }),
    )

    // Assert
    expect(
      await screen.findByText('Cancelled order PO-SEED-0002.'),
    ).toBeVisible()
    expect(
      within(status()).getByText(
        'This order was cancelled. Its status does not change any more.',
      ),
    ).toBeVisible()
    expect(termIn('Reason for the cancellation')).toBe(reason)
  })

  it('should let the stylist change the day of the delivery and the notes, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    const delivery = await dayFromToday(10)
    await openInEnglish('PO-SEED-0001', STYLIST)
    expect(
      within(status()).getByText(
        'Only the owners and managers of the salon, and administrators, can approve and cancel orders.',
      ),
    ).toBeVisible()
    await user.click(
      screen.getByRole('link', {
        name: 'Edit the delivery date and the notes',
      }),
    )
    await heading('Edit the purchase order')
    const day = await screen.findByLabelText('Expected delivery')

    // Act
    await user.type(day, delivery)
    await user.type(
      screen.getByRole('textbox', { name: 'Delivery notes' }),
      'To the back door, in the morning.',
    )
    await user.clear(screen.getByRole('textbox', { name: 'Notes' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // Assert
    await heading('Purchase order PO-SEED-0001')
    expect(await screen.findByText('Saved order PO-SEED-0001.')).toBeVisible()
    expect(termIn('Expected delivery')).toBe(dayNameOf(delivery).en)
    expect(termIn('Delivery notes')).toBe('To the back door, in the morning.')
    expect(termIn('Notes')).toBe('Not recorded')
  })
})
