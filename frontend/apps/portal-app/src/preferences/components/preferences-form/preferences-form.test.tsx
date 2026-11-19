import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { kenta, misaki, yui } from '../examples'
import * as preferencesFormStories from './preferences-form.stories'

const stories = composeStories(preferencesFormStories)

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const part = (name: string): HTMLElement => screen.getByRole('group', { name })

const wished = (): HTMLElement =>
  screen.getByRole('combobox', { name: '指名したいスタッフ' })

const avoided = (): (string | null)[] =>
  within(part('避けたいスタッフ'))
    .queryAllByRole('checkbox', { checked: true })
    .map((box) => box.getAttribute('value'))

/** The times of the rows, in the order of the page. */
const times = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="time"]'),
    (control) => control.value,
  )

describe('PreferencesForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should have its controls in parts that are named: the staff, the time of a visit, the style, and how to be served', async () => {
    // Act
    await stories.Filled.run()

    // Assert
    expect(
      screen
        .getAllByRole('group')
        .map((group) => group.querySelector('legend')?.textContent),
    ).toEqual([
      'スタッフ',
      '避けたいスタッフ',
      '希望する時間帯',
      'スタイルの好み',
      '接客',
    ])
    expect(within(part('スタイルの好み')).getAllByRole('textbox')).toHaveLength(
      4,
    )
    expect(within(part('接客')).getAllByRole('textbox')).toHaveLength(2)
  })

  it('should open with the preferences there are: the lists that are written, a line each', async () => {
    // Act
    await stories.Filled.run()

    // Assert
    expect(wished()).toHaveValue(misaki.id)
    expect(avoided()).toEqual([kenta.id, yui.id])
    expect(times()).toEqual(['10:00', '12:00', '18:00', '20:30'])
    expect(text('希望の長さ')).toHaveValue('肩にかかるくらい')
    expect(text('好きな色')).toHaveValue('アッシュブラウン\nベージュ')
    expect(text('避けたいスタイル')).toHaveValue(
      '前髪を短くすること\n強いパーマ',
    )
    expect(text('参考の画像の URL')).toHaveValue(
      'https://images.example.com/styles/bob-ash-brown.jpg\nhttps://images.example.com/styles/layered-medium.jpg',
    )
    expect(text('接客の好み')).toHaveValue('静かに過ごしたい')
    expect(text('特別な要望')).toHaveValue(
      '首が疲れやすいので、シャンプーのときにタオルを入れてもらえると助かります。',
    )
  })

  it('should offer every member of the staff with their salon, to wish for after the choice of nobody, and to avoid', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    const names = [
      '田中 美咲（Beauty Salon Tokyo）',
      '佐藤 健太（Beauty Salon Tokyo）',
      '鈴木 結衣（Hair Studio Osaka）',
    ]
    expect(
      within(wished())
        .getAllByRole('option')
        .map((option) => [option.getAttribute('value'), option.textContent]),
    ).toEqual([
      ['', '指名しない'],
      [misaki.id, names[0]],
      [kenta.id, names[1]],
      [yui.id, names[2]],
    ])
    expect(
      within(part('避けたいスタッフ'))
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('value')),
    ).toEqual([misaki.id, kenta.id, yui.id])
    for (const name of names) {
      expect(
        within(part('避けたいスタッフ')).getByRole('checkbox', { name }),
      ).toBeInTheDocument()
    }
  })

  it('should be empty for somebody who has said nothing: nobody wished for, nobody to avoid, and no row', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(wished()).toHaveValue('')
    expect(avoided()).toEqual([])
    expect(times()).toEqual([])
    for (const control of screen.getAllByRole('textbox')) {
      expect(control).toHaveValue('')
    }
    expect(
      screen.getByRole('button', { name: '時間帯を追加する' }),
    ).toBeEnabled()
  })

  it('should have no control for the staff when it is given none, and say how to get one', async () => {
    // Act
    await stories.WithoutStaff.run()

    // Assert
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(part('スタッフ')).toHaveTextContent(
      '指名したいスタッフと、避けたいスタッフは、サロンを予約すると選べるようになります。',
    )
    expect(screen.getAllByRole('textbox')).toHaveLength(6)
  })

  it('should wish for nobody, and avoid those it offers alone, when what is stored names staff it is not given', async () => {
    // Act
    await stories.StaffThatLeft.run()

    // Assert
    expect(wished()).toHaveValue('')
    expect(avoided()).toEqual([yui.id])
  })

  it('should hand over what it holds under the names of the request when it is sent: a row by its number', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Filled.run({
      args: {
        ...stories.Filled.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push([...values])
        }),
      },
    })
    await userEvent.selectOptions(wished(), '指名しない')
    await userEvent.click(
      screen.getByRole('checkbox', { name: '佐藤 健太（Beauty Salon Tokyo）' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯 1 を削除する' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯を追加する' }),
    )
    await userEvent.type(screen.getByLabelText('時間帯 2 の開始'), '09:00')
    await userEvent.type(screen.getByLabelText('時間帯 2 の終了'), '09:45')
    await userEvent.clear(text('希望の長さ'))
    await userEvent.type(text('好きな色'), '{Enter}ピンク')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert: a member that is chosen is a value of the one name, and one
    // that is not ticked is not sent
    expect(received).toEqual([
      [
        ['preferredStaffId', ''],
        ['avoidStaffIds', yui.id],
        ['preferredTimeSlots.0.startTime', '18:00'],
        ['preferredTimeSlots.0.endTime', '20:30'],
        ['preferredTimeSlots.1.startTime', '09:00'],
        ['preferredTimeSlots.1.endTime', '09:45'],
        ['stylePreferences.preferredLength', ''],
        [
          'stylePreferences.preferredColors',
          'アッシュブラウン\nベージュ\nピンク',
        ],
        ['stylePreferences.avoidStyles', '前髪を短くすること\n強いパーマ'],
        [
          'stylePreferences.inspirationImages',
          'https://images.example.com/styles/bob-ash-brown.jpg\nhttps://images.example.com/styles/layered-medium.jpg',
        ],
        ['communicationStyle', '静かに過ごしたい'],
        [
          'specialRequests',
          '首が疲れやすいので、シャンプーのときにタオルを入れてもらえると助かります。',
        ],
      ],
    ])
  })

  it('should hand over nothing of the staff when it has no control for them', async () => {
    // Arrange
    const received: string[][] = []
    await stories.WithoutStaff.run({
      args: {
        ...stories.WithoutStaff.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push([...values.keys()])
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
        'stylePreferences.preferredLength',
        'stylePreferences.preferredColors',
        'stylePreferences.avoidStyles',
        'stylePreferences.inspirationImages',
        'communicationStyle',
        'specialRequests',
      ],
    ])
  })

  it('should say what is wrong at its control, mark every box of a group, and put the focus on the first control with an error', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('checkbox', { name: '田中 美咲（Beauty Salon Tokyo）' }),
    ).toHaveFocus()
    expect(part('避けたいスタッフ')).toHaveAccessibleDescription(
      '指名したいスタッフは、避けたいスタッフに選べません。どちらかを変えてください。',
    )
    expect(
      screen.getByLabelText('時間帯 2 の終了'),
    ).toHaveAccessibleDescription('終了は、開始より後の時刻にしてください。')
    expect(text('参考の画像の URL')).toHaveAttribute('aria-invalid', 'true')
    expect(text('接客の好み')).toHaveAccessibleDescription(
      expect.stringContaining('100 文字以内で入力してください。'),
    )
    expect(wished()).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('時間帯 1 の終了')).not.toHaveAttribute(
      'aria-invalid',
    )
  })

  it('should say what went wrong with the attempt above the controls, at once', async () => {
    // Act
    await stories.WithMessage.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should be busy, and hand over nothing more, while an attempt is on its way', async () => {
    // Arrange
    await stories.Pending.run()
    const button = screen.getByRole('button', { name: '変更を保存する' })

    // Act
    await userEvent.click(button)
    await userEvent.type(text('希望の長さ'), '{Enter}')

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })

  it('should not be sent by the buttons that add a row and take one away', async () => {
    // Arrange
    await stories.Filled.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯を追加する' }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '時間帯 1 を削除する' }),
    )

    // Assert
    expect(stories.Filled.args.onSubmit).not.toHaveBeenCalled()
  })
})
