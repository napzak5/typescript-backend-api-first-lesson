import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as saleVoidStories from './sale-void.stories'

const stories = composeStories(saleVoidStories)

const TITLE = '売上を取り消しますか？'

const dialog = () => screen.getByRole('dialog', { name: TITLE })
const reason = () =>
  within(dialog()).getByRole('textbox', { name: '取り消しの理由' })

type Sent = [string, FormDataEntryValue][]

describe('SaleVoid', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what a voiding is for, and ask nothing before the button is pressed', async () => {
    // Arrange
    const onOpen = vi.fn()
    await stories.Voidable.run({ args: { ...stories.Voidable.args, onOpen } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '売上を取り消す' }),
    )

    // Assert
    expect(
      screen.getByText(
        '誤って入れた売上や、支払いを全額返金して払い直す売上を、取り消します。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('should name the sale, say what follows, and ask why, the button that changes nothing first', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(dialog()).toHaveAccessibleDescription(
      '売上番号 SL-2KQM-9F4Hを取り消します。取り消した売上は、取り消しの記録として売上台帳に残り、直すことも支払いを受けることもできません。予約の会計は、入れ直せます。取り消しは、元に戻せません。',
    )
    expect(reason()).toBeRequired()
    expect(reason()).toHaveAccessibleDescription(
      '取り消した売上に残ります。あとで見る人に分かるように書きます。',
    )
    expect(
      within(dialog())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['戻る', '取り消す'])
  })

  it('should hand over the reason when the form is sent', async () => {
    // Arrange
    const received: Sent[] = []
    await stories.Asking.run({
      args: {
        ...stories.Asking.args,
        onVoid: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.type(reason(), '別のお客様の会計と取り違えた')
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    expect(received).toEqual([[['voidReason', '別のお客様の会計と取り違えた']]])
  })

  it('should send nothing while the voiding is on its way', async () => {
    // Arrange
    const onVoid = vi.fn()
    await stories.Pending.run({ args: { ...stories.Pending.args, onVoid } })

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    expect(onVoid).not.toHaveBeenCalled()
  })

  it('should say what is wrong with the reason, and take the focus to it', async () => {
    // Act
    await stories.WithError.run()

    // Assert
    expect(reason()).toHaveAccessibleDescription(
      expect.stringContaining('取り消しの理由を入力してください。'),
    )
    expect(reason()).toHaveFocus()
  })

  it('should say in the dialog what went wrong with the attempt', async () => {
    // Act
    await stories.WithMessage.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      '売上を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should say why a sale is not voided in place of the button', async () => {
    // Act
    await stories.NotVoidable.run()

    // Assert
    expect(
      screen.getByText(
        '受け取った支払いがあるため、このままでは取り消せません。取り消す前に、支払いをすべて全額返金してください。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
