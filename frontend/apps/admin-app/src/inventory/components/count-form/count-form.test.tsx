import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { countedControlOf } from '../../utils/stock-count'
import { colourLot, expiredColour, glovesRow, shampooRow } from '../examples'
import * as formStories from './count-form.stories'

const stories = composeStories(formStories)

const count = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

describe('CountForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Rows, () => count('ニトリル手袋 M'))

  it('should name every row by its product and lot, and say what the books hold of it', async () => {
    // Act
    await stories.Rows.run()

    // Assert
    expect(
      [
        'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）',
        'ヘアカラー ナチュラルブラウン（ロット LOT-2026-041）',
        'プロフェッショナル シャンプー 500ml',
        'ニトリル手袋 M',
        '理由',
      ].map((name) => count(name).getAttribute('name')),
    ).toEqual([
      countedControlOf(expiredColour.id),
      countedControlOf(colourLot.id),
      countedControlOf(shampooRow.id),
      countedControlOf(glovesRow.id),
      'reason',
    ])
    expect(screen.getAllByRole('textbox')).toHaveLength(5)
    expect(
      count('ヘアカラー ナチュラルブラウン（ロット LOT-2026-041）'),
    ).toHaveAccessibleDescription(
      '帳簿の在庫数 12 本、保管場所 バックヤード（棚 B-2）',
    )
    expect(
      count('プロフェッショナル シャンプー 500ml'),
    ).toHaveAccessibleDescription(
      '帳簿の在庫数 8 本（うち引き当て 2 本）、保管場所 店頭の棚',
    )
    expect(count('ニトリル手袋 M')).toHaveAccessibleDescription(
      '帳簿の在庫数 0 箱',
    )
    expect(count('ニトリル手袋 M')).not.toBeRequired()
    expect(count('ニトリル手袋 M')).toHaveValue('')
  })

  it('should hand over what was entered under the names of the rows', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Rows.run({
      args: {
        ...stories.Rows.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.type(count('プロフェッショナル シャンプー 500ml'), '9')
    await userEvent.type(
      screen.getByRole('textbox', { name: '理由' }),
      '月末の棚卸し',
    )
    await userEvent.click(screen.getByRole('button', { name: '記録する' }))

    // Assert
    expect(received.flat()).toEqual([
      [countedControlOf(expiredColour.id), ''],
      [countedControlOf(colourLot.id), ''],
      [countedControlOf(shampooRow.id), '9'],
      [countedControlOf(glovesRow.id), ''],
      ['reason', '月末の棚卸し'],
    ])
  })

  it('should say what is wrong under the rows, and move the focus to the first', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    const expired = count(
      'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）',
    )
    expect(expired).toHaveAccessibleDescription(
      /数えた数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。/,
    )
    expect(
      count('プロフェッショナル シャンプー 500ml'),
    ).toHaveAccessibleDescription(
      /引き当てた数の 2 本 を下回ります。引き当てた在庫も、数えた数に入れてください。/,
    )
    expect(expired).toHaveFocus()
  })

  it('should say above the form that the rows were read anew', async () => {
    // Act
    await stories.RowsChanged.run()

    // Assert
    expect(
      screen.getByText(
        '数えた在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。',
      ),
    ).toBeVisible()
  })
})
