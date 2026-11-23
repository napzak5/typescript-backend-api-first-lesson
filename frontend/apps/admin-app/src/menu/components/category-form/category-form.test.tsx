import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { colouring } from '../examples'
import * as categoryFormStories from './category-form.stories'

const stories = composeStories(categoryFormStories)

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
    expect(optionsOf('親カテゴリー')).toEqual([
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
    expect(optionsOf('親カテゴリー')).not.toContain('カラー › ハイライト')
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

describe('CategoryForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its controls and say what they take in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.New.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'Name' }),
    ).toHaveAccessibleDescription(
      'Up to 100 characters. It heads its part of the menu the customers see.',
    )
    const parent = screen.getByRole('combobox', { name: 'Parent category' })
    expect(parent).toHaveAccessibleDescription(
      'Puts this category below another category.',
    )
    expect(optionsOf(parent)).toEqual([
      'None (a top category)',
      'カット',
      'カラー',
      'カラー › ハイライト',
    ])
    expect(optionsOf(screen.getByRole('combobox', { name: /^Type/ }))).toEqual([
      'Choose',
      'Cut',
      'Color',
      'Perm',
      'Treatment',
      'Spa',
      'Styling',
      'Extensions',
      'Other',
    ])
    expect(
      screen.getByRole('textbox', { name: /^Display order/ }),
    ).toHaveAccessibleDescription(
      'A whole number of 0 or more. Smaller numbers come first.',
    )
    expect(
      screen.getByRole('textbox', { name: 'Color' }),
    ).toHaveAccessibleDescription(
      'A # and 6 hexadecimal digits, such as #C8A2C8.',
    )
    expect(
      screen.getByRole('textbox', { name: 'Icon URL' }),
    ).toHaveAccessibleDescription(
      'A URL that begins with http:// or https://. Up to 500 characters.',
    )
    expect(
      screen.getByRole('checkbox', { name: 'Active' }),
    ).toHaveAccessibleDescription(
      'When cleared, this heading no longer appears on the menu the customers see, and the services of this category are listed under “Other”.',
    )
  })

  it('should say in English what was refused, and what went wrong', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('combobox', { name: 'Parent category' }),
    ).toHaveAccessibleDescription(
      'Puts this category below another category. This parent category was removed meanwhile. Choose the parent again.',
    )
    expect(
      screen.getByRole('textbox', { name: 'Color' }),
    ).toHaveAccessibleDescription(
      'A # and 6 hexadecimal digits, such as #C8A2C8. Enter the color as a # and 6 hexadecimal digits, such as #C8A2C8.',
    )

    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The category could not be saved. Check your connection and try again.',
    )
  })
})
