import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as orderStatusActionsStories from './order-status-actions.stories'

const stories = composeStories(orderStatusActionsStories)

const part = (): HTMLElement => screen.getByRole('region', { name: '状態' })

const buttonsOf = (): string[] =>
  within(part())
    .queryAllByRole('button')
    .map((button) => button.textContent ?? '')

const dialog = (): HTMLElement => screen.getByRole('dialog')

const REASON = '取り消す理由'

describe('OrderStatusActions', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the status of a draft, and offer to ask for its approval and to cancel it', async () => {
    // Act
    await stories.Draft.run()

    // Assert
    expect(within(part()).getByText('下書き')).toBeVisible()
    expect(buttonsOf()).toEqual(['承認を依頼する', '発注を取り消す'])
    expect(within(part()).queryByText(/できるのは/)).toBeNull()
  })

  it('should offer an approver to approve an order that waits for it', async () => {
    // Act
    await stories.Pending.run()

    // Assert
    expect(within(part()).getByText('承認待ち')).toBeVisible()
    expect(buttonsOf()).toEqual(['承認する', '発注を取り消す'])
  })

  it('should tell a stylist who approves an order that waits for it', async () => {
    // Act
    await stories.PendingForAStylist.run()

    // Assert
    expect(buttonsOf()).toEqual([])
    expect(
      within(part()).getByText(
        '発注を承認し、取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
  })

  it('should offer a stylist to record that an approved order was placed, and tell who cancels it', async () => {
    // Act
    await stories.ApprovedForAStylist.run()

    // Assert
    expect(within(part()).getByText('承認済み')).toBeVisible()
    expect(buttonsOf()).toEqual(['発注済みにする'])
    expect(
      within(part()).getByText(
        '発注を取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
  })

  it('should lead to the receipt of an order placed with the supplier, beside its other operations', async () => {
    // Act
    await stories.Ordered.run()

    // Assert
    expect(within(part()).getByText('発注済み')).toBeVisible()
    expect(buttonsOf()).toEqual(['出荷済みにする', '発注を取り消す'])
    expect(
      within(part()).getByRole('link', { name: '入荷を記録する' }),
    ).toHaveAttribute('href', '/salons/salon/purchase-orders/order/receive')
    // The cancellation, which cannot be undone, comes last
    const [link] = within(part()).getAllByRole('link')
    const [ship, cancel] = within(part()).getAllByRole('button')
    expect(ship?.compareDocumentPosition(link ?? part())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(link?.compareDocumentPosition(cancel ?? part())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('should lead a stylist to the receipt of a shipped order, and tell who cancels it', async () => {
    // Act
    await stories.ShippedForAStylist.run()

    // Assert
    expect(buttonsOf()).toEqual([])
    expect(
      within(part()).getByRole('link', { name: '入荷を記録する' }),
    ).toBeVisible()
    expect(
      within(part()).getByText(
        '発注を取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
  })

  it('should not lead to a receipt for an order whose goods are not received now', async () => {
    // Act
    await stories.Pending.run()

    // Assert
    expect(
      within(part()).queryByRole('link', { name: '入荷を記録する' }),
    ).toBeNull()
  })

  it('should say that a delivered order does not change', async () => {
    // Act
    await stories.Delivered.run()

    // Assert
    expect(within(part()).getByText('納品済み')).toBeVisible()
    expect(buttonsOf()).toEqual([])
    expect(
      within(part()).getByText(
        'この発注は納品済みです。ステータスは、もう変わりません。',
      ),
    ).toBeVisible()
  })

  it.each<[string, string]>([
    ['承認を依頼する', 'submit'],
    ['発注済みにする', 'order'],
  ])('should hand over %s at once, without a dialog', async (name, action) => {
    // Arrange
    const story =
      name === '承認を依頼する' ? stories.Draft : stories.ApprovedForAStylist
    await story.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name }))

    // Assert
    expect(story.args.onAct).toHaveBeenCalledWith(action)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should approve at once', async () => {
    // Arrange
    await stories.Pending.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '承認する' }))

    // Assert
    expect(stories.Pending.args.onAct).toHaveBeenCalledWith('approve')
  })

  it('should show that the approval is on its way, and not send it again', async () => {
    // Arrange
    await stories.Approving.run()
    const button = screen.getByRole('button', { name: '承認する' })

    // Act
    await userEvent.click(button)

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Approving.args.onAct).not.toHaveBeenCalled()
  })

  it('should ask first when the order is to be cancelled', async () => {
    // Arrange
    await stories.Draft.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '発注を取り消す' }),
    )

    // Assert
    expect(stories.Draft.args.onAsk).toHaveBeenCalledOnce()
    expect(stories.Draft.args.onAct).not.toHaveBeenCalled()
  })

  it('should ask for the reason of a cancellation, which cannot be undone', async () => {
    // Act
    await stories.AskingCancellation.run()

    // Assert
    expect(
      within(dialog()).getByRole('heading', { name: '発注を取り消しますか？' }),
    ).toBeVisible()
    expect(dialog()).toHaveAccessibleDescription(
      '発注 PO-7K3M-Q9TX を取り消します。取り消した発注は、元に戻せません。',
    )
    const reason = within(dialog()).getByRole('textbox', { name: REASON })
    expect(reason).toBeRequired()
    expect(reason).toHaveAccessibleDescription(
      '仕入先の在庫切れなど。理由は、発注の内容に残ります。',
    )
  })

  it('should say that the goods of a shipped order are to be settled with the supplier first', async () => {
    // Act
    await stories.AskingCancellationOfAShippedOrder.run()

    // Assert
    expect(dialog()).toHaveAccessibleDescription(
      '発注 PO-2H8R-W4VN を取り消します。出荷済みの発注です。返品の扱いを仕入先と決めてから取り消してください。取り消した発注は、元に戻せません。',
    )
  })

  it('should hand over the reason that was written', async () => {
    // Arrange
    await stories.AskingCancellation.run()

    // Act
    await userEvent.type(
      within(dialog()).getByRole('textbox', { name: REASON }),
      '仕入先の在庫切れ',
    )
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    const handed = vi
      .mocked(stories.AskingCancellation.args.onCancel ?? (() => undefined))
      .mock.calls.map(([values]) => Array.from(values.entries()))
    expect(handed).toEqual([[['cancellationReason', '仕入先の在庫切れ']]])
  })

  it('should say what is wrong with the reason at its control', async () => {
    // Act
    await stories.CancellationRefused.run()

    // Assert
    expect(
      within(dialog()).getByRole('textbox', { name: REASON }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('取り消す理由を入力してください。'),
    )
  })

  it('should say in the dialog that the cancellation was not sent', async () => {
    // Act
    await stories.CancellationUnsent.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      '発注を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should show that the cancellation is on its way, and not send it again', async () => {
    // Arrange
    await stories.Cancelling.run()
    const button = within(dialog()).getByRole('button', { name: '取り消す' })

    // Act
    await userEvent.click(button)

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Cancelling.args.onCancel).not.toHaveBeenCalled()
  })

  it('should close the dialog by its button that changes nothing', async () => {
    // Arrange
    await stories.AskingCancellation.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.AskingCancellation.args.onClose).toHaveBeenCalled()
    expect(stories.AskingCancellation.args.onCancel).not.toHaveBeenCalled()
  })
})

