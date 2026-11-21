import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { aDiscountedColour, aService } from '../examples'
import * as serviceFormStories from './service-form.stories'

const stories = composeStories(serviceFormStories)

const group = (name: string): HTMLElement => screen.getByRole('group', { name })

const box = (name: string): HTMLElement =>
  screen.getByRole('checkbox', { name })

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const choice = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const valueIn = (control: HTMLElement): string | undefined =>
  'value' in control && typeof control.value === 'string'
    ? control.value
    : undefined

const checkedOf = (control: HTMLElement): boolean | undefined =>
  'checked' in control && typeof control.checked === 'boolean'
    ? control.checked
    : undefined

/** What the controls of an option hold, the boxes last */
const optionOf = (place: number): (string | boolean | undefined)[] => {
  const option = within(group(`オプション ${place}`))

  return [
    ...[
      option.getByRole('textbox', { name: '名前' }),
      option.getByRole('combobox', { name: '種類' }),
      option.getByRole('textbox', { name: '選べる数' }),
      option.getByRole('textbox', { name: '追加の時間（分）' }),
      option.getByRole('textbox', { name: '追加の料金' }),
      option.getByRole('textbox', { name: '説明' }),
    ].map(valueIn),
    checkedOf(option.getByRole('checkbox', { name: '必須' })),
    checkedOf(option.getByRole('checkbox', { name: '有効' })),
  ]
}

/** The services the rows of the package chose */
const packagedOf = (): string[] =>
  screen
    .queryAllByRole('group', { name: /^構成サービス \d+$/ })
    .map(
      (row) =>
        valueIn(within(row).getByRole('combobox', { name: 'サービス' })) ?? '',
    )

