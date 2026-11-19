import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { TODAY } from '../examples'
import * as profileFormStories from './profile-form.stories'

const stories = composeStories(profileFormStories)

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const part = (name: string): HTMLElement => screen.getByRole('group', { name })

const chosenIn = (group: HTMLElement): (string | null)[] =>
  within(group)
    .getAllByRole('checkbox', { checked: true })
    .map((box) => box.getAttribute('value'))

describe('ProfileForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should have its controls in parts that are named: the name, the contact, the address, the person, what they like, and what they receive', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(
      screen
        .getAllByRole('group')
        .map((group) => group.querySelector('legend')?.textContent),
    ).toEqual([
      'お名前',
      '連絡先',
      '住所',
      'ご本人について',
      '好み',
      '好みのメニュー',
      '受け取る連絡',
    ])
    expect(within(part('お名前')).getAllByRole('textbox')).toHaveLength(4)
    expect(within(part('住所')).getAllByRole('textbox')).toHaveLength(5)
  })

  it('should be empty for an account without a profile, and ask for the name and the phone number alone', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    for (const control of screen.getAllByRole('textbox')) {
      expect(control).toHaveValue('')
    }
    expect(screen.getByLabelText('生年月日')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: '性別' })).toHaveValue('')
    expect(screen.queryByRole('checkbox', { checked: true })).toBeNull()
    expect(
      screen
        .getAllByRole('textbox')
        .filter((control) => control.hasAttribute('required'))
        .map((control) => control.getAttribute('name')),
    ).toEqual(['lastName', 'firstName', 'phoneNumber'])
    expect(screen.getByRole('button', { name: '登録する' })).toBeEnabled()
  })

  it('should open with the profile there is', async () => {
    // Act
    await stories.Filled.run()

    // Assert
    expect(text('姓')).toHaveValue('山田')
    expect(text('名')).toHaveValue('花子')
    expect(text('姓（フリガナ）')).toHaveValue('ヤマダ')
    expect(text('名（フリガナ）')).toHaveValue('ハナコ')
    expect(text('電話番号')).toHaveValue('090-5550-0199')
    expect(text('予備の電話番号')).toHaveValue('03-5550-0142')
    expect(text('郵便番号')).toHaveValue('150-0001')
    expect(text('都道府県')).toHaveValue('東京都')
    expect(text('市区町村')).toHaveValue('渋谷区')
    expect(text('番地')).toHaveValue('神宮前 1-2-3')
    expect(text('建物名・部屋番号')).toHaveValue('こもれびハイツ 302')
    expect(screen.getByLabelText('生年月日')).toHaveValue('1990-05-15')
    expect(screen.getByRole('combobox', { name: '性別' })).toHaveValue('female')
    expect(text('職業')).toHaveValue('デザイナー')
    expect(chosenIn(part('好みのメニュー'))).toEqual(['cut', 'color'])
    expect(text('サロンに伝えておきたいこと')).toHaveValue(
      'オーガニックの製品を使ってほしいです。',
    )
    expect(chosenIn(part('受け取る連絡'))).toHaveLength(2)
    expect(
      screen.getByRole('checkbox', {
        name: 'キャンペーンなどのお知らせを受け取る',
      }),
    ).not.toBeChecked()
  })

  it('should offer every gender of the contract after the choice to say none, and every kind of service', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(
      within(screen.getByRole('combobox', { name: '性別' }))
        .getAllByRole('option')
        .map((option) => [option.getAttribute('value'), option.textContent]),
    ).toEqual([
      ['', '選択しない'],
      ['male', '男性'],
      ['female', '女性'],
      ['other', 'その他'],
      ['prefer_not_to_say', '回答しない'],
    ])
    expect(
      within(part('好みのメニュー'))
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('value')),
    ).toEqual([
      'cut',
      'color',
      'perm',
      'treatment',
      'spa',
      'styling',
      'extension',
      'other',
    ])
  })

  it('should let a day of birth be chosen from 1900 until today', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    const birthDate = screen.getByLabelText('生年月日')
    expect(birthDate).toHaveAttribute('type', 'date')
    expect(birthDate).toHaveAttribute('min', '1900-01-01')
    expect(birthDate).toHaveAttribute('max', TODAY)
  })

  it('should say which address a new profile gets, and ask for none', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(
      within(part('連絡先')).getByText(
        'メールアドレスは、サインインに使っているものを登録します。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('textbox', { name: /メールアドレス/ })).toBeNull()
  })

  it('should show the address of the profile there is, and say that it is not changed here', async () => {
    // Act
    await stories.Filled.run()

    // Assert
    expect(
      within(part('連絡先')).getByText(
        'メールアドレス（hanako.yamada@example.com）は、ここでは変更できません。変更するときは、サロンにお問い合わせください。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('textbox', { name: /メールアドレス/ })).toBeNull()
  })

  it('should hand over what it holds under the names of the request when it is sent', async () => {
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
    await userEvent.clear(text('建物名・部屋番号'))
    await userEvent.type(text('職業'), '（フリーランス）')
    await userEvent.click(screen.getByRole('checkbox', { name: 'カラー' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'スパ' }))

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert: a kind of service that is chosen is a value of the one name,
    // and what is not ticked is not sent
    expect(received).toEqual([
      [
        ['lastName', '山田'],
        ['firstName', '花子'],
        ['lastNameKana', 'ヤマダ'],
        ['firstNameKana', 'ハナコ'],
        ['phoneNumber', '090-5550-0199'],
        ['alternativePhone', '03-5550-0142'],
        ['postalCode', '150-0001'],
        ['prefecture', '東京都'],
        ['city', '渋谷区'],
        ['address', '神宮前 1-2-3'],
        ['building', ''],
        ['birthDate', '1990-05-15'],
        ['gender', 'female'],
        ['occupation', 'デザイナー（フリーランス）'],
        ['preferences.preferredServices', 'cut'],
        ['preferences.preferredServices', 'spa'],
        ['preferences.notes', 'オーガニックの製品を使ってほしいです。'],
        ['allowEmail', 'on'],
        ['allowSms', 'on'],
      ],
    ])
  })

  it('should say what is wrong at its control, mark every box of a group, and put the focus on the first control with an error', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(text('名')).toHaveFocus()
    expect(text('名')).toHaveAccessibleDescription('名を入力してください。')
    expect(text('予備の電話番号')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('生年月日')).toHaveAccessibleDescription(
      '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
    )
    expect(part('好みのメニュー')).toHaveAccessibleDescription(
      '選択肢から選んでください。',
    )
    expect(text('姓')).not.toHaveAttribute('aria-invalid')
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
    await userEvent.type(text('職業'), '{Enter}')

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })
})