describe('OrderStatusActions on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name the status and the operations of a draft, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Draft.run()

    // Assert
    const region = screen.getByRole('region', { name: 'Status' })
    expect(within(region).getByText('Draft')).toBeVisible()
    expect(
      within(region)
        .getAllByRole('button')
        .map(({ textContent }) => textContent),
    ).toEqual(['Ask for approval', 'Cancel the order'])
  })

  it('should tell a stylist who approves and cancels an order, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.PendingForAStylist.run()

    // Assert
    expect(
      screen.getByText(
        'Only the owners and managers of the salon, and administrators, can approve and cancel orders.',
      ),
    ).toBeVisible()
  })

  it('should lead to the receipt of an order placed with the supplier, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Ordered.run()

    // Assert
    expect(
      screen.getByRole('link', { name: 'Record the receipt' }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button').map(({ textContent }) => textContent),
    ).toEqual(['Mark as shipped', 'Cancel the order'])
  })

  it('should ask for the reason of the cancellation of a shipped order, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.AskingCancellationOfAShippedOrder.run()

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Cancel the order?' })
    expect(dialog).toHaveAccessibleDescription(
      'Order PO-2H8R-W4VN will be cancelled. The order was shipped: agree with the supplier on the return of the goods before cancelling it. A cancelled order cannot be restored.',
    )
    expect(
      within(dialog).getByRole('textbox', {
        name: 'Reason for the cancellation',
      }),
    ).toHaveAccessibleDescription(
      'Such as the supplier being out of stock. The reason stays in the order details.',
    )
  })

  it('should say what is wrong with the cancellation, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.CancellationRefused.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('textbox', {
        name: 'Reason for the cancellation',
      }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('Enter the reason for the cancellation.'),
    )
  })
})