describe('ServiceForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.New, () =>
    screen.getByRole('textbox', { name: '名前' }),
  )

  it('should open a new service of no category, switched on, given every day, booked online, last in the menu', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(text('名前')).toHaveValue('')
    expect(text('名前')).toBeRequired()
    expect(choice('カテゴリー')).toHaveValue('')
    expect(text('表示順')).toHaveValue('4')
    expect(choice('価格の決め方')).toHaveValue('fixed')
    expect(box('税込')).toBeChecked()
    expect(box('有効')).toBeChecked()
    expect(choice('提供の状態')).toHaveValue('active')
    expect(choice('提供日')).toHaveValue('always')
    expect(box('オンライン予約を受ける')).toBeChecked()
    expect(box('カウンセリングが要る')).not.toBeChecked()
    expect(choice('担当できるスタッフ')).toHaveValue('')
    expect(box('パッケージにする')).not.toBeChecked()
    expect(packagedOf()).toEqual([])
    expect(screen.queryByRole('group', { name: /^オプション \d+$/ })).toBeNull()
  })

  it('should open with what the service holds', async () => {
    // Act
    await stories.Opened.run()

    // Assert
    const colour = aDiscountedColour()
    expect(text('名前')).toHaveValue('フルカラー')
    expect(choice('カテゴリー')).toHaveValue(colour.categoryId)
    expect(text('所要時間（分）')).toHaveValue('120')
    expect(text('料金')).toHaveValue('8000')
    expect(text('割引後の料金')).toHaveValue('7200')
    expect(box('税込')).not.toBeChecked()
    expect(choice('価格の決め方')).toHaveValue('variable')
    expect(choice('提供日')).toHaveValue('weekdays_only')
    expect(box('オンライン予約を受ける')).not.toBeChecked()
    expect(box('カウンセリングが要る')).toBeChecked()
    expect(choice('担当できるスタッフ')).toHaveValue('senior')
    expect(text('1 日の予約の上限')).toHaveValue('4')
    expect(box('パッチテスト必須')).toBeChecked()
    expect(box('デポジット必須')).toBeChecked()
    expect(box('事前予約必須')).not.toBeChecked()
  })

  it('should name a category of the choices with the categories it is below', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(
      within(choice('カテゴリー'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['未分類', 'カット', 'カラー', 'カラー › ハイライト'])
    expect(
      within(choice('担当できるスタッフ'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'すべてのスタッフ',
      'ジュニア以上',
      'スタイリスト以上',
      'シニア以上',
      'エキスパート以上',
      'ディレクター以上',
    ])
  })

  it('should open the options of a service, a row each, with what each holds', async () => {
    // Act
    await stories.InAPackage.run()

    // Assert
    expect(optionOf(1)).toEqual([
      '前髪カット',
      'addon',
      '1',
      '10',
      '1100',
      '',
      false,
      true,
    ])
  })

  it('should offer no box that makes a package to a service a package is made of, and say which package', async () => {
    // Act
    await stories.InAPackage.run()

    // Assert
    expect(
      screen.queryByRole('checkbox', { name: 'パッケージにする' }),
    ).toBeNull()
    expect(
      screen.getByText(
        'このサービスは、パッケージ「カットとカラー」に入っているので、パッケージにできません。',
      ),
    ).toBeInTheDocument()
  })

  it('should open a package with its services a row each, offering the services that are no package', async () => {
    // Act
    await stories.Package.run()

    // Assert
    expect(box('パッケージにする')).toBeChecked()
    expect(packagedOf()).toEqual([aService().id, aDiscountedColour().id])
    expect(
      within(group('構成サービス 1'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['選んでください', 'カット', 'フルカラー'])
  })

  it('should give two rows to choose in when the box that makes a package is checked, and none once it is cleared', async () => {
    // Arrange
    await stories.New.run()

    // Act
    await userEvent.click(box('パッケージにする'))

    // Assert
    expect(packagedOf()).toEqual(['', ''])
    expect(
      within(group('構成サービス 1')).getByRole('combobox', {
        name: 'サービス',
      }),
    ).toBeRequired()

    // Act
    await userEvent.click(box('パッケージにする'))

    // Assert
    expect(packagedOf()).toEqual([])
    expect(
      screen.queryByRole('button', { name: '構成サービスを足す' }),
    ).toBeNull()
  })

  it('should add an option at the end with what an option is at first, and give its name the focus', async () => {
    // Arrange
    await stories.InAPackage.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'オプションを足す' }),
    )

    // Assert
    expect(optionOf(2)).toEqual(['', 'addon', '1', '0', '0', '', false, true])
    expect(
      within(group('オプション 2')).getByRole('textbox', { name: '名前' }),
    ).toHaveFocus()
  })

  it('should take a service of the package away, keep what the others chose, and give the focus to the button that adds one', async () => {
    // Arrange
    await stories.Package.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '構成サービス 1 を外す' }),
    )

    // Assert
    expect(packagedOf()).toEqual([aDiscountedColour().id])
    expect(
      screen.getByRole('button', { name: '構成サービスを足す' }),
    ).toHaveFocus()
  })

  it('should send the options and the services of the package by the numbers of their rows, with the rest of the service', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Package.run({
      args: {
        ...stories.Package.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'オプションを足す' }),
    )
    await userEvent.type(
      within(group('オプション 1')).getByRole('textbox', { name: '名前' }),
      'トリートメント',
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    expect(received).toHaveLength(1)
    expect(
      received[0]?.filter(([name]) =>
        /^(packageServiceIds|options|isPackage)/.test(name),
      ),
    ).toEqual([
      ['isPackage', 'on'],
      ['packageServiceIds.0', aService().id],
      ['packageServiceIds.1', aDiscountedColour().id],
      ['options.0.name', 'トリートメント'],
      ['options.0.optionType', 'addon'],
      ['options.0.maxQuantity', '1'],
      ['options.0.additionalTime', '0'],
      ['options.0.additionalPrice', '0'],
      ['options.0.description', ''],
      ['options.0.isActive', 'on'],
    ])
  })

  it('should say what is wrong under the control and the row it belongs to, until a row is taken away', async () => {
    // Arrange
    await stories.WithErrors.run()
    expect(text('割引後の料金')).toHaveAccessibleDescription(
      expect.stringContaining('割引後の料金は、料金以下にしてください。'),
    )
    expect(
      within(group('構成サービス 2')).getByRole('combobox', {
        name: 'サービス',
      }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('同じサービスは、1 回だけ入れられます。'),
    )

    // Act: the rows after the first one are numbered anew
    await userEvent.click(
      screen.getByRole('button', { name: '構成サービスを足す' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '構成サービス 1 を外す' }),
    )

    // Assert
    expect(
      within(group('構成サービス 2')).getByRole('combobox', {
        name: 'サービス',
      }),
    ).not.toHaveAccessibleDescription(expect.stringContaining('1 回だけ'))
    expect(text('割引後の料金')).toHaveAccessibleDescription(
      expect.stringContaining('割引後の料金は、料金以下にしてください。'),
    )
  })

  it('should say what went wrong with the attempt', async () => {
    // Act
    await stories.NotSent.run()

    // Assert
    expect(
      screen.getByText(
        'サービスを足せませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeInTheDocument()
  })
})
