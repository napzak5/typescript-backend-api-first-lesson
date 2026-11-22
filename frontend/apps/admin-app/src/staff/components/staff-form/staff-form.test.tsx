import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { readStaffChange, readStaffEntry } from '../../staff-form'
import { aStaffMember } from '../examples'
import * as staffFormStories from './staff-form.stories'

const stories = composeStories(staffFormStories)

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const box = (name: string): HTMLElement =>
  screen.getByRole('checkbox', { name })

const part = (name: string): HTMLElement => screen.getByRole('group', { name })

/** Runs a story whose form hands over what it was sent with to `received` */
const runReceiving = async (
  story: (typeof stories)['Entry'] | (typeof stories)['Change'],
): Promise<FormData[]> => {
  const received: FormData[] = []
  await story.run({
    args: {
      ...story.args,
      onSubmit: vi.fn((values: FormData) => {
        received.push(values)
      }),
    },
  })

  return received
}

describe('StaffForm', () => {
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
    ).toEqual(['名前', '連絡先', '雇用', '紹介', '予約の受け方', '在籍'])
    expect(within(part('名前')).getAllByRole('textbox')).toHaveLength(5)
    expect(within(part('雇用')).getAllByRole('combobox')).toHaveLength(1)
  })

  it('should open a new member as active, taking one booking at a time with no time kept around it', async () => {
    // Act
    await stories.Entry.run()

    // Assert: every other control is empty, the level among them
    const form = text('姓').closest('form')
    expect(
      form === null
        ? undefined
        : [...new FormData(form)].filter(([, value]) => value !== ''),
    ).toEqual([
      ['canReceiveBookings', 'on'],
      ['maxConcurrentBookings', '1'],
      ['bufferTimeBefore', '0'],
      ['bufferTimeAfter', '0'],
      ['isActive', 'on'],
    ])
    // The browser fills in no value of the user
    expect(
      [
        ...(form?.querySelectorAll(
          'input:not([type="checkbox"]):not([type="hidden"])',
        ) ?? []),
      ].map((input) => input.getAttribute('autocomplete')),
    ).toEqual(Array(21).fill('off'))
    expect(
      screen
        .getAllByRole('textbox')
        .filter((control) => control.hasAttribute('required'))
        .map((control) => control.getAttribute('name')),
    ).toEqual([
      'lastName',
      'firstName',
      'displayName',
      'email',
      'phoneNumber',
      'maxConcurrentBookings',
      'bufferTimeBefore',
      'bufferTimeAfter',
    ])
  })

  it('should offer the levels from the newest to the most experienced, and the days a hire may be on', async () => {
    // Act
    await stories.Entry.run()

    // Assert
    expect(
      within(screen.getByRole('combobox', { name: 'レベル' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      '選んでください',
      'ジュニア',
      'スタイリスト',
      'シニア',
      'エキスパート',
      'ディレクター',
    ])
    expect(screen.getByLabelText('入社日')).toHaveAttribute('min', '1900-01-01')
    expect(screen.getByLabelText('入社日')).toHaveAttribute('max', '2999-12-31')
  })

  it('should open with what the ledger has of a member', async () => {
    // Act
    await stories.Change.run()

    // Assert
    expect(text('姓')).toHaveValue('田中')
    expect(text('名（フリガナ）')).toHaveValue('ミサキ')
    expect(text('表示名')).toHaveValue('田中 美咲')
    expect(text('メールアドレス')).toHaveValue('misaki.tanaka@example.com')
    expect(text('予備の電話番号')).toHaveValue('')
    expect(text('スタッフコード')).toHaveValue('STF010')
    expect(screen.getByRole('combobox', { name: 'レベル' })).toHaveValue(
      'senior',
    )
    expect(text('雇用形態')).toHaveValue('正社員')
    expect(screen.getByLabelText('入社日')).toHaveValue('2018-04-01')
    expect(text('基本給（円）')).toHaveValue('280000')
    expect(text('歩合率（%）')).toHaveValue('12.5')
    expect(text('専門')).toHaveValue('カット、カラー')
    expect(text('資格')).toHaveValue('美容師免許、管理美容師')
    expect(text('経験年数（年）')).toHaveValue('8')
    expect(text('紹介文')).toHaveValue(
      'ショートカットと、透明感のあるカラーが得意です。\nお気軽にご相談ください。',
    )
    expect(screen.getByRole('textbox', { name: '写真の URL' })).toHaveValue(
      'https://photos.example.com/staff/misaki.jpg',
    )
    expect(box('予約を受ける')).toBeChecked()
    expect(text('同時に担当できる予約の数')).toHaveValue('2')
    expect(text('予約の後に確保する時間（分）')).toHaveValue('15')
    expect(box('有効なスタッフ')).toBeChecked()
  })

  it('should say what being active and taking bookings do', async () => {
    // Act
    await stories.Entry.run()

    // Assert
    expect(box('予約を受ける')).toHaveAccessibleDescription(
      '外すと、お客様が予約するときの空き枠に出なくなります。サロンが入れる予約の担当には、どちらでも選べます。',
    )
    expect(box('有効なスタッフ')).toHaveAccessibleDescription(
      '休職や退職の手続きの間は外します。外すと、このスタッフのログインアカウントはサロンの画面を使えなくなり、お客様が予約するときにも出なくなります。付け直すと、元に戻ります。',
    )
  })

  it('should hand over, as it opens, what lacks the values nobody can leave out of a new member', async () => {
    // Arrange
    const received = await runReceiving(stories.Entry)

    // Act
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    // Assert
    const [values] = received
    expect(values === undefined ? undefined : readStaffEntry(values)).toEqual({
      type: 'invalid',
      errors: {
        lastName: '姓を入力してください。',
        firstName: '名を入力してください。',
        displayName: '表示名を入力してください。',
        email: 'メールアドレスを入力してください。',
        phoneNumber: '電話番号を入力してください。',
        level: 'レベルを選んでください。',
      },
    })
  })

  it('should hand over, as it opens, what changes nothing of the member', async () => {
    // Arrange
    const received = await runReceiving(stories.Change)

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    const [values] = received
    expect(
      values === undefined
        ? undefined
        : readStaffChange(values, aStaffMember(), false),
    ).toEqual({ type: 'unchanged' })
  })

  it('should hand over what was changed, under the names of the request', async () => {
    // Arrange
    const received = await runReceiving(stories.Change)
    await userEvent.clear(text('歩合率（%）'))
    await userEvent.type(text('資格'), '、ヘアカラリスト')
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'レベル' }),
      'expert',
    )
    await userEvent.click(box('予約を受ける'))
    await userEvent.click(box('有効なスタッフ'))

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    const [values] = received
    expect(
      values === undefined
        ? undefined
        : readStaffChange(values, aStaffMember(), false),
    ).toEqual({
      type: 'valid',
      value: {
        level: 'expert',
        certifications: ['美容師免許', '管理美容師', 'ヘアカラリスト'],
        commissionRate: null,
        canReceiveBookings: false,
        isActive: false,
      },
    })
  })

  it('should say what is wrong at its control, and put the focus on the first control with an error', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(text('スタッフコード')).toHaveFocus()
    expect(text('スタッフコード')).toHaveAccessibleDescription(
      '社員番号など。台帳から削除したスタッフのものも含めて、同じコードは使えません。 このスタッフコードは、ほかのスタッフが使っています（台帳から削除したスタッフも含みます）。別のコードを入力してください。',
    )
    expect(box('有効なスタッフ')).toHaveAttribute('aria-invalid', 'true')
    expect(text('姓')).not.toHaveAttribute('aria-invalid')
  })
})
