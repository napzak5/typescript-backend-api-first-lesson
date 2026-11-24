import { languageStore } from '@beauty-salon-frontend/io'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  salonIdOf,
  signInAs,
} from '@beauty-salon-frontend/testing/api'
import {
  heading,
  rowsOf,
  termsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { inJapanese } from '@beauty-salon-frontend/ui'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, renderAt } from '../../__tests__/screens'
import {
  bookingsHrefOf,
  salonChangeHrefOf,
  settingsHrefOf,
} from '../../navigation'
import {
  dayOffArranged,
  phoneChangedMeanwhile,
  storedSalonOf,
} from '../__tests__/arrangements'

/*
 * The settings of a salon, read and changed against the API. The salon in
 * Tokyo of the seed data is open from Monday to Saturday and closed on
 * Sunday, charges tax at 10 %, and has a date of its calendar on each of
 * the seven days after the day of the seed; its owner and its manager
 * change its settings, its stylist reads them. Somebody did something
 * meanwhile where a test says so.
 */

/** Waits for the settings: their heading comes first, the record once the salon was read anew. */
const openedSettings = async (): Promise<void> => {
  await heading('サロンの設定')
  await screen.findByRole('region', { name: 'サロン' })
}

/** Waits for the form: its heading comes first, the form once the salon was read anew. */
const openedForm = async (): Promise<void> => {
  await heading('サロンの情報を直す')
  await screen.findByRole('group', { name: '会計' })
}

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const save = (): HTMLElement =>
  screen.getByRole('button', { name: '変更を保存する' })

