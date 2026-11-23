import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aDiscountedColour, aService } from '../examples'
import * as servicesChangeFormStories from './services-change-form.stories'

const stories = composeStories(servicesChangeFormStories)

const choice = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const valueIn = (control: HTMLElement): string | undefined =>
  'value' in control && typeof control.value === 'string'
    ? control.value
    : undefined

describe('ServicesChangeForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

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
})

describe('ServicesChangeForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer the services and the values in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Opened.run()

    // Assert
    const services = screen.getByRole('group', { name: 'Services to change' })
    expect(services).toHaveAccessibleDescription(
      'In the order of the menu, each with its category. 1 to 100.',
    )
    expect(
      within(services)
        .getAllByRole('checkbox')
        .map((service) => service.closest('label')?.textContent),
    ).toEqual([
      'カット (カット)',
      'フルカラー (カラー)',
      'カットとカラー (Uncategorized)',
    ])
    expect(
      screen.getByRole('group', { name: 'Values to change' }),
    ).toHaveAccessibleDescription(
      'Every chosen service is given the same value. A value left at “Keep” stays as it is for each service.',
    )
    expect(optionsOf(choice('Category'))).toEqual([
      'Keep',
      'Make uncategorized',
      'カット',
      'カラー',
      'カラー › ハイライト',
    ])
    expect(optionsOf(choice('Active'))).toEqual([
      'Keep',
      'Make active',
      'Make inactive',
    ])
    expect(optionsOf(choice('Online booking'))).toEqual([
      'Keep',
      'Accepted',
      'Not accepted',
    ])
    expect(optionsOf(choice('Offering status'))).toEqual([
      'Keep',
      'Active',
      'Paused',
      'Coming soon',
      'Discontinued',
    ])
    expect(optionsOf(choice('Availability'))).toEqual([
      'Keep',
      'Always',
      'Weekdays only',
      'Weekends only',
      'By appointment only',
      'Seasonal',
    ])
    expect(optionsOf(choice('Staff who can do it'))).toEqual([
      'Keep',
      'All staff',
      'Junior or above',
      'Stylist or above',
      'Senior or above',
      'Expert or above',
      'Director or above',
    ])
  })

  it('should say in English what is wrong, and what went wrong with the attempt', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('group', { name: 'Services to change' }),
    ).toHaveAccessibleDescription(
      'In the order of the menu, each with its category. 1 to 100. Choose at least one service to change.',
    )
    expect(choice('Category')).toHaveAccessibleDescription(
      'This category was removed meanwhile. Choose the category again.',
    )

    // Act
    await stories.NotChanged.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'One of the chosen services was removed from the menu meanwhile. No service was changed. Choose again from the menu as it is now.',
    )
  })
})
