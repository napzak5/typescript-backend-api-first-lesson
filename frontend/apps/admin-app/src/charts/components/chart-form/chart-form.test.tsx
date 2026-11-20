import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as chartFormStories from './chart-form.stories'

const stories = composeStories(chartFormStories)

const treatment = (place: number): HTMLElement =>
  screen.getByRole('group', { name: `${place} 件目の施術` })

/** What the controls of a treatment hold */
const rowOf = (place: number): (string | undefined)[] =>
  ['施術', '施術日', 'サロン', '施術のメモ'].map((name) => {
    const control = within(treatment(place)).getByLabelText(name)

    return 'value' in control && typeof control.value === 'string'
      ? control.value
      : undefined
  })

describe('ChartForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open with what the chart holds', async () => {
    // Act
    await stories.Opened.run()

    // Assert
    expect(rowOf(1)).toEqual([
      'color',
      '2026-03-14',
      'ヘアサロン 青山',
      '根元から明るめのブラウン。',
    ])
    expect(rowOf(2)).toEqual(['perm', '2025-11-02', '', ''])
    expect(screen.getByRole('textbox', { name: '持病や体調' })).toHaveValue(
      '頭皮が乾燥しやすく、かゆみが出ることがあります。',
    )
    expect(screen.getByRole('textbox', { name: '好みの商材' })).toHaveValue(
      'オーガニックシャンプー、無香料のオイル',
    )
    expect(screen.getByRole('textbox', { name: '避ける商材' })).toHaveValue(
      '香りの強い整髪料',
    )
  })

  it('should offer no treatment for a new chart, and require the treatment and its day of one that is added', async () => {
    // Arrange
    await stories.New.run()
    expect(screen.queryByRole('group', { name: /件目の施術/ })).toBeNull()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '施術を足す' }))

    // Assert
    const select = within(treatment(1)).getByRole('combobox', { name: '施術' })
    expect(select).toHaveFocus()
    expect(select).toBeRequired()
    expect(within(treatment(1)).getByLabelText('施術日')).toBeRequired()
    expect(within(treatment(1)).getByLabelText('施術日')).toHaveAttribute(
      'max',
      '2026-11-20',
    )
  })

  it('should add a treatment at the end, and give its first control the focus', async () => {
    // Arrange
    await stories.Opened.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '施術を足す' }))

    // Assert
    expect(rowOf(3)).toEqual(['', '', '', ''])
    expect(
      within(treatment(3)).getByRole('combobox', { name: '施術' }),
    ).toHaveFocus()
  })

  it('should take a treatment away, keep what the others hold, and give the focus to the button that adds one', async () => {
    // Arrange
    await stories.Opened.run()
    await userEvent.type(
      within(treatment(2)).getByRole('textbox', { name: '施術のメモ' }),
      'ゆるめ',
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '1 件目の施術を外す' }),
    )

    // Assert
    expect(screen.getAllByRole('group', { name: /件目の施術/ })).toHaveLength(1)
    expect(rowOf(1)).toEqual(['perm', '2025-11-02', '', 'ゆるめ'])
    expect(screen.getByRole('button', { name: '施術を足す' })).toHaveFocus()
  })

  it('should send the treatments in the order they are shown, with the rest of the chart', async () => {
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
        [
          'medicalConditions',
          '頭皮が乾燥しやすく、かゆみが出ることがあります。',
        ],
        ['preferredProducts', 'オーガニックシャンプー、無香料のオイル'],
        ['avoidProducts', '香りの強い整髪料'],
        ['previousTreatments.0.treatment', 'color'],
        ['previousTreatments.0.date', '2026-03-14'],
        ['previousTreatments.0.salonName', 'ヘアサロン 青山'],
        ['previousTreatments.0.notes', '根元から明るめのブラウン。'],
        ['previousTreatments.1.treatment', 'perm'],
        ['previousTreatments.1.date', '2025-11-02'],
        ['previousTreatments.1.salonName', ''],
        ['previousTreatments.1.notes', ''],
        ['notes', 'シャンプーはぬるめのお湯で。\n施術中の会話は控えめを希望。'],
      ],
    ])
  })

  it('should say what is wrong under the control of the treatment it belongs to', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      within(treatment(2)).getByLabelText('施術日'),
    ).toHaveAccessibleDescription(
      expect.stringContaining('施術日は、今日までにしてください。'),
    )
    expect(
      within(treatment(1)).getByLabelText('施術日'),
    ).not.toHaveAccessibleDescription(expect.stringContaining('今日までに'))
    expect(
      screen.getByRole('textbox', { name: '避ける商材' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        '商材の名前は、1 つ 100 文字までで入力してください。',
      ),
    )
  })

  it('should hide the errors of the rows once a row was taken away, for their numbers changed', async () => {
    // Arrange: the error is the second row's, and a third row is added
    await stories.WithErrors.run()
    await userEvent.click(screen.getByRole('button', { name: '施術を足す' }))

    // Act: the third row becomes the second
    await userEvent.click(
      screen.getByRole('button', { name: '1 件目の施術を外す' }),
    )

    // Assert
    expect(
      within(treatment(2)).getByLabelText('施術日'),
    ).not.toHaveAccessibleDescription(expect.stringContaining('今日までに'))
    expect(
      screen.getByRole('textbox', { name: '避ける商材' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        '商材の名前は、1 つ 100 文字までで入力してください。',
      ),
    )
  })

  it('should offer no more treatment once the chart holds as many as it may', async () => {
    // Act
    await stories.Full.run()

    // Assert
    expect(screen.getAllByRole('group', { name: /件目の施術/ })).toHaveLength(
      50,
    )
    expect(screen.queryByRole('button', { name: '施術を足す' })).toBeNull()
    expect(
      screen.getByText('過去の施術は、50 件まで書けます。'),
    ).toBeInTheDocument()
  })

  it('should say what went wrong with the attempt', async () => {
    // Act
    await stories.NotSent.run()

    // Assert
    expect(
      screen.getByText(
        'カルテを作れませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeInTheDocument()
  })
})
