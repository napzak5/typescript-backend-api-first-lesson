import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as salonFormStories from './salon-form.stories'

const stories = composeStories(salonFormStories)

const text = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name })

const valueIn = (control: HTMLElement): string | undefined =>
  'value' in control && typeof control.value === 'string'
    ? control.value
    : undefined

/** The controls of the form, by the names of their labels */
const LABELS = [
  '名前',
  'カナ',
  '紹介',
  '郵便番号',
  '都道府県',
  '市区町村',
  '町名・番地',
  '建物',
  '緯度',
  '経度',
  '電話番号',
  '予備の電話番号',
  'メールアドレス',
  '公式サイト',
  'ロゴの URL',
  '写真の URL',
  '特徴',
  '設備',
  '税率（%）',
]

describe('SalonForm', () => {
  it('should open with what the salon has', async () => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(LABELS.map((label) => valueIn(text(label)))).toEqual([
      'Salon Hikari 表参道店',
      'サロン ヒカリ オモテサンドウテン',
      '表参道の駅から歩いて 3 分です。\n個室もあります。',
      '150-0001',
      '東京都',
      '渋谷区',
      '神宮前 4-1-1',
      '光ビル 2 階',
      '35.665',
      '139.7121',
      '03-1234-5678',
      '090-1234-5678',
      'omotesando@example.com',
      'https://hikari.example.com',
      'https://hikari.example.com/logo.png',
      'https://hikari.example.com/photos/entrance.jpg\nhttps://hikari.example.com/photos/seats.jpg',
      'カット、カラー、ヘッドスパ',
      'Wi-Fi、個室',
      '10',
    ])
    expect(
      screen.getByRole('checkbox', { name: 'オンライン予約を受け付ける' }),
    ).toBeChecked()
    expect(
      screen.getByText(
        'タイムゾーン（Asia/Tokyo）と通貨（JPY）は、変えられません。予約の日時と料金は、これらで読みます。',
      ),
    ).toBeInTheDocument()
  })

  it('should leave empty what the salon has not recorded', async () => {
    // Act
    await stories.LittleRecorded.run()

    // Assert
    expect(
      [
        'カナ',
        '紹介',
        '建物',
        '緯度',
        '経度',
        '予備の電話番号',
        '写真の URL',
        '特徴',
      ].map((label) => valueIn(text(label))),
    ).toEqual(['', '', '', '', '', '', '', ''])
  })

  it('should send every value under the name of its property', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Recorded.run({
      args: {
        ...stories.Recorded.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'オンライン予約を受け付ける' }),
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    expect(received.map((entries) => entries.map(([name]) => name))).toEqual([
      [
        'name',
        'nameKana',
        'description',
        'postalCode',
        'prefecture',
        'city',
        'address',
        'building',
        'latitude',
        'longitude',
        'phoneNumber',
        'alternativePhone',
        'email',
        'websiteUrl',
        'logoUrl',
        'imageUrls',
        'features',
        'amenities',
        'taxRate',
      ],
    ])
  })

  it('should say what is wrong at the controls', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(text('名前')).toHaveAccessibleDescription(
      expect.stringContaining(
        'サロンの名前を、255 文字以内で入力してください。',
      ),
    )
    expect(text('緯度')).toHaveAccessibleDescription(
      expect.stringContaining('緯度は、-90 から 90 までの数'),
    )
    expect(text('メールアドレス')).toHaveAccessibleDescription(
      expect.stringContaining('ほかのサロンが使っています。'),
    )
    expect(text('税率（%）')).toHaveAccessibleDescription(
      expect.stringContaining('税率は、0 から 100 までの数'),
    )
  })

  it('should open a salon to be added empty, with the tax, the time zone and the currency of Japan, and no bookings online', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(LABELS.map((label) => valueIn(text(label)))).toEqual([
      ...Array.from({ length: LABELS.length - 1 }, () => ''),
      '10',
    ])
    expect(
      screen.getByRole('checkbox', { name: 'オンライン予約を受け付ける' }),
    ).not.toBeChecked()
    expect(screen.getByRole('combobox', { name: 'タイムゾーン' })).toHaveValue(
      'Asia/Tokyo',
    )
    expect(screen.getByRole('combobox', { name: '通貨' })).toHaveValue('JPY')
    expect(
      screen.getByRole('option', { name: 'JPY（日本円）' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/^タイムゾーン（.+）と通貨（.+）は、変えられません。/),
    ).not.toBeInTheDocument()
  })

  it('should send the time zone and the currency chosen for a salon to be added', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.New.run({
      args: {
        ...stories.New.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(
            Array.from(values.entries()).filter(([name]) =>
              ['timezone', 'currency'].includes(name),
            ),
          )
        }),
      },
    })
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'タイムゾーン' }),
      'Asia/Seoul',
    )
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '通貨' }),
      'KRW',
    )

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'サロンを登録する' }),
    )

    // Assert
    expect(received).toEqual([
      [
        ['timezone', 'Asia/Seoul'],
        ['currency', 'KRW'],
      ],
    ])
  })

  it('should say what is wrong with the time zone and the currency at their controls', async () => {
    // Act
    await stories.NewWithErrors.run()

    // Assert
    expect(
      screen.getByRole('combobox', { name: 'タイムゾーン' }),
    ).toHaveAccessibleDescription(/タイムゾーンを選んでください。/)
    expect(
      screen.getByRole('combobox', { name: '通貨' }),
    ).toHaveAccessibleDescription(/通貨を選んでください。/)
  })

  it('should say what went wrong with the attempt', async () => {
    // Act
    await stories.NotChanged.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'サロンの情報を直せませんでした。',
    )
  })

  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Recorded, () =>
    screen.getByRole('textbox', { name: '名前' }),
  )

  it.each<[string, string]>([
    ['名前', '255 文字まで。お客様がサロンを探すときに出ます。'],
    ['カナ', '255 文字まで。'],
    ['郵便番号', '10 文字まで。'],
    ['公式サイト', 'http:// か https:// で始まる URL。500 文字まで。'],
    ['ロゴの URL', 'http:// か https:// で始まる URL。500 文字まで。'],
  ])('should say at %s how long it may be', async (label, description) => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(text(label)).toHaveAccessibleDescription(description)
  })
})

