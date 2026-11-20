import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as allergyFormStories from './allergy-form.stories'

const stories = composeStories(allergyFormStories)

const severity = (): HTMLElement =>
  screen.getByRole('radiogroup', { name: '重篤度' })

describe('AllergyForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open with what the allergy holds', async () => {
    // Act
    await stories.Opened.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'アレルゲン' })).toHaveValue(
      'パラフェニレンジアミン（PPD）',
    )
    expect(screen.getByRole('combobox', { name: '種類' })).toHaveValue(
      'chemical',
    )
    expect(
      within(severity()).getByRole('radio', { name: '重い' }),
    ).toBeChecked()
    expect(screen.getByRole('textbox', { name: '症状' })).toHaveValue(
      'カラー剤で頭皮に赤みとかゆみが出た。',
    )
    expect(
      screen.getByRole('textbox', { name: '施術のときの注意' }),
    ).toHaveValue('ジアミンを含まないカラー剤を使う。\nパッチテストを先に。')
    expect(screen.getByLabelText('確かめた日')).toHaveValue('2025-06-10')
  })

  it('should offer the severities the heaviest first, none chosen for a new allergy, and require the allergen, its kind and its severity', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(
      within(severity())
        .getAllByRole('radio')
        .map((radio) => [
          radio.getAttribute('value'),
          radio.closest('label')?.textContent,
        ]),
    ).toEqual([
      ['life_threatening', '命に関わる'],
      ['severe', '重い'],
      ['moderate', '中程度'],
      ['mild', '軽い'],
    ])
    expect(
      within(severity()).queryByRole('radio', { checked: true }),
    ).toBeNull()
    expect(screen.getByRole('textbox', { name: 'アレルゲン' })).toBeRequired()
    expect(screen.getByRole('combobox', { name: '種類' })).toBeRequired()
    expect(screen.getByRole('combobox', { name: '種類' })).toHaveValue('')
    expect(screen.getByLabelText('確かめた日')).not.toBeRequired()
    expect(screen.getByLabelText('確かめた日')).toHaveAttribute(
      'min',
      '1900-01-01',
    )
    expect(screen.getByLabelText('確かめた日')).toHaveAttribute(
      'max',
      '2026-11-20',
    )
  })

  it('should offer the kinds in the order of the contract', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(
      within(screen.getByRole('combobox', { name: '種類' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      '選んでください',
      '化学物質',
      '香料',
      '金属',
      'ラテックス',
      '植物',
      'その他',
    ])
  })

  it('should send every control of the allergy', async () => {
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
        ['allergenName', 'パラフェニレンジアミン（PPD）'],
        ['allergyType', 'chemical'],
        ['severityType', 'severe'],
        ['symptoms', 'カラー剤で頭皮に赤みとかゆみが出た。'],
        ['notes', 'ジアミンを含まないカラー剤を使う。\nパッチテストを先に。'],
        ['confirmedDate', '2025-06-10'],
      ],
    ])
  })

  it('should say what is wrong at each control', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'アレルゲン' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        'このお客様には、同じアレルゲンの記録があります。',
      ),
    )
    expect(severity()).toHaveAccessibleDescription(
      expect.stringContaining('重篤度を選んでください。'),
    )
    expect(screen.getByLabelText('確かめた日')).toHaveAccessibleDescription(
      expect.stringContaining('確かめた日は、今日までにしてください。'),
    )
  })

  it('should say what went wrong with the attempt, and keep its button busy while the allergy is on its way', async () => {
    // Act
    await stories.NotSent.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'アレルギーを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )

    // Act
    await stories.Sending.run()

    // Assert
    expect(
      screen.getByRole('button', { name: '変更を保存する' }),
    ).toHaveAttribute('aria-busy', 'true')
  })
})
