import { describe, expect, it } from 'vitest'
import {
  afterChartWrite,
  chartWrittenOf,
  readChartChange,
  readChartEntry,
  rowControlOf,
  treatmentNameOf,
} from './chart-form'
import { aChart } from './components/examples'

const TODAY = '2026-11-20'

const CUSTOMER = 'b08e3c6f-5d7b-4fce-9cad-9b6d2e5f7ab4'

type Filled = {
  rows?: {
    treatment: string
    date: string
    salonName?: string
    notes?: string
  }[]
  medicalConditions?: string
  preferredProducts?: string
  avoidProducts?: string
  notes?: string
}

/** The values of the form, the rows in the order they are shown */
const valuesOf = ({
  rows = [],
  medicalConditions = '',
  preferredProducts = '',
  avoidProducts = '',
  notes = '',
}: Filled): FormData => {
  const values = new FormData()
  values.set('medicalConditions', medicalConditions)
  values.set('preferredProducts', preferredProducts)
  values.set('avoidProducts', avoidProducts)
  rows.forEach((row, index) => {
    values.set(rowControlOf(index, 'treatment'), row.treatment)
    values.set(rowControlOf(index, 'date'), row.date)
    values.set(rowControlOf(index, 'salonName'), row.salonName ?? '')
    values.set(rowControlOf(index, 'notes'), row.notes ?? '')
  })
  values.set('notes', notes)

  return values
}

/** The values of the form as it opens with the chart of the examples */
const shownValues = (changes: Filled = {}): FormData =>
  valuesOf({
    rows: [
      {
        treatment: 'color',
        date: '2026-03-14',
        salonName: 'ヘアサロン 青山',
        notes: '根元から明るめのブラウン。',
      },
      { treatment: 'perm', date: '2025-11-02' },
    ],
    medicalConditions: '頭皮が乾燥しやすく、かゆみが出ることがあります。',
    preferredProducts: 'オーガニックシャンプー、無香料のオイル',
    avoidProducts: '香りの強い整髪料',
    notes: 'シャンプーはぬるめのお湯で。\n施術中の会話は控えめを希望。',
    ...changes,
  })

describe('treatmentNameOf', () => {
  it.each<[Parameters<typeof treatmentNameOf>[0], string]>([
    ['head_spa', 'ヘッドスパ'],
    ['eyelash', 'まつげ'],
    ['other', 'その他'],
  ])('should call %s %s', (treatment, name) => {
    // Act
    const called = treatmentNameOf(treatment)

    // Assert
    expect(called).toBe(name)
  })
})

describe('readChartEntry', () => {
  it('should read the rows in the order they are shown, and nothing as null', () => {
    // Arrange
    const values = valuesOf({
      rows: [
        { treatment: 'cut', date: '2026-11-20', salonName: '  ', notes: '' },
        { treatment: 'nail', date: '1900-01-01', salonName: ' 駅前ネイル ' },
      ],
      medicalConditions: '  ',
      preferredProducts: 'A、 B ,A,,',
      notes: ' 指名なし ',
    })

    // Act
    const read = readChartEntry(values, CUSTOMER, TODAY)

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        customerId: CUSTOMER,
        previousTreatments: [
          {
            treatment: 'cut',
            date: '2026-11-20',
            salonName: null,
            notes: null,
          },
          {
            treatment: 'nail',
            date: '1900-01-01',
            salonName: '駅前ネイル',
            notes: null,
          },
        ],
        medicalConditions: null,
        preferredProducts: ['A', 'B'],
        avoidProducts: [],
        notes: '指名なし',
      },
    })
  })

  it('should say what is wrong with each row, under its place', () => {
    // Arrange
    const values = valuesOf({
      rows: [
        { treatment: 'color', date: '2026-11-20' },
        { treatment: '', date: '' },
        { treatment: 'cut', date: '1899-12-31', salonName: 'あ'.repeat(256) },
        { treatment: 'perm', date: '2026-11-21' },
      ],
    })

    // Act
    const read = readChartEntry(values, CUSTOMER, TODAY)

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        'previousTreatments.1.treatment': '施術を選んでください。',
        'previousTreatments.1.date': '施術日を入力してください。',
        'previousTreatments.2.date':
          '施術日は、1900年1月1日以降にしてください。',
        'previousTreatments.2.salonName':
          'サロンの名前は、255 文字以内で入力してください。',
        'previousTreatments.3.date': '施術日は、今日までにしてください。',
      },
    })
  })

  it('should take a name of a salon of 255 characters, counted as the API counts them', () => {
    // Arrange
    const values = valuesOf({
      rows: [{ treatment: 'cut', date: TODAY, salonName: '𠮷'.repeat(255) }],
    })

    // Act
    const read = readChartEntry(values, CUSTOMER, TODAY)

    // Assert
    expect(read.type).toBe('valid')
  })

  it.each<[string, string, string]>([
    [
      'a name of more than 100 characters',
      'あ'.repeat(101),
      '商材の名前は、1 つ 100 文字以内で入力してください。',
    ],
    [
      'more than 50 names',
      Array.from({ length: 51 }, (_, index) => `商材${index}`).join('、'),
      '商材は、50 件までで入力してください。',
    ],
  ])('should refuse %s of products', (_, products, message) => {
    // Arrange
    const values = valuesOf({
      preferredProducts: products,
      avoidProducts: products,
    })

    // Act
    const read = readChartEntry(values, CUSTOMER, TODAY)

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: { preferredProducts: message, avoidProducts: message },
    })
  })

  it('should take 50 names of 100 characters, counted as the API counts them', () => {
    // Arrange
    const values = valuesOf({
      avoidProducts: Array.from(
        { length: 50 },
        (_, index) => `${index}${'𠮷'.repeat(100 - `${index}`.length)}`,
      ).join('、'),
    })

    // Act
    const read = readChartEntry(values, CUSTOMER, TODAY)

    // Assert
    expect(read.type).toBe('valid')
  })
})

