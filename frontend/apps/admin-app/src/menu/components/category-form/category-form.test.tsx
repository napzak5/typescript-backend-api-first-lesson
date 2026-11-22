import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { colouring } from '../examples'
import * as categoryFormStories from './category-form.stories'

const stories = composeStories(categoryFormStories)

const parentChoices = (): (string | null)[] =>
  within(screen.getByRole('combobox', { name: '親カテゴリー' }))
    .getAllByRole('option')
    .map((option) => option.textContent)

describe('CategoryForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.New, () =>
    screen.getByRole('textbox', { name: '名前' }),
  )

  it('should open a new category at the top, switched on and last, and send what it holds', async () => {
    // Arrange
    const received: FormData[] = []
    await stories.New.run({
      args: {
        ...stories.New.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(values)
        }),
      },
    })

    // Act
    await userEvent.type(
      screen.getByRole('textbox', { name: /名前/ }),
      'ネイル',
    )
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /種類/ }),
      'その他',
    )
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '親カテゴリー' }),
      'カラー',
    )
    await userEvent.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(
      received.map((values) => [
        values.get('name'),
        values.get('category'),
        values.get('parentId'),
        values.get('displayOrder'),
        values.get('isActive'),
      ]),
    ).toEqual([['ネイル', 'other', colouring().id, '4', 'on']])
  })

  it('should offer the parents with the categories they are below, and none first', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(parentChoices()).toEqual([
      'なし（最上位のカテゴリー）',
      'カット',
      'カラー',
      'カラー › ハイライト',
    ])
  })

  it('should open with the category as it is', async () => {
    // Act
    await stories.Child.run()

    // Assert
    expect(screen.getByRole('textbox', { name: /名前/ })).toHaveValue(
      'ハイライト',
    )
    expect(screen.getByRole('combobox', { name: '親カテゴリー' })).toHaveValue(
      colouring().id,
    )
    expect(parentChoices()).not.toContain('カラー › ハイライト')
    expect(screen.getByRole('textbox', { name: '色' })).toHaveValue('#FFD93D')
    expect(screen.getByRole('checkbox', { name: '有効' })).not.toBeChecked()
  })

  it('should say at the controls what was refused', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('combobox', { name: '親カテゴリー' }),
    ).toHaveAccessibleDescription(
      /この親カテゴリーは、その間に削除されていました。/,
    )
    expect(
      screen.getByRole('textbox', { name: '色' }),
    ).toHaveAccessibleDescription(/# と 16 進数 6 桁で入力してください。/)
  })

  it('should say above the controls what went wrong', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'カテゴリーを保存できませんでした。',
    )
  })

  it.each<[string, string]>([
    ['名前', '100 文字まで。お客様のメニューの見出しになります。'],
    ['アイコンの URL', 'http:// か https:// で始まる URL。500 文字まで。'],
  ])('should say at %s how long it may be', async (label, description) => {
    // Act
    await stories.New.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: label }),
    ).toHaveAccessibleDescription(description)
  })
})