describe('the settings of a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead the stylist from the header to every part of the settings, and offer no change', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(bookingsHrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Act
    await user.click(await screen.findByRole('link', { name: '設定' }))

    // Assert
    await openedSettings()
    expect(termsOf('サロン')).toEqual([
      ['名前', TOKYO],
      ['カナ', '記録なし'],
      ['紹介', 'Premium beauty salon in the heart of Tokyo'],
      ['オンライン予約', '受け付ける'],
      ['評価', '4.0（3 件のレビュー）'],
    ])
    expect(termsOf('所在地')).toEqual([
      ['郵便番号', '150-0002'],
      ['都道府県', 'Tokyo'],
      ['市区町村', 'Shibuya-ku'],
      ['町名・番地', '1-2-3 Shibuya'],
      ['建物', '記録なし'],
      ['地図の位置', '記録なし'],
    ])
    expect(termsOf('連絡先')).toEqual([
      ['電話番号', '+81-3-1234-5678'],
      ['予備の電話番号', '記録なし'],
      ['メールアドレス', 'info@beautystudio-tokyo.jp'],
      ['公式サイト', 'https://beautystudio-tokyo.jp'],
    ])
    expect(termsOf('写真')).toEqual([
      ['ロゴの URL', '記録なし'],
      [
        '写真の URL',
        'https://example.com/images/salon1-1.jpghttps://example.com/images/salon1-2.jpg',
      ],
    ])
    expect(termsOf('特徴と設備')).toEqual([
      ['特徴', 'Hair StylingHair ColorTreatmentHead Spa'],
      ['設備', 'なし'],
    ])
    expect(termsOf('会計')).toEqual([
      ['タイムゾーン', 'Asia/Tokyo'],
      ['通貨', 'JPY'],
      ['税率', '10%'],
      ['支払い方法', '支払い方法を見る'],
    ])
    expect(rowsOf('営業時間')).toEqual([
      ['月曜日', '10:00〜20:00'],
      ['火曜日', '10:00〜20:00'],
      ['水曜日', '10:00〜20:00'],
      ['木曜日', '10:00〜20:00'],
      ['金曜日', '10:00〜20:00'],
      ['土曜日', '10:00〜18:00'],
      ['日曜日', '休業'],
    ])
    expect(
      screen.queryByRole('link', { name: 'サロンの情報を直す' }),
    ).not.toBeInTheDocument()
  })

  it('should show the dates of the calendar from today on, a day off with its name and its note', async () => {
    // Arrange
    const day = await dayFromToday(3)
    await dayOffArranged(TOKYO, day)

    // Act
    await openAs(settingsHrefOf(await salonIdOf(TOKYO)), OWNER)

    // Assert
    await openedSettings()
    const calendar = rowsOf('営業日カレンダー')
    expect(calendar).toHaveLength(7)
    expect(calendar).toContainEqual([
      inJapanese(dayNameOf(day)),
      '終日休業',
      '臨時休業',
      '設備の点検',
    ])
    expect(
      calendar
        .map(([, , holiday]) => holiday)
        .filter((name) => name !== 'いいえ'),
    ).toEqual(['臨時休業'])
  })

  it('should let the manager change the description and the rate of tax from the settings, and change nothing else', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedSalonOf(TOKYO)
    await openAs(settingsHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedSettings()
    await user.click(screen.getByRole('link', { name: 'サロンの情報を直す' }))
    await openedForm()

    // Act
    await user.clear(text('紹介'))
    await user.type(text('紹介'), '渋谷の駅から歩いて 5 分です。')
    await user.clear(text('税率（%）'))
    await user.type(text('税率（%）'), '8')
    await user.click(save())

    // Assert
    expect(
      await screen.findByText('サロンの情報を直しました。'),
    ).toBeInTheDocument()
    await openedSettings()
    expect(termsOf('会計')).toContainEqual(['税率', '8%'])
    expect(termsOf('サロン')).toContainEqual([
      '紹介',
      '渋谷の駅から歩いて 5 分です。',
    ])
    expect(await storedSalonOf(TOKYO)).toEqual({
      ...before,
      description: '渋谷の駅から歩いて 5 分です。',
      taxRate: '8.00',
      updatedAt: expect.any(String),
    })
  })

  it('should leave as it is what somebody else changed meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(salonChangeHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedForm()
    await user.type(text('特徴'), '、ヘッドスパ')
    await user.click(
      screen.getByRole('checkbox', { name: 'オンライン予約を受け付ける' }),
    )
    await phoneChangedMeanwhile(TOKYO, '03-5555-0000')

    // Act
    await user.click(save())

    // Assert
    await openedSettings()
    expect(await storedSalonOf(TOKYO)).toMatchObject({
      phoneNumber: '03-5555-0000',
      features: [
        'Hair Styling',
        'Hair Color',
        'Treatment',
        'Head Spa',
        'ヘッドスパ',
      ],
      isActive: false,
    })
    expect(termsOf('サロン')).toContainEqual(['オンライン予約', '止めている'])
    expect(termsOf('連絡先')).toContainEqual(['電話番号', '03-5555-0000'])
  })

  it('should ask the API for nothing when nothing was changed', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedSalonOf(TOKYO)
    await openAs(salonChangeHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedForm()

    // Act
    await user.click(save())

    // Assert
    expect(
      await screen.findByText('変更された項目はありません。'),
    ).toBeInTheDocument()
    await openedSettings()
    expect(await storedSalonOf(TOKYO)).toEqual(before)
  })

  it('should say what is wrong at the controls before sending, and ask the API for nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedSalonOf(TOKYO)
    await openAs(salonChangeHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedForm()

    // Act
    await user.clear(text('名前'))
    await user.type(text('緯度'), '135.5')
    await user.clear(text('税率（%）'))
    await user.type(text('税率（%）'), '101')
    await user.click(save())

    // Assert
    expect(text('名前')).toHaveAccessibleDescription(
      expect.stringContaining(
        'サロンの名前を、255 文字以内で入力してください。',
      ),
    )
    expect(text('緯度')).toHaveAccessibleDescription(
      expect.stringContaining('緯度は、-90 から 90 までの数'),
    )
    expect(text('税率（%）')).toHaveAccessibleDescription(
      expect.stringContaining('税率は、0 から 100 までの数'),
    )
    expect(await storedSalonOf(TOKYO)).toEqual(before)
  })

  it('should say at the email address that another salon uses it', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedSalonOf(TOKYO)
    await openAs(salonChangeHrefOf(await salonIdOf(TOKYO)), OWNER)
    await openedForm()
    await user.clear(text('メールアドレス'))
    await user.type(text('メールアドレス'), 'contact@hairspa-osaka.jp')

    // Act
    await user.click(save())

    // Assert
    await vi.waitFor(() =>
      expect(text('メールアドレス')).toHaveAccessibleDescription(
        expect.stringContaining(
          'このメールアドレスは、ほかのサロンが使っています。',
        ),
      ),
    )
    expect(await storedSalonOf(TOKYO)).toEqual(before)
  })

  it('should refuse a stylist the form', async () => {
    // Act
    await openAs(salonChangeHrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'このアカウントでは、サロンの設定を変えられません。設定を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('should tell the manager of another salon that its settings are not theirs to change', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedSalonOf(OSAKA)
    await openAs(salonChangeHrefOf(await salonIdOf(OSAKA)), MANAGER)
    await openedForm()
    await user.clear(text('税率（%）'))
    await user.type(text('税率（%）'), '8')

    // Act
    await user.click(save())

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このサロンの設定は、変えられません。設定を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    )
    expect(await storedSalonOf(OSAKA)).toEqual(before)
  })

  it.each<[string, (salonId: string) => string, () => Promise<void>]>([
    ['the settings', settingsHrefOf, openedSettings],
    ['the form', salonChangeHrefOf, openedForm],
  ])(
    'should have no accessibility violations on %s',
    async (_case, hrefOf, opened) => {
      // Arrange
      const { container } = renderAt(hrefOf(await salonIdOf(TOKYO)))
      await signInAs(OWNER)

      // Act
      await opened()

      // Assert
      expect(await findAccessibilityViolations(container)).toEqual([])
    },
  )
})

