import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf, signInAs } from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OSAKA,
  OWNER,
  STYLIST,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs, renderAt } from '../../__tests__/screens'
import {
  paymentMethodChangeHrefOf,
  paymentMethodEntryHrefOf,
  paymentMethodHrefOf,
  paymentMethodsHrefOf,
  settingsHrefOf,
} from '../../navigation'
import {
  methodIdOf,
  paidMeanwhileBy,
  storedMethodsOf,
} from '../__tests__/arrangements'

/*
 * The payment methods of a salon, read and kept against the API. Every
 * salon of the seed data has the same seven methods, all used, none of
 * which a payment was received by; the owner and the manager of the salon
 * in Tokyo keep its methods, its stylist reads them. Somebody did
 * something meanwhile where a test says so.
 */

/** Waits for the list: its heading comes first, the table once the methods were read anew. */
const openedList = async (): Promise<void> => {
  await heading('支払い方法')
  await screen.findByRole('table', { name: '支払い方法' })
}

/** Waits for a method: its heading comes first, the record once the method was read. */
const openedMethod = async (): Promise<void> => {
  await heading('支払い方法の内容')
  await screen.findByRole('region', { name: '支払い方法' })
}

/** Waits for a form: its heading comes first, the form once what it needs was read. */
const openedForm = async (title: string): Promise<void> => {
  await heading(title)
  await screen.findByRole('textbox', { name: /表示名/ })
}