describe('SalonForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its parts and controls in English, and the tags in the way English writes them', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Recorded.run()

    // Assert
    expect(
      screen
        .getAllByRole('group')
        .map((group) => group.firstChild?.textContent),
    ).toEqual([
      'Salon',
      'Location',
      'Contact',
      'Photos',
      'Features and amenities',
      'Accounting',
    ])
    expect(text('Name')).toHaveAccessibleDescription(
      'Up to 255 characters. Shown when customers look for a salon.',
    )
    expect(text('Website')).toHaveAccessibleDescription(
      'A URL that begins with http:// or https://. Up to 500 characters.',
    )
    expect(valueIn(text('Features'))).toBe('カット, カラー, ヘッドスパ')
    expect(text('Tax rate (%)')).toHaveValue('10')
    expect(
      screen.getByRole('checkbox', { name: 'Accept online bookings' }),
    ).toBeChecked()
    expect(
      screen.getByText(
        'The time zone (Asia/Tokyo) and the currency (JPY) cannot be changed. The times of the bookings and the prices are read in them.',
      ),
    ).toBeInTheDocument()
  })

  it('should say in English what is wrong at the controls', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(text('Name')).toHaveAccessibleDescription(
      /Salon name: enter 1 to 255 characters\./,
    )
    expect(text('Latitude')).toHaveAccessibleDescription(
      /Enter the latitude as a number from -90 to 90, with up to 8 decimal places\./,
    )
    expect(text('Email address')).toHaveAccessibleDescription(
      /Another salon uses this email address\./,
    )
  })

  it('should offer the currencies of a salon to be added by their codes and English names', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NewWithErrors.run()

    // Assert
    expect(
      screen.getByRole('option', { name: 'JPY (Japanese Yen)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Time zone' }),
    ).toHaveAccessibleDescription(/Choose a time zone\./)
  })

  it('should say in English what went wrong with the attempt', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NotChanged.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save the salon information.',
    )
  })
})
