import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as treatmentFormStories from './treatment-form.stories'

const stories = composeStories(treatmentFormStories)

const material = (place: number): HTMLElement =>
  screen.getByRole('group', { name: `${place} 件目の商材` })

/** The names of the boxes of a group that are checked */
const checkedIn = (group: string): string[] =>
  within(screen.getByRole('group', { name: group }))
    .getAllByRole('checkbox')
    .filter((box) => 'checked' in box && box.checked === true)
    .map((box) => box.closest('label')?.textContent ?? '')

/** What the controls of a material hold; `null` for the lot number of a row that asks for none */
const materialOf = (place: number): (string | null)[] =>
  ['商品', '量', '単位', 'ロット番号', '商材のメモ'].map((name) => {
    const control = within(material(place)).queryByLabelText(name)

    return control !== null &&
      'value' in control &&
      typeof control.value === 'string'
      ? control.value
      : null
  })

describe('TreatmentForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open a new record with the member and the services of the booking, and no material', async () => {
    // Act
    await stories.New.run()

    // Assert
    const member = screen.getByRole('combobox', { name: '担当' })
    expect(member).toHaveDisplayValue('田中 美咲')
    expect(member).toBeRequired()
    expect(checkedIn('提供したサービス')).toEqual(['カット'])
    expect(checkedIn('次に勧めるサービス')).toEqual([])
    expect(screen.queryByRole('group', { name: /件目の商材/ })).toBeNull()
    expect(
      screen.getByRole('combobox', { name: 'お客様の満足度' }),
    ).toHaveDisplayValue('記録しない')
    expect(screen.getByLabelText('次に勧める日')).toHaveAttribute(
      'min',
      '2026-11-20',
    )
  })

  it('should open with what the record holds, and name its member without offering another', async () => {
    // Act
    await stories.Opened.run()

    // Assert
    expect(screen.queryByRole('combobox', { name: '担当' })).toBeNull()
    expect(screen.getByText('田中 美咲')).toBeInTheDocument()
    expect(checkedIn('提供したサービス')).toEqual(['カット', 'カラー'])
    expect(checkedIn('次に勧めるサービス')).toEqual(['カラー'])
    expect(screen.getByRole('textbox', { name: '技法' })).toHaveValue(
      'ローライト、レイヤーカット',
    )
    expect(materialOf(1)).toEqual([
      'c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35',
      '1',
      '本',
      'LOT-2026-031',
      '',
    ])
    expect(materialOf(2)).toEqual([
      'd6f8b0c2-4e5a-4b7c-9d1f-3a5b7d9f1c46',
      '80.5',
      'ml',
      null,
      '根元に多めに使った。',
    ])
    expect(
      screen.getByRole('combobox', { name: 'お客様の満足度' }),
    ).toHaveDisplayValue('5（とても満足）')
  })

  it('should add a material at the end, give its product the focus, and offer the products the salon uses in treatments', async () => {
    // Arrange
    await stories.Opened.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '商材を足す' }))

    // Assert
    const product = within(material(3)).getByRole('combobox', { name: '商品' })
    expect(product).toHaveFocus()
    expect(product).toBeRequired()
    expect(
      within(product)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      '選んでください',
      'カラー剤 6N（COLOR-6N）',
      'オキシ 6%（OX-6）',
    ])
    expect(materialOf(3)).toEqual(['', '', '', null, ''])
  })

  it('should write the unit of the product chosen, and ask for a lot number only of a product kept by lots', async () => {
    // Arrange
    await stories.New.run()
    await userEvent.click(screen.getByRole('button', { name: '商材を足す' }))
    const product = within(material(1)).getByRole('combobox', { name: '商品' })

    // Act
    await userEvent.selectOptions(product, 'オキシ 6%（OX-6）')

    // Assert
    expect(materialOf(1)).toEqual([
      'd6f8b0c2-4e5a-4b7c-9d1f-3a5b7d9f1c46',
      '',
      'ml',
      null,
      '',
    ])

    // Act
    await userEvent.selectOptions(product, 'カラー剤 6N（COLOR-6N）')

    // Assert
    expect(materialOf(1)).toEqual([
      'c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35',
      '',
      '本',
      '',
      '',
    ])
    expect(within(material(1)).getByLabelText('ロット番号')).toBeRequired()
  })

  it('should keep a unit that was written until another product is chosen', async () => {
    // Arrange
    await stories.Opened.run()
    const unit = within(material(2)).getByRole('textbox', { name: '単位' })

    // Act
    await userEvent.clear(unit)
    await userEvent.type(unit, 'g')

    // Assert
    expect(unit).toHaveValue('g')
  })

  it('should take a material away, keep what the others hold, and give the focus to the button that adds one', async () => {
    // Arrange
    await stories.Opened.run()
    await userEvent.type(
      within(material(2)).getByRole('textbox', { name: '商材のメモ' }),
      '。',
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '1 件目の商材を外す' }),
    )

    // Assert
    expect(screen.getAllByRole('group', { name: /件目の商材/ })).toHaveLength(1)
    expect(materialOf(1)).toEqual([
      'd6f8b0c2-4e5a-4b7c-9d1f-3a5b7d9f1c46',
      '80.5',
      'ml',
      null,
      '根元に多めに使った。。',
    ])
    expect(screen.getByRole('button', { name: '商材を足す' })).toHaveFocus()
  })

  it('should send the record with its materials in the order they are shown', async () => {
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
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    expect(received).toEqual([
      [
        ['services', '9e6c1a4d-3b5f-4dac-9a8e-7f4b0c3d5e92'],
        ['services', 'af7d2b5e-4c6a-4ebd-8b9f-8a5c1d4e6fa3'],
        ['techniques', 'ローライト、レイヤーカット'],
        ['processingTime', '75'],
        [
          'consultationNotes',
          '前回のカラーの色落ちが気になる。\n明るさは変えたくない。',
        ],
        ['scalpCondition', 'やや乾燥'],
        ['hairCondition', '毛先にダメージ'],
        ['colorFormula', '6N：オキシ 6% ＝ 1：1'],
        ['materials.0.productId', 'c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35'],
        ['materials.0.quantity', '1'],
        ['materials.0.unit', '本'],
        ['materials.0.lotNumber', 'LOT-2026-031'],
        ['materials.0.notes', ''],
        ['materials.1.productId', 'd6f8b0c2-4e5a-4b7c-9d1f-3a5b7d9f1c46'],
        ['materials.1.quantity', '80.5'],
        ['materials.1.unit', 'ml'],
        ['materials.1.notes', '根元に多めに使った。'],
        ['resultNotes', ''],
        ['customerSatisfaction', '5'],
        ['nextRecommendedDate', '2026-12-18'],
        ['nextRecommendedServices', 'af7d2b5e-4c6a-4ebd-8b9f-8a5c1d4e6fa3'],
        ['homeCareSuggestions', 'カラー用のシャンプーを勧めた。'],
        ['staffEvaluation', '根元の塗り分けに時間がかかった。'],
      ],
    ])
  })

  it('should say what is wrong under the control of the material it belongs to', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      within(material(2)).getByLabelText('量'),
    ).toHaveAccessibleDescription(expect.stringContaining('0 より大きい数'))
    expect(
      within(material(1)).getByLabelText('量'),
    ).not.toHaveAccessibleDescription(expect.stringContaining('0 より大きい数'))
    expect(screen.getByLabelText('次に勧める日')).toHaveAccessibleDescription(
      expect.stringContaining('予約の日（2026-11-20）から後の日'),
    )
  })

  it('should hide the errors of the materials once one was taken away, for their numbers changed', async () => {
    // Arrange
    await stories.WithErrors.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '1 件目の商材を外す' }),
    )

    // Assert
    expect(
      within(material(1)).getByLabelText('量'),
    ).not.toHaveAccessibleDescription(expect.stringContaining('0 より大きい数'))
    expect(screen.getByLabelText('次に勧める日')).toHaveAccessibleDescription(
      expect.stringContaining('予約の日（2026-11-20）から後の日'),
    )
  })

  it('should name a service and a product the salon removed, and keep them chosen with the lot number', async () => {
    // Act
    await stories.WithRemoved.run()

    // Assert
    expect(checkedIn('提供したサービス')).toEqual(['削除されたメニュー'])
    expect(
      within(material(1)).getByRole('combobox', { name: '商品' }),
    ).toHaveDisplayValue('削除された商品')
    expect(materialOf(1)).toEqual([
      '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      '2',
      '本',
      'OLD-7',
      '',
    ])
  })

  it('should offer no more material once the record holds as many as it may', async () => {
    // Act
    await stories.Full.run()

    // Assert
    expect(screen.getAllByRole('group', { name: /件目の商材/ })).toHaveLength(
      50,
    )
    expect(screen.queryByRole('button', { name: '商材を足す' })).toBeNull()
    expect(
      screen.getByText('使った商材は、50 件まで書けます。'),
    ).toBeInTheDocument()
  })

  it('should say what went wrong with the attempt', async () => {
    // Act
    await stories.NotSent.run()

    // Assert
    expect(
      screen.getByText(
        '施術記録を書けませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeInTheDocument()
  })
})
