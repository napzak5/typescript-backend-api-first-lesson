import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as formStories from './product-form.stories'

const stories = composeStories(formStories)

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

const checkbox = (name: string): HTMLElement =>
  screen.getByRole('checkbox', { name })

/** The values the form hands over when it is sent */
const sentBy = async (
  story: keyof typeof stories,
  act: () => Promise<void>,
  submitLabel: string,
): Promise<[string, FormDataEntryValue][]> => {
  const received: [string, FormDataEntryValue][][] = []
  await stories[story].run({
    args: {
      ...stories[story].args,
      onSubmit: vi.fn((values: FormData) => {
        received.push(Array.from(values.entries()))
      }),
    },
  })
  await act()
  await userEvent.click(screen.getByRole('button', { name: submitLabel }))

  return received.flat()
}

describe('ProductForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.New, () =>
    screen.getByRole('textbox', { name: '商品コード' }),
  )

  it('should group the controls in the parts a product is filled in by', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(
      screen.getAllByRole('group').map((group) => [
        group.querySelector('legend')?.textContent,
        within(group)
          .queryAllByRole('textbox')
          .concat(within(group).queryAllByRole('checkbox'))
          .map((control) => control.getAttribute('name')),
      ]),
    ).toEqual([
      [
        '商品',
        [
          'productCode',
          'unit',
          'name',
          'description',
          'category',
          'brand',
          'isForSale',
          'isForTreatment',
          'isActive',
        ],
      ],
      ['価格', ['purchasePrice', 'retailPrice', 'salonPrice']],
      ['在庫の水準', ['minimumStock', 'reorderPoint', 'maximumStock']],
      ['仕入れ', ['supplier', 'supplierProductCode', 'leadTimeDays']],
      [
        '管理',
        [
          'barcode',
          'expiryMonths',
          'storageConditions',
          'imageUrl',
          'safetyDataSheet',
          'requiresLotTracking',
        ],
      ],
    ])
  })

  it('should open a new product used in treatments, carried, and of a minimum stock of 0, and send what it holds', async () => {
    // Act
    const sent = await sentBy(
      'New',
      async () => {
        await userEvent.type(text(/^商品コード/), 'OIL001')
        await userEvent.type(text(/単位/), '本')
        await userEvent.type(text(/商品名/), 'ヘアオイル 100ml')
        await userEvent.type(text('販売価格'), '２,８００')
        await userEvent.type(text('発注点'), '3')
        await userEvent.click(checkbox('店頭で販売する'))
      },
      '足す',
    )

    // Assert
    expect(sent).toEqual([
      ['productCode', 'OIL001'],
      ['unit', '本'],
      ['name', 'ヘアオイル 100ml'],
      ['description', ''],
      ['category', ''],
      ['brand', ''],
      ['isForSale', 'on'],
      ['isForTreatment', 'on'],
      ['isActive', 'on'],
      ['purchasePrice', ''],
      ['retailPrice', ''],
      ['salonPrice', '２,８００'],
      ['minimumStock', '0'],
      ['reorderPoint', '3'],
      ['maximumStock', ''],
      ['supplier', ''],
      ['supplierProductCode', ''],
      ['leadTimeDays', ''],
      ['barcode', ''],
      ['expiryMonths', ''],
      ['storageConditions', ''],
      ['imageUrl', ''],
      ['safetyDataSheet', ''],
    ])
  })

  it('should open with the product as it is kept', async () => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(text(/^商品コード/)).toHaveValue('SHMP001')
    expect(text(/商品名/)).toHaveValue('プロフェッショナル シャンプー 500ml')
    expect(text('説明')).toHaveValue('サロン専売のシャンプー。\n乾燥した髪に。')
    expect(text(/カテゴリー/)).toHaveValue('ヘアケア')
    expect(text('仕入価格')).toHaveValue('1500')
    expect(text(/定価/)).toHaveValue('3500')
    expect(text(/最低在庫数/)).toHaveValue('5')
    expect(text(/発注点/)).toHaveValue('10')
    expect(text(/最大在庫数/)).toHaveValue('50')
    expect(text(/仕入先の商品コード/)).toHaveValue('TBS-SH-500')
    expect(text(/納品までの日数/)).toHaveValue('3')
    expect(text(/使用期限までの月数/)).toHaveValue('36')
    expect(text(/安全データシートの URL/)).toHaveValue(
      'https://docs.example.com/sds/shmp001.pdf',
    )
    expect(checkbox('店頭で販売する')).toBeChecked()
    expect(checkbox('施術で使う')).toBeChecked()
    expect(checkbox('取り扱い中')).toBeChecked()
    expect(checkbox('在庫をロット番号で分ける')).not.toBeChecked()
  })

  it('should say what is wrong under the control it belongs to', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(text(/^商品コード/)).toHaveAccessibleDescription(
      expect.stringContaining('商品コードを、100 文字以内で入力してください。'),
    )
    expect(text('仕入価格')).toHaveAccessibleDescription(
      '仕入価格は、0 以上の円の整数で入力してください。',
    )
    expect(text(/発注点/)).toHaveAccessibleDescription(
      expect.stringContaining('最低在庫数と同じか、それより大きい数'),
    )
    expect(text(/安全データシートの URL/)).toHaveAccessibleDescription(
      expect.stringContaining(
        'ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      ),
    )
  })

  it('should say what went wrong with the attempt above the form', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'このサロンの商品は、変えられません。',
    )
  })

  it.each<[string, string]>([
    [
      '商品コード',
      '100 文字まで。このサロンの、削除していないほかの商品と同じコードは使えません。取り扱いをやめた商品のコードも使えません。',
    ],
    ['単位', '本、個、ml など。20 文字まで。在庫の数を数える単位です。'],
    ['商品名', '255 文字まで。'],
    [
      'カテゴリー',
      '100 文字まで。商品台帳で、カテゴリーで探せます。在庫の評価額をカテゴリーごとに集計します。',
    ],
    ['ブランド', '100 文字まで。'],
    ['仕入先', '255 文字まで。'],
    ['仕入先の商品コード', '100 文字まで。発注するときに使います。'],
    ['バーコード', '100 文字まで。商品台帳で、バーコードで探せます。'],
    ['商品画像の URL', 'http:// か https:// で始まる URL。500 文字まで。'],
    [
      '安全データシートの URL',
      'メーカーの安全データシート（SDS）の URL。500 文字まで。',
    ],
  ])('should say at %s how long it may be', async (label, description) => {
    // Act
    await stories.New.run()

    // Assert
    expect(text(label)).toHaveAccessibleDescription(description)
  })
})
