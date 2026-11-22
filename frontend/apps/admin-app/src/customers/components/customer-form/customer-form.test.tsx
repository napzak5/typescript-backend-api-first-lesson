import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import {
  readCustomerChange,
  readCustomerEntry,
} from '../../utils/customer-form'
import * as customerFormStories from './customer-form.stories'

const stories = composeStories(customerFormStories)

const TODAY = '2026-11-20'

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const choice = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name })

const box = (name: string): HTMLElement =>
  screen.getByRole('checkbox', { name })

const part = (name: string): HTMLElement => screen.getByRole('group', { name })

/** Sends the form of a story and gives what it handed over */
const sent = async (
  story: (typeof stories)['Entry'] | (typeof stories)['Change'],
  submitLabel: string,
): Promise<FormData | undefined> => {
  const received: FormData[] = []
  await story.run({
    args: {
      ...story.args,
      onSubmit: vi.fn((values: FormData) => {
        received.push(values)
      }),
    },
  })
  await userEvent.click(screen.getByRole('button', { name: submitLabel }))

  return received[0]
}

describe('CustomerForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Entry, () =>
    screen.getByRole('textbox', { name: '姓' }),
  )

  it('should have its controls in parts that are named', async () => {
    // Act
    await stories.Entry.run()

    // Assert
    expect(
      screen
        .getAllByRole('group')
        .map((group) => group.querySelector('legend')?.textContent),
    ).toEqual([
      'お名前',
      '連絡先',
      '住所',
      'お客様について',
      '髪と頭皮',
      '好み',
      '好みのメニュー',
      'サロンでの扱い',
      '紹介',
      '送ってよい連絡',
      'メモ',
    ])
    expect(within(part('お名前')).getAllByRole('textbox')).toHaveLength(4)
    expect(within(part('髪と頭皮')).getAllByRole('combobox')).toHaveLength(3)
  })

  it('should open a new customer with what the ledger gives one nobody said more of', async () => {
    // Act
    await stories.Entry.run()

    // Assert
    for (const control of screen
      .getAllByRole('textbox')
      .filter((textbox) => !textbox.hasAttribute('readonly'))) {
      expect(control).toHaveValue('')
    }
    expect(text('紹介元')).toHaveValue('なし')
    // The browser fills in no value of the user: a text area it fills in none,
    // and nobody writes in the name of the referrer
    expect(
      [
        ...(text('姓')
          .closest('form')
          ?.querySelectorAll(
            'input:not([type="checkbox"]):not([type="hidden"]):not([readonly])',
          ) ?? []),
      ].map((input) => input.getAttribute('autocomplete')),
    ).toEqual(Array(16).fill('off'))
    expect(screen.getByLabelText('生年月日')).toHaveValue('')
    expect(choice('性別')).toHaveValue('')
    expect(choice('髪質')).toHaveValue('')
    expect(choice('会員ランク')).toHaveValue('regular')
    expect(choice('ステータス')).toHaveValue('active')
    expect(box('有効なお客様')).toBeChecked()
    expect(
      screen
        .getAllByRole('checkbox', { checked: true })
        .map((checked) => checked.getAttribute('name')),
    ).toEqual(['isActive'])
    expect(
      screen
        .getAllByRole('textbox')
        .filter((control) => control.hasAttribute('required'))
        .map((control) => control.getAttribute('name')),
    ).toEqual(['lastName', 'firstName', 'email', 'phoneNumber'])
  })

  it('should open with what the ledger has of a customer', async () => {
    // Act
    await stories.Change.run()

    // Assert
    expect(text('姓')).toHaveValue('山田')
    expect(text('名（フリガナ）')).toHaveValue('ハナコ')
    expect(text('メールアドレス')).toHaveValue('hanako@example.com')
    expect(text('予備の電話番号')).toHaveValue('03-1234-5678')
    expect(text('建物名・部屋番号')).toHaveValue('ハイツ 101')
    expect(screen.getByLabelText('生年月日')).toHaveValue('1990-04-01')
    expect(choice('性別')).toHaveValue('female')
    expect(text('職業')).toHaveValue('会社員')
    expect(choice('髪質')).toHaveValue('wavy')
    expect(choice('髪の太さ')).toHaveValue('thin')
    expect(choice('頭皮の状態')).toHaveValue('sensitive')
    expect(
      within(part('好みのメニュー'))
        .getAllByRole('checkbox', { checked: true })
        .map((checked) => checked.getAttribute('value')),
    ).toEqual(['cut', 'spa'])
    expect(text('好みについてのメモ')).toHaveValue('炭酸泉が好き')
    expect(choice('会員ランク')).toHaveValue('gold')
    expect(choice('ステータス')).toHaveValue('vip')
    expect(text('タグ')).toHaveValue('VIP、常連')
    expect(text('紹介コード')).toHaveValue('HANAKO-2026')
    expect(text('紹介元')).toHaveValue('鈴木 一郎 様')
    expect(box('メールでの連絡')).toBeChecked()
    expect(box('SMS での連絡')).toBeChecked()
    expect(box('キャンペーンなどのお知らせ')).not.toBeChecked()
    expect(text('備考')).toHaveValue('駐車場を使う')
    expect(text('スタッフ間の申し送り')).toHaveValue(
      '前回、カラーで頭皮がしみた',
    )
  })

  it('should offer every value of the contract, after the choice to record none where none may be', async () => {
    // Act
    await stories.Entry.run()

    // Assert
    expect(optionsOf(choice('性別'))).toEqual([
      '記録しない',
      '男性',
      '女性',
      'その他',
      '回答しない',
    ])
    expect(optionsOf(choice('髪質'))).toEqual([
      '記録しない',
      'ストレート',
      'ウェーブ',
      'カール',
      '強いカール',
    ])
    expect(optionsOf(choice('髪の太さ'))).toEqual([
      '記録しない',
      '細い',
      'ふつう',
      '太い',
    ])
    expect(optionsOf(choice('頭皮の状態'))).toEqual([
      '記録しない',
      'ふつう',
      '乾燥',
      '脂性',
      '敏感',
      'フケが出やすい',
    ])
    expect(optionsOf(choice('会員ランク'))).toEqual([
      'レギュラー',
      'シルバー',
      'ゴールド',
      'プラチナ',
      'VIP',
    ])
    expect(optionsOf(choice('ステータス'))).toEqual([
      '通常',
      '休眠',
      'VIP',
      '利用停止',
    ])
    expect(
      within(part('好みのメニュー'))
        .getAllByRole('checkbox')
        .map((option) => option.getAttribute('value')),
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
    expect(screen.getByLabelText('生年月日')).toHaveAttribute(
      'min',
      '1900-01-01',
    )
    expect(screen.getByLabelText('生年月日')).toHaveAttribute('max', TODAY)
  })

  it('should say what the state and the box of an active customer do to the bookings a customer makes', async () => {
    // Act
    await stories.Entry.run()

    // Assert
    expect(choice('ステータス')).toHaveAccessibleDescription(
      '休眠と利用停止のお客様は、ご自分では予約を入れられません。',
    )
    expect(box('有効なお客様')).toHaveAccessibleDescription(
      '外すと、お客様はご自分では予約を入れたり、日時を変えたりできなくなります。サロンが入れる予約は、どちらでも入れられます。',
    )
  })

  it('should hand over, as it opens, what makes a new customer the ledger gives one nobody said more of', async () => {
    // Act
    const values = await sent(stories.Entry, '登録する')

    // Assert
    const read =
      values === undefined ? undefined : readCustomerEntry(values, TODAY)
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        lastName: '姓を入力してください。',
        firstName: '名を入力してください。',
        email: 'メールアドレスを入力してください。',
        phoneNumber: '電話番号を入力してください。',
      },
    })
  })

  it('should hand over, as it opens, what changes nothing of the customer', async () => {
    // Act
    const values = await sent(stories.Change, '変更を保存する')

    // Assert
    expect(
      values === undefined
        ? undefined
        : readCustomerChange(values, customerFormStories.RECORDED, TODAY),
    ).toEqual({ type: 'unchanged' })
  })

  it('should hand over what was changed, under the names of the request', async () => {
    // Arrange
    const received: FormData[] = []
    await stories.Change.run({
      args: {
        ...stories.Change.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(values)
        }),
      },
    })
    await userEvent.clear(text('建物名・部屋番号'))
    await userEvent.selectOptions(choice('頭皮の状態'), '記録しない')
    await userEvent.click(box('カラー'))
    await userEvent.click(box('有効なお客様'))
    await userEvent.type(text('タグ'), '、紹介')
    await userEvent.click(box('キャンペーンなどのお知らせ'))

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    const [values] = received
    expect(
      values === undefined
        ? undefined
        : readCustomerChange(values, customerFormStories.RECORDED, TODAY),
    ).toEqual({
      type: 'valid',
      value: {
        building: null,
        preferences: {
          preferredServices: ['cut', 'color', 'spa'],
          notes: '炭酸泉が好き',
        },
        tags: ['VIP', '常連', '紹介'],
        allowMarketing: true,
        isActive: false,
        scalpCondition: null,
      },
    })
  })

  it('should say what is wrong at its control, and put the focus on the first control with an error', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(text('メールアドレス')).toHaveFocus()
    expect(text('メールアドレス')).toHaveAccessibleDescription(
      '台帳のお客様の間で、同じアドレスは使えません。 このメールアドレスのお客様が、すでに台帳にいます。台帳で探すか、別のメールアドレスを入力してください。',
    )
    expect(part('好みのメニュー')).toHaveAccessibleDescription(
      'この値は受け付けられませんでした。入力を確かめてください。',
    )
    expect(text('姓')).not.toHaveAttribute('aria-invalid')
  })

  it('should choose the referrer from the ledger and hand them over', async () => {
    // Arrange
    const received: FormData[] = []
    await stories.Entry.run({
      args: {
        ...stories.Entry.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(values)
        }),
      },
    })
    await userEvent.click(screen.getByRole('button', { name: '紹介元を選ぶ' }))
    const dialog = screen.getByRole('dialog', { name: '紹介元を選ぶ' })

    // Act
    await userEvent.click(
      within(dialog).getByRole('button', { name: '鈴木 一郎' }),
    )

    // Assert
    expect(dialog).not.toBeVisible()
    expect(text('紹介元')).toHaveValue('鈴木 一郎 様')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))
    expect(received[0]?.get('referredBy')).toBe(
      'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
    )
  })

  it('should keep the referrer when the choice is given up', async () => {
    // Arrange
    await stories.Change.run()
    await userEvent.click(screen.getByRole('button', { name: '紹介元を選ぶ' }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'やめる' }))

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(text('紹介元')).toHaveValue('鈴木 一郎 様')
  })

  it('should hand over no referrer once the one the customer had was taken away', async () => {
    // Arrange
    const received: FormData[] = []
    await stories.Change.run({
      args: {
        ...stories.Change.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(values)
        }),
      },
    })
    await userEvent.click(screen.getByRole('button', { name: '紹介元を外す' }))

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    const [values] = received
    expect(
      values === undefined
        ? undefined
        : readCustomerChange(values, customerFormStories.RECORDED, TODAY),
    ).toEqual({ type: 'valid', value: { referredBy: null } })
  })

  it('should say what is wrong with the referrer at its field, and put the focus there', async () => {
    // Act
    await stories.ReferrerRefused.run()

    // Assert
    expect(text('紹介元')).toHaveFocus()
    expect(text('紹介元')).toHaveAttribute('aria-invalid', 'true')
  })

  it('should be busy, and hand over nothing more, while an attempt is on its way', async () => {
    // Arrange
    await stories.Pending.run()
    const button = screen.getByRole('button', { name: '登録する' })

    // Act
    await userEvent.click(button)

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Pending.args.onSubmit).not.toHaveBeenCalled()
  })
})