/** What the record of a method says, term by term. */
const terms = (name = '支払い方法'): [string, string][] =>
  within(screen.getByRole('region', { name }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

const checkbox = (name: string): HTMLElement =>
  screen.getByRole('checkbox', { name })

const SEEDED = [
  ['Cash', '現金', '下限も上限もなし', '手数料なし', '店頭', '使っている'],
  [
    'Credit Card',
    'クレジットカード',
    '￥1,000から',
    '3.6%',
    '店頭、オンライン',
    '使っている',
  ],
  [
    'Debit Card',
    'デビットカード',
    '￥1,000から',
    '2.9%',
    '店頭、オンライン',
    '使っている',
  ],
  [
    'E-Money (IC Card)',
    '電子マネー',
    '￥20,000まで',
    '3.25%',
    '店頭',
    '使っている',
  ],
  [
    'QR Code Payment',
    'QR コード決済',
    '下限も上限もなし',
    '2.95%',
    '店頭、オンライン',
    '使っている',
  ],
  [
    'Bank Transfer',
    '銀行振込',
    '￥10,000から',
    '手数料なし',
    'オンライン',
    '使っている',
  ],
  [
    'Point Payment',
    'ポイント',
    '￥100から',
    '手数料なし',
    '店頭、オンライン',
    '使っている',
  ],
]

describe('the payment methods of a salon, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead the stylist from the settings to the methods and to one of them, and offer no change', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(settingsHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await heading('サロンの設定')

    // Act
    await user.click(
      await screen.findByRole('link', { name: '支払い方法を見る' }),
    )

    // Assert
    await openedList()
    expect(rowsOf('支払い方法')).toEqual(SEEDED)
    expect(
      screen.queryByRole('link', { name: '支払い方法を足す' }),
    ).not.toBeInTheDocument()

    // Act
    await user.click(screen.getByRole('link', { name: 'Credit Card' }))

    // Assert
    await openedMethod()
    expect(terms()).toEqual([
      ['表示名', 'Credit Card'],
      ['種類', 'クレジットカード'],
      ['説明', 'Visa, MasterCard, JCB, AMEX accepted'],
      ['1 回の金額', '￥1,000から'],
      ['手数料率', '3.6%'],
      ['決済代行会社', 'Stripe'],
      ['使う場所', '店頭、オンライン'],
      ['状態', '使っている'],
      ['並び順', '2'],
    ])
    expect(
      screen.queryByRole('link', { name: '支払い方法を直す' }),
    ).not.toBeInTheDocument()
  })

  it('should let the manager add a method, last in the order, and show it', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(paymentMethodsHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedList()
    await user.click(screen.getByRole('link', { name: '支払い方法を足す' }))
    await openedForm('支払い方法を足す')
    expect(text(/並び順/)).toHaveValue('8')

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: /種類/ }),
      'QR コード決済',
    )
    await user.type(text(/表示名/), 'PayPay（店頭）')
    await user.type(text('1 回の金額の上限（円）'), '50,000')
    await user.type(text('手数料率（%）'), '1.98')
    await user.type(text('決済代行会社'), 'PayPay')
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(
      await screen.findByText('支払い方法「PayPay（店頭）」を足しました。'),
    ).toBeInTheDocument()
    await openedMethod()
    expect(firstSight()[1]).toContain('￥50,000まで')
    expect(terms()).toEqual([
      ['表示名', 'PayPay（店頭）'],
      ['種類', 'QR コード決済'],
      ['説明', '記録なし'],
      ['1 回の金額', '￥50,000まで'],
      ['手数料率', '1.98%'],
      ['決済代行会社', 'PayPay'],
      ['使う場所', '店頭'],
      ['状態', '使っている'],
      ['並び順', '8'],
    ])
    expect((await storedMethodsOf(TOKYO)).at(-1)).toEqual({
      method: 'qr_payment',
      displayName: 'PayPay（店頭）',
      description: null,
      processorName: 'PayPay',
      fee: '1.98',
      minimumAmount: null,
      maximumAmount: 50000,
      isOnlineEnabled: false,
      isOfflineEnabled: true,
      sortOrder: 8,
      isActive: true,
      updatedAt: expect.any(String),
    })

    // Act
    await user.click(screen.getByRole('link', { name: '支払い方法へ' }))

    // Assert
    await openedList()
    expect(rowsOf('支払い方法').at(-1)).toEqual([
      'PayPay（店頭）',
      'QR コード決済',
      '￥50,000まで',
      '1.98%',
      '店頭',
      '使っている',
    ])
  })

  it('should let the manager change a method from its screen, and change nothing else', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedMethodsOf(TOKYO)
    const salonId = await salonIdOf(TOKYO)
    await openAs(
      paymentMethodHrefOf(salonId, await methodIdOf(TOKYO, 'Credit Card')),
      MANAGER,
    )
    await openedMethod()
    await user.click(screen.getByRole('link', { name: '支払い方法を直す' }))
    await openedForm('支払い方法を直す')

    // Act
    await user.clear(text('手数料率（%）'))
    await user.type(text('手数料率（%）'), '3.24')
    await user.clear(text('決済代行会社'))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText('支払い方法「Credit Card」を直しました。'),
    ).toBeInTheDocument()
    await openedMethod()
    expect(firstSight()[1]).toContain('3.24%')
    expect(terms()).toEqual(
      expect.arrayContaining([
        ['手数料率', '3.24%'],
        ['決済代行会社', '記録なし'],
      ]),
    )
    expect(await storedMethodsOf(TOKYO)).toEqual(
      before.map((method) =>
        method.displayName === 'Credit Card'
          ? {
              ...method,
              fee: '3.24',
              processorName: null,
              updatedAt: expect.any(String),
            }
          : method,
      ),
    )
  })

  it('should let the owner stop using a method, which the list then says', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      paymentMethodChangeHrefOf(
        await salonIdOf(TOKYO),
        await methodIdOf(TOKYO, 'QR Code Payment'),
      ),
      OWNER,
    )
    await openedForm('支払い方法を直す')

    // Act
    await user.click(checkbox('この支払い方法を使う'))
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))
    await openedMethod()
    await user.click(screen.getByRole('link', { name: '支払い方法へ' }))

    // Assert
    await openedList()
    expect(rowsOf('支払い方法')[4]).toEqual([
      'QR Code Payment',
      'QR コード決済',
      '下限も上限もなし',
      '2.95%',
      '店頭、オンライン',
      '使っていない',
    ])
    expect((await storedMethodsOf(TOKYO))[4]).toMatchObject({
      displayName: 'QR Code Payment',
      isActive: false,
    })
  })

  it('should let the owner remove a method no payment was received by, after asking', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      paymentMethodChangeHrefOf(
        await salonIdOf(TOKYO),
        await methodIdOf(TOKYO, 'Bank Transfer'),
      ),
      OWNER,
    )
    await openedForm('支払い方法を直す')
    await user.click(screen.getByRole('button', { name: '削除' }))
    const dialog = screen.getByRole('dialog', {
      name: '支払い方法「Bank Transfer」を削除しますか？',
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: '削除する' }))

    // Assert
    expect(
      await screen.findByText('支払い方法「Bank Transfer」を削除しました。'),
    ).toBeInTheDocument()
    await openedList()
    expect(rowsOf('支払い方法').map(([name]) => name)).toEqual([
      'Cash',
      'Credit Card',
      'Debit Card',
      'E-Money (IC Card)',
      'QR Code Payment',
      'Point Payment',
    ])
    expect(
      (await storedMethodsOf(TOKYO)).map(({ displayName }) => displayName),
    ).not.toContain('Bank Transfer')
  })

  it('should keep a method a payment was received by meanwhile, and say to stop using it instead', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedMethodsOf(TOKYO)
    await openAs(
      paymentMethodChangeHrefOf(
        await salonIdOf(TOKYO),
        await methodIdOf(TOKYO, 'Cash'),
      ),
      OWNER,
    )
    await openedForm('支払い方法を直す')
    await paidMeanwhileBy(TOKYO, 'Cash')
    await user.click(screen.getByRole('button', { name: '削除' }))

    // Act
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '削除する',
      }),
    )

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '支払い方法「Cash」で受け取った支払いがあるので、削除できません。使うのをやめるときは、「この支払い方法を使う」の印を外して保存してください。',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await storedMethodsOf(TOKYO)).toEqual(before)
  })

  it('should say what is wrong before sending a new method, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedMethodsOf(TOKYO)
    await openAs(paymentMethodEntryHrefOf(await salonIdOf(TOKYO)), MANAGER)
    await openedForm('支払い方法を足す')
    await user.type(text('1 回の金額の下限（円）'), '2000')
    await user.type(text('1 回の金額の上限（円）'), '1000')
    await user.type(text('手数料率（%）'), '101')

    // Act
    await user.click(screen.getByRole('button', { name: '足す' }))

    // Assert
    expect(
      screen.getByRole('combobox', { name: /種類/ }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('種類を選んでください。'),
    )
    expect(text(/表示名/)).toHaveAccessibleDescription(
      expect.stringContaining('表示名を、100 文字以内で入力してください。'),
    )
    expect(text('1 回の金額の上限（円）')).toHaveAccessibleDescription(
      expect.stringContaining(
        '上限は、下限と同じか、下限より大きい金額にしてください。',
      ),
    )
    expect(text('手数料率（%）')).toHaveAccessibleDescription(
      expect.stringContaining('手数料率は、0 から 100 までの数'),
    )
    expect(await storedMethodsOf(TOKYO)).toEqual(before)
  })

  it('should ask the API for nothing when the form is sent as it was opened', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedMethodsOf(TOKYO)
    await openAs(
      paymentMethodChangeHrefOf(
        await salonIdOf(TOKYO),
        await methodIdOf(TOKYO, 'Cash'),
      ),
      OWNER,
    )
    await openedForm('支払い方法を直す')

    // Act
    await user.click(screen.getByRole('button', { name: '変更を保存する' }))

    // Assert
    expect(
      await screen.findByText('変更された項目はありません。'),
    ).toBeInTheDocument()
    await openedMethod()
    expect(await storedMethodsOf(TOKYO)).toEqual(before)
  })

  it.each<[string, (salonId: string) => string]>([
    ['the entry', paymentMethodEntryHrefOf],
    ['the change', (salonId) => paymentMethodChangeHrefOf(salonId, 'method')],
  ])('should refuse a stylist the form of %s', async (_case, hrefOf) => {
    // Act
    await openAs(hrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Assert
    expect(
      await screen.findByText(
        'このアカウントでは、支払い方法を変えられません。支払い方法を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('should tell the manager of another salon that its methods are not theirs to see', async () => {
    // Act
    await openAs(paymentMethodsHrefOf(await salonIdOf(OSAKA)), MANAGER)

    // Assert
    expect(
      await screen.findByText(
        'このサロンの支払い方法は、見られません。支払い方法を見られるのは、そのサロンのスタッフと、管理者です。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it.each<[string, string]>([
    ['an ID of no method', '0b0c4a39-5b5f-4f0e-8d5a-0c0a5e0d9999'],
    ['no ID at all', 'method'],
  ])(
    'should say that there is no method at an address with %s',
    async (_case, paymentMethodId) => {
      // Act
      await openAs(
        paymentMethodHrefOf(await salonIdOf(TOKYO), paymentMethodId),
        STYLIST,
      )

      // Assert
      expect(await heading('支払い方法が見つかりません')).toBeInTheDocument()
    },
  )

  it.each<
    [string, (salonId: string, methodId: string) => string, () => Promise<void>]
  >([
    ['the list', (salonId) => paymentMethodsHrefOf(salonId), openedList],
    ['a method', paymentMethodHrefOf, openedMethod],
    [
      'the entry',
      (salonId) => paymentMethodEntryHrefOf(salonId),
      () => openedForm('支払い方法を足す'),
    ],
    [
      'the change',
      paymentMethodChangeHrefOf,
      () => openedForm('支払い方法を直す'),
    ],
  ])(
    'should have no accessibility violations on %s',
    async (_case, hrefOf, opened) => {
      // Arrange
      const { container } = renderAt(
        hrefOf(await salonIdOf(TOKYO), await methodIdOf(TOKYO, 'Credit Card')),
      )
      await signInAs(OWNER)

      // Act
      await opened()

      // Assert
      expect(await findAccessibilityViolations(container)).toEqual([])
    },
  )
})

describe('the payment methods of a salon on a page in English', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should list the methods of the salon and show one, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(paymentMethodsHrefOf(await salonIdOf(TOKYO)), MANAGER, 'en')
    await heading('Payment methods')
    const table = await screen.findByRole('table', { name: 'Payment methods' })
    expect(rowsOf(table).slice(0, 2)).toEqual([
      ['Cash', 'Cash', 'No limits', 'No fee', 'In store', 'In use'],
      [
        'Credit Card',
        'Credit card',
        '¥1,000 or more',
        '3.6%',
        'In store, Online',
        'In use',
      ],
    ])
    expect(
      screen.getByText(
        'The means chosen when a payment is recorded on the sales screens. A payment method that is not in use cannot be chosen for new payments.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Add a payment method' }),
    ).toBeInTheDocument()

    // Act
    await user.click(within(table).getByRole('link', { name: 'Credit Card' }))

    // Assert
    await heading('Payment method details')
    await screen.findByRole('region', { name: 'Payment method' })
    expect(terms('Payment method')).toEqual([
      ['Display name', 'Credit Card'],
      ['Type', 'Credit card'],
      ['Description', 'Visa, MasterCard, JCB, AMEX accepted'],
      ['Amount at a time', '¥1,000 or more'],
      ['Fee rate', '3.6%'],
      ['Payment processor', 'Stripe'],
      ['Where used', 'In store, Online'],
      ['Status', 'In use'],
      ['Sort order', '2'],
    ])
    expect(
      screen.getByRole('link', { name: 'Edit the payment method' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to the payment methods' }),
    ).toBeInTheDocument()
  })

  it('should say what is wrong with a new method, then add it, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      paymentMethodEntryHrefOf(await salonIdOf(TOKYO)),
      MANAGER,
      'en',
    )
    await heading('Add a payment method')
    await screen.findByRole('textbox', { name: /Display name/ })
    await user.type(text('Smallest amount at a time (yen)'), '2000')
    await user.type(text('Largest amount at a time (yen)'), '1000')
    await user.type(text('Fee rate (%)'), '101')

    // Act
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Assert
    expect(
      screen.getByRole('combobox', { name: /Type/ }),
    ).toHaveAccessibleDescription(expect.stringContaining('Choose a type.'))
    expect(text(/Display name/)).toHaveAccessibleDescription(
      expect.stringContaining('Display name: enter 1 to 100 characters.'),
    )
    expect(text('Largest amount at a time (yen)')).toHaveAccessibleDescription(
      expect.stringContaining(
        'Make the largest amount the same as the smallest amount or larger.',
      ),
    )
    expect(text('Fee rate (%)')).toHaveAccessibleDescription(
      expect.stringContaining(
        'Enter the fee rate as a number from 0 to 100, with up to 2 decimal places.',
      ),
    )

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Type/ }),
      'QR code payment',
    )
    await user.type(text(/Display name/), 'PayPay')
    await user.clear(text('Smallest amount at a time (yen)'))
    await user.clear(text('Fee rate (%)'))
    await user.type(text('Fee rate (%)'), '1.98')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Assert
    expect(
      await screen.findByText('Added the payment method “PayPay”.'),
    ).toBeInTheDocument()
    await heading('Payment method details')
    expect(
      (await screen.findAllByRole('term')).map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['Type', 'QR code payment'],
        ['Amount at a time', 'Up to ¥1,000'],
        ['Fee rate', '1.98%'],
        ['Where used', 'In store'],
      ]),
    )
  })

  it('should keep a method a payment was received by meanwhile, and say to stop using it instead, in English', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      paymentMethodChangeHrefOf(
        await salonIdOf(TOKYO),
        await methodIdOf(TOKYO, 'Cash'),
      ),
      OWNER,
      'en',
    )
    await heading('Edit the payment method')
    await screen.findByRole('textbox', { name: /Display name/ })
    await paidMeanwhileBy(TOKYO, 'Cash')
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Remove the payment method “Cash”?',
    })

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Payments were received by the payment method “Cash”, so it cannot be removed. To stop using it, clear “Use this payment method” and save.',
    )
  })

  it('should tell the stylist that the methods are kept by others, in English', async () => {
    // Act
    await openAs(
      paymentMethodEntryHrefOf(await salonIdOf(TOKYO)),
      STYLIST,
      'en',
    )

    // Assert
    await heading('Add a payment method')
    expect(
      await screen.findByText(
        'This account cannot change the payment methods. Only the owners and managers of the salon, and administrators, can change payment methods.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to the payment methods' }),
    ).toBeInTheDocument()
  })
})