describe('readChartChange', () => {
  it('should ask for nothing when the form is sent as it was opened', () => {
    // Act
    const change = readChartChange(shownValues(), aChart(), TODAY)

    // Assert
    expect(change).toEqual({ type: 'unchanged' })
  })

  it('should compare the texts without the spaces around them', () => {
    // Arrange
    const chart = aChart({ medicalConditions: ' 腰痛 ' })

    // Act
    const change = readChartChange(
      shownValues({ medicalConditions: '腰痛' }),
      chart,
      TODAY,
    )

    // Assert
    expect(change).toEqual({ type: 'unchanged' })
  })

  it('should send what was changed, a list whole', () => {
    // Arrange
    const values = shownValues({
      rows: [{ treatment: 'perm', date: '2025-11-02' }],
      avoidProducts: '香りの強い整髪料、シリコン',
      notes: '',
    })

    // Act
    const change = readChartChange(values, aChart(), TODAY)

    // Assert
    expect(change).toEqual({
      type: 'valid',
      value: {
        previousTreatments: [
          {
            treatment: 'perm',
            date: '2025-11-02',
            salonName: null,
            notes: null,
          },
        ],
        avoidProducts: ['香りの強い整髪料', 'シリコン'],
        notes: null,
      },
    })
  })

  it('should send the treatments in their new order', () => {
    // Arrange
    const values = shownValues({
      rows: [
        { treatment: 'perm', date: '2025-11-02' },
        {
          treatment: 'color',
          date: '2026-03-14',
          salonName: 'ヘアサロン 青山',
          notes: '根元から明るめのブラウン。',
        },
      ],
    })

    // Act
    const change = readChartChange(values, aChart(), TODAY)

    // Assert
    expect(change).toEqual({
      type: 'valid',
      value: {
        previousTreatments: [
          {
            treatment: 'perm',
            date: '2025-11-02',
            salonName: null,
            notes: null,
          },
          {
            treatment: 'color',
            date: '2026-03-14',
            salonName: 'ヘアサロン 青山',
            notes: '根元から明るめのブラウン。',
          },
        ],
      },
    })
  })

  it('should say what is wrong, and ask for nothing', () => {
    // Arrange
    const values = shownValues({ rows: [{ treatment: 'cut', date: '' }] })

    // Act
    const change = readChartChange(values, aChart(), TODAY)

    // Assert
    expect(change).toEqual({
      type: 'invalid',
      errors: { 'previousTreatments.0.date': '施術日を入力してください。' },
    })
  })
})

describe('afterChartWrite', () => {
  it('should say what the API refused under the controls, the first word on each', () => {
    // Arrange
    const values = [
      { field: 'previousTreatments.2.date', rule: 'too_big' },
      { field: 'previousTreatments.2.date', rule: 'invalid_format' },
      { field: 'previousTreatments.0.date', rule: 'too_small' },
      { field: 'previousTreatments.1.salonName', rule: 'too_big' },
      { field: 'previousTreatments.1.treatment', rule: 'invalid_value' },
      { field: 'preferredProducts.3', rule: 'too_big' },
      { field: 'avoidProducts', rule: 'too_big' },
    ]

    // Act
    const said = afterChartWrite({ type: 'invalid', values }, 'entry')

    // Assert
    expect(said).toEqual({
      message: undefined,
      errors: {
        'previousTreatments.2.date': '施術日は、今日までにしてください。',
        'previousTreatments.0.date':
          '施術日は、1900年1月1日以降にしてください。',
        'previousTreatments.1.salonName':
          'サロンの名前は、255 文字以内で入力してください。',
        'previousTreatments.1.treatment': '施術を選んでください。',
        preferredProducts:
          '商材の名前は、1 つ 100 文字以内で入力してください。',
        avoidProducts: '商材は、50 件までで入力してください。',
      },
    })
  })

  it('should ask to check the form for what it has no control of', () => {
    // Act
    const said = afterChartWrite(
      {
        type: 'invalid',
        values: [{ field: 'previousTreatments', rule: 'too_big' }],
      },
      'change',
    )

    // Assert
    expect(said).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<
    [
      Parameters<typeof afterChartWrite>[0],
      Parameters<typeof afterChartWrite>[1],
      string,
    ]
  >([
    [
      { type: 'forbidden' },
      'entry',
      'このアカウントでは、カルテを書けません。',
    ],
    [
      { type: 'tooManyRequests' },
      'change',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      'entry',
      'カルテを作れませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
    [
      { type: 'failed' },
      'change',
      'カルテを直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say after %o of the %s', (outcome, write, message) => {
    // Act
    const said = afterChartWrite(outcome, write)

    // Assert
    expect(said).toEqual({ message, errors: {} })
  })
})

describe('chartWrittenOf', () => {
  it.each<[Parameters<typeof chartWrittenOf>[1], string]>([
    ['entry', '山田 花子 様のカルテを作りました。'],
    ['change', '山田 花子 様のカルテを直しました。'],
  ])('should say what was done after the %s', (write, message) => {
    // Act
    const said = chartWrittenOf('山田 花子', write)

    // Assert
    expect(said).toBe(message)
  })
})
