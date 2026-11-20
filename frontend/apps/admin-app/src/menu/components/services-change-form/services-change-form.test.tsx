import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { aDiscountedColour, aService } from '../examples'
import * as servicesChangeFormStories from './services-change-form.stories'

const stories = composeStories(servicesChangeFormStories)

const choice = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const valueIn = (control: HTMLElement): string | undefined =>
  'value' in control && typeof control.value === 'string'
    ? control.value
    : undefined

const optionsOf = (control: HTMLElement): (string | null)[] =>
  within(control)
    .getAllByRole('option')
    .map((option) => option.textContent)

describe('ServicesChangeForm', () => {
  it('should offer the services of the menu in its order, each with its category, none chosen', async () => {
    // Act
    await stories.Opened.run()

    // Assert
    const services = within(
      screen.getByRole('group', { name: '変えるサービス' }),
    ).getAllByRole('checkbox')
    expect(
      services.map((service) => service.closest('label')?.textContent),
    ).toEqual([
      'カット（カット）',
      'フルカラー（カラー）',
      'カットとカラー（未分類）',
    ])
    expect(
      services.filter(
        (service) => 'checked' in service && service.checked === true,
      ),
    ).toEqual([])
  })

  it('should open every value at the choice that keeps it', async () => {
    // Act
    await stories.Opened.run()

    // Assert
    expect(
      [
        'カテゴリー',
        '有効',
        'オンライン予約',
        '提供の状態',
        '提供日',
        '担当できるスタッフ',
      ].map((name) => valueIn(choice(name))),
    ).toEqual(['', '', '', '', '', ''])
    expect(optionsOf(choice('カテゴリー'))).toEqual([
      '変えない',
      '未分類にする',
      'カット',
      'カラー',
      'カラー › ハイライト',
    ])
    expect(optionsOf(choice('担当できるスタッフ'))).toEqual([
      '変えない',
      'すべてのスタッフ',
      'ジュニア以上',
      'スタイリスト以上',
      'シニア以上',
      'エキスパート以上',
      'ディレクター以上',
    ])
  })

  it('should send the services chosen and the values chosen', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Opened.run({
      args: {
        ...stories.Opened.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'フルカラー（カラー）' }),
    )
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'カット（カット）' }),
    )
    await userEvent.selectOptions(choice('オンライン予約'), '受けない')
    await userEvent.click(screen.getByRole('button', { name: '変える' }))

    // Assert
    expect(received).toEqual([
      [
        ['serviceIds', aService().id],
        ['serviceIds', aDiscountedColour().id],
        ['categoryId', ''],
        ['isActive', ''],
        ['allowOnlineBooking', 'off'],
        ['serviceStatus', ''],
        ['availability', ''],
        ['requiredStaffLevel', ''],
      ],
    ])
  })

  it('should say what is wrong under the services and the category', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('group', { name: '変えるサービス' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('変えるサービスを、1 件以上選んでください。'),
    )
    expect(choice('カテゴリー')).toHaveAccessibleDescription(
      expect.stringContaining('このカテゴリーは、その間に削除されていました。'),
    )
  })

  it('should say what went wrong with the attempt', async () => {
    // Act
    await stories.NotChanged.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'どのサービスも変えていません。',
    )
  })

  itShouldBeAccessibleInEveryStory(stories)
})
