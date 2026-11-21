import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as dialogStories from './alert-dialog.stories'

const stories = composeStories(dialogStories)

const GLOVES = 'ニトリル手袋 M（SUP-GLOVE）の在庫僅少を確認済みにしますか？'

const dialog = (name = GLOVES): HTMLElement =>
  screen.getByRole('dialog', { name })

const notes = (): HTMLElement => screen.getByRole('textbox', { name: 'メモ' })

/** The terms of the alert in the dialog, and what they say */
const terms = (): [string | null, string | null][] =>
  within(dialog())
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

describe('AlertDialog', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name the alert, say what an acknowledgement does and how long it holds, and what the notes are for', async () => {
    // Act
    await stories.OfAProduct.run()

    // Assert
    expect(dialog()).toHaveAccessibleDescription(
      'アラートを見て手を打ったことを、ほかのスタッフに伝えます。在庫が動くか、商品の最低在庫数や最大在庫数が変わって、アラートの状態が変わると、もう一度未確認になります。',
    )
    expect(terms()).toEqual([
      ['重要度', '緊急'],
      ['在庫数', '0 箱'],
      ['最低在庫数', '0 箱'],
    ])
    expect(notes()).toHaveAccessibleDescription(
      '任意。何をしたか、これから何をするかを書きます（発注した、廃棄する、など）。',
    )
  })

  it('should say the expiry of an alert of a stock row', async () => {
    // Act
    await stories.OfAStockRow.run()

    // Assert
    expect(
      dialog(
        'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）の期限切れを確認済みにしますか？',
      ),
    ).toBeVisible()
    expect(
      within(screen.getByRole('dialog'))
        .getAllByRole('term')
        .map((term) => term.nextElementSibling?.textContent),
    ).toEqual(['緊急', '2.5 本', '2025年12月31日'])
  })

  it('should send the notes', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.OfAProduct.run({
      args: {
        ...stories.OfAProduct.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.type(notes(), '10 箱を発注した。')

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '確認済みにする' }),
    )

    // Assert
    expect(received).toEqual([[['notes', '10 箱を発注した。']]])
    expect(stories.OfAProduct.args.onClose).not.toHaveBeenCalled()
  })

  it('should record nothing when the button that changes nothing is pressed', async () => {
    // Arrange
    await stories.OfAProduct.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.OfAProduct.args.onClose).toHaveBeenCalledTimes(1)
    expect(stories.OfAProduct.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should say in the dialog what may be tried again, and keep its button busy while the acknowledgement is on its way', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      'アラートを確認済みにできませんでした。通信の状態を確かめて、もう一度お試しください。',
    )

    // Act
    await stories.Acknowledging.run()

    // Assert
    expect(
      within(dialog()).getByRole('button', { name: '確認済みにする' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('should show nothing while it is closed', async () => {
    // Act
    await stories.Closed.run()

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