describe('the settings of a salon on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should show the stylist the settings in English', async () => {
    // Act
    await openAs(settingsHrefOf(await salonIdOf(TOKYO)), STYLIST, 'en')

    // Assert
    await heading('Salon settings')
    await screen.findByRole('region', { name: 'Salon' })
    expect(termsOf('Salon')).toEqual([
      ['Name', TOKYO],
      ['Name in kana', 'Not recorded'],
      ['Introduction', 'Premium beauty salon in the heart of Tokyo'],
      ['Online booking', 'Accepted'],
      ['Rating', '4.0 (3 reviews)'],
    ])
    expect(termsOf('Accounting')).toEqual([
      ['Time zone', 'Asia/Tokyo'],
      ['Currency', 'JPY'],
      ['Tax rate', '10%'],
      ['Payment methods', 'See the payment methods'],
    ])
    expect(rowsOf('Hours')).toContainEqual(['Sunday', 'Closed'])
    expect(rowsOf('Calendar').map(([, , holiday]) => holiday)).toContain('No')
  })

  it('should say in English what is wrong, then save the change and say so in English', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(salonChangeHrefOf(await salonIdOf(TOKYO)), MANAGER, 'en')
    await heading('Edit the salon information')
    await screen.findByRole('group', { name: 'Accounting' })
    const taxRate = text('Tax rate (%)')
    await user.clear(taxRate)
    await user.type(taxRate, '101')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(taxRate).toHaveAccessibleDescription(
      expect.stringContaining(
        'Enter the tax rate as a number from 0 to 100, with up to 2 decimal places.',
      ),
    )
    await user.clear(taxRate)
    await user.type(taxRate, '8')

    // Act
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // Assert
    expect(
      await screen.findByText('Saved the salon information.'),
    ).toBeInTheDocument()
    await screen.findByRole('region', { name: 'Accounting' })
    expect(termsOf('Accounting')).toContainEqual(['Tax rate', '8%'])
  })
})
