import type {
  ModelsTreatmentMaterial,
  ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { aBooking, services, staff } from '../../bookings/components/examples'
import type { TreatmentWrite } from '../api/treatments-api'
import { aTreatment, products } from '../components/examples'
import {
  afterTreatmentWrite,
  materialControlOf,
  readTreatmentChange,
  readTreatmentEntry,
  type TreatmentContext,
  treatmentWrittenOf,
} from './treatment-form'

const booking = aBooking({ status: 'completed' })
const record = aTreatment()
const context: TreatmentContext = { products, bookingDay: booking.bookingDate }
const [misaki] = staff
const [cut, color] = services
const [colorAgent, oxidant] = products

const CUT = cut?.id ?? ''
const COLOR = color?.id ?? ''
const COLOR_AGENT = colorAgent?.id ?? ''
const OXIDANT = oxidant?.id ?? ''

/** A row of a material as a form holds it; without `lotNumber`, the row has no control for it. */
type FilledMaterial = Partial<Record<keyof ModelsTreatmentMaterial, string>>

/** A form as it is sent: what a list holds is sent under its name, once for each value. */
const formOf = (
  fields: Record<string, string | readonly string[]>,
  materials: readonly FilledMaterial[] = [],
): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    for (const each of typeof value === 'string' ? [value] : value) {
      values.append(name, each)
    }
  }
  materials.forEach((material, index) => {
    for (const [name, value] of Object.entries(material)) {
      values.set(`materials.${index}.${name}`, value)
    }
  })
  return values
}

/** The form a record is changed in, as it is opened. */
const formOfRecord = (
  shown: ModelsTreatmentRecordResponse,
  changes: Record<string, string | readonly string[]> = {},
  materials: readonly FilledMaterial[] = shown.materials.map(
    ({ productId, quantity, unit, lotNumber, notes }) => ({
      productId,
      quantity: String(quantity),
      unit,
      ...(lotNumber === null ? {} : { lotNumber }),
      notes: notes ?? '',
    }),
  ),
): FormData =>
  formOf(
    {
      services: shown.services,
      techniques: shown.techniques.join('、'),
      consultationNotes: shown.consultationNotes ?? '',
      scalpCondition: shown.scalpCondition ?? '',
      hairCondition: shown.hairCondition ?? '',
      colorFormula: shown.colorFormula ?? '',
      processingTime: String(shown.processingTime ?? ''),
      resultNotes: shown.resultNotes ?? '',
      nextRecommendedDate: shown.nextRecommendedDate ?? '',
      nextRecommendedServices: shown.nextRecommendedServices,
      homeCareSuggestions: shown.homeCareSuggestions ?? '',
      customerSatisfaction: String(shown.customerSatisfaction ?? ''),
      staffEvaluation: shown.staffEvaluation ?? '',
      ...changes,
    },
    materials,
  )

/** The least a record of a treatment is written with */
const LEAST = { staffId: misaki?.id ?? '', services: [CUT] }

describe('readTreatmentEntry', () => {
  it('should read the record of the booking, with its materials in the order of their rows', () => {
    // Arrange
    const values = formOfRecord(record, { staffId: misaki?.id ?? '' })

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    const {
      id: _id,
      photos: _photos,
      createdAt: _c,
      updatedAt: _u,
      ...written
    } = record
    expect(read).toEqual({
      type: 'valid',
      value: { ...written, bookingId: booking.id },
    })
  })

  it('should write what was left empty as nothing, and the lists as empty', () => {
    expect(readTreatmentEntry(formOf(LEAST), booking, context)).toEqual({
      type: 'valid',
      value: {
        bookingId: booking.id,
        customerId: booking.customerId,
        staffId: misaki?.id,
        services: [CUT],
        techniques: [],
        consultationNotes: null,
        scalpCondition: null,
        hairCondition: null,
        colorFormula: null,
        processingTime: null,
        resultNotes: null,
        nextRecommendedDate: null,
        nextRecommendedServices: [],
        homeCareSuggestions: null,
        customerSatisfaction: null,
        staffEvaluation: null,
        materials: [],
      },
    })
  })

  it('should read the texts without the spaces around them, and a text of spaces as nothing', () => {
    // Arrange
    const values = formOf({
      ...LEAST,
      scalpCondition: '  やや乾燥 \n',
      staffEvaluation: ' \n ',
    })

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: { scalpCondition: 'やや乾燥', staffEvaluation: null },
    })
  })

  it('should read the techniques as tags are read, and the minutes in digits of either width', () => {
    // Arrange
    const values = formOf({
      ...LEAST,
      techniques: 'ローライト、 レイヤーカット,ローライト，',
      processingTime: '７５',
    })

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: {
        techniques: ['ローライト', 'レイヤーカット'],
        processingTime: 75,
      },
    })
  })

  it('should send each service once', () => {
    // Arrange
    const values = formOf({ ...LEAST, services: [CUT, COLOR, CUT] })

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: { services: [CUT, COLOR] },
    })
  })

  it('should recommend the day of the booking itself for the next visit', () => {
    // Arrange
    const values = formOf({
      ...LEAST,
      nextRecommendedDate: booking.bookingDate,
    })

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: { nextRecommendedDate: booking.bookingDate },
    })
  })

  it('should say what is wrong with each control, and send nothing', () => {
    // Arrange
    const values = formOf({
      staffId: '',
      techniques: 'あ'.repeat(101),
      processingTime: '1441',
      nextRecommendedDate: '2026-11-19',
      customerSatisfaction: '6',
    })

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        staffId: {
          en: 'Choose the staff member.',
          ja: '担当を選んでください。',
        },
        services: {
          en: 'Choose the services provided.',
          ja: '提供したサービスを選んでください。',
        },
        techniques: {
          en: 'Name of a technique: enter up to 100 characters for each entry.',
          ja: '技法の名前は、1 つ 100 文字以内で入力してください。',
        },
        processingTime: {
          en: 'Enter the treatment time as a whole number of minutes from 0 to 1,440.',
          ja: '施術時間は、0 から 1,440 までの分の整数で入力してください。',
        },
        nextRecommendedDate: {
          en: 'Make the next recommended date the day of the booking (Fri, November 20, 2026) or a later one.',
          ja: '次に勧める日は、予約の日（2026年11月20日（金））から後の日にしてください。',
        },
        customerSatisfaction: {
          en: 'Choose the satisfaction again.',
          ja: '満足度を選び直してください。',
        },
      },
    })
  })

  it('should say that the staff member is missing when nothing else is wrong', () => {
    // Arrange
    const values = formOf({ ...LEAST, staffId: '' })

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        staffId: {
          en: 'Choose the staff member.',
          ja: '担当を選んでください。',
        },
      },
    })
  })

  it.each<
    [string, Record<string, string | string[]>, Record<string, LocalizedText>]
  >([
    [
      'more than twenty techniques',
      {
        techniques: Array.from(
          { length: 21 },
          (_, index) => `技法${index}`,
        ).join('、'),
      },
      {
        techniques: {
          en: 'Enter up to 20 techniques.',
          ja: '技法は、20 件までで入力してください。',
        },
      },
    ],
    [
      'more than twenty services',
      {
        services: Array.from(
          { length: 21 },
          (_, index) => `${CUT.slice(0, -2)}${String(index).padStart(2, '0')}`,
        ),
      },
      {
        services: {
          en: 'Choose up to 20 services provided.',
          ja: '提供したサービスは、20 件までにしてください。',
        },
      },
    ],
    [
      'more than twenty services to recommend',
      {
        nextRecommendedServices: Array.from(
          { length: 21 },
          (_, index) => `${CUT.slice(0, -2)}${String(index).padStart(2, '0')}`,
        ),
      },
      {
        nextRecommendedServices: {
          en: 'Choose up to 20 next recommended services.',
          ja: '次に勧めるサービスは、20 件までにしてください。',
        },
      },
    ],
    [
      'minutes that are not whole',
      { processingTime: '7.5' },
      {
        processingTime: {
          en: 'Enter the treatment time as a whole number of minutes from 0 to 1,440.',
          ja: '施術時間は、0 から 1,440 までの分の整数で入力してください。',
        },
      },
    ],
    [
      'a day that is none',
      { nextRecommendedDate: '2026-12-32' },
      {
        nextRecommendedDate: {
          en: 'Enter the next recommended date as a date.',
          ja: '次に勧める日を、日付で入力してください。',
        },
      },
    ],
  ])('should refuse %s', (_case, fields, errors) => {
    expect(
      readTreatmentEntry(formOf({ ...LEAST, ...fields }), booking, context),
    ).toEqual({ type: 'invalid', errors })
  })
})

describe('the materials of the form', () => {
  it('should read a lot number for a product kept by lots, and none for another', () => {
    // Arrange
    const values = formOf(LEAST, [
      {
        productId: COLOR_AGENT,
        quantity: '0.５',
        unit: ' 本 ',
        lotNumber: ' LOT-1 ',
        notes: '',
      },
      { productId: OXIDANT, quantity: '80.25', unit: 'ml', notes: '多めに' },
    ])

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: {
        materials: [
          {
            productId: COLOR_AGENT,
            quantity: 0.5,
            unit: '本',
            lotNumber: 'LOT-1',
            notes: null,
          },
          {
            productId: OXIDANT,
            quantity: 80.25,
            unit: 'ml',
            lotNumber: null,
            notes: '多めに',
          },
        ],
      },
    })
  })

  it('should say what is wrong with each control of a row, under the name of the row', () => {
    // Arrange
    const values = formOf(LEAST, [
      { productId: OXIDANT, quantity: '1', unit: 'ml', notes: '' },
      {
        productId: COLOR_AGENT,
        quantity: '0',
        unit: '',
        lotNumber: ' ',
        notes: '',
      },
      {
        productId: '',
        quantity: '1.005',
        unit: 'あ'.repeat(21),
        notes: '',
      },
      {
        productId: OXIDANT,
        quantity: '1',
        unit: 'ml',
        lotNumber: 'LOT-1',
        notes: '',
      },
    ])

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        [materialControlOf(1, 'quantity')]: {
          en: 'Enter a quantity greater than 0, with up to two decimal places.',
          ja: '量は、0 より大きい数で、小数第 2 位まで入力してください。',
        },
        [materialControlOf(1, 'unit')]: {
          en: 'Enter the unit.',
          ja: '単位を入力してください。',
        },
        [materialControlOf(1, 'lotNumber')]: {
          en: 'This product is kept by lots. Enter the lot number.',
          ja: 'この商品は、ロットで管理しています。ロット番号を入力してください。',
        },
        [materialControlOf(2, 'productId')]: {
          en: 'Choose a product.',
          ja: '商品を選んでください。',
        },
        [materialControlOf(2, 'quantity')]: {
          en: 'Enter a quantity greater than 0, with up to two decimal places.',
          ja: '量は、0 より大きい数で、小数第 2 位まで入力してください。',
        },
        [materialControlOf(2, 'unit')]: {
          en: 'Unit: enter up to 20 characters.',
          ja: '単位は、20 文字以内で入力してください。',
        },
        [materialControlOf(3, 'lotNumber')]: {
          en: 'This product is not kept by lots. Clear the lot number.',
          ja: 'この商品は、ロットで管理していません。ロット番号を消してください。',
        },
      },
    })
  })

  it('should take a technique, a unit and a lot number as long as the API takes them, counted as it counts them', () => {
    // Arrange
    const values = formOf({ ...LEAST, techniques: '𠮷'.repeat(100) }, [
      {
        productId: COLOR_AGENT,
        quantity: '1',
        unit: '𠮷'.repeat(20),
        lotNumber: '𠮷'.repeat(100),
        notes: '',
      },
    ])

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read.type).toBe('valid')
  })

  it('should say that a lot number of 101 characters is too long', () => {
    // Arrange
    const values = formOf(LEAST, [
      {
        productId: COLOR_AGENT,
        quantity: '1',
        unit: '本',
        lotNumber: 'L'.repeat(101),
        notes: '',
      },
    ])

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        [materialControlOf(0, 'lotNumber')]: {
          en: 'Lot number: enter up to 100 characters.',
          ja: 'ロット番号は、100 文字以内で入力してください。',
        },
      },
    })
  })

  it('should keep the lot number of a product the salon no longer has as it was written', () => {
    // Arrange
    const gone = '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e'
    const values = formOf(LEAST, [
      { productId: gone, quantity: '1', unit: '本', lotNumber: 'L-9' },
      { productId: gone, quantity: '1', unit: '本' },
    ])

    // Act
    const read = readTreatmentEntry(values, booking, context)

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: {
        materials: [{ lotNumber: 'L-9' }, { lotNumber: null }],
      },
    })
  })
})

describe('readTreatmentChange', () => {
  it('should ask for nothing when nothing was changed', () => {
    expect(readTreatmentChange(formOfRecord(record), record, context)).toEqual({
      type: 'unchanged',
    })
  })

  it('should take a text of the record with spaces around it as the text the form shows', () => {
    // Arrange
    const shown = aTreatment({ scalpCondition: ' やや乾燥 ' })

    // Act
    const change = readTreatmentChange(
      formOfRecord(shown, { scalpCondition: 'やや乾燥' }),
      shown,
      context,
    )

    // Assert
    expect(change).toEqual({ type: 'unchanged' })
  })

  it('should take the services listed in the order of the menu as those of the record', () => {
    // Arrange
    const shown = aTreatment({
      services: [COLOR, CUT],
      nextRecommendedServices: [COLOR, CUT],
    })

    // Act
    const change = readTreatmentChange(
      formOfRecord(shown, {
        services: [CUT, COLOR],
        nextRecommendedServices: [CUT, COLOR],
      }),
      shown,
      context,
    )

    // Assert
    expect(change).toEqual({ type: 'unchanged' })
  })

  it('should send what was changed, a text that was emptied as nothing, and nothing else', () => {
    // Arrange
    const values = formOfRecord(record, {
      processingTime: '90',
      staffEvaluation: '',
      customerSatisfaction: '',
      nextRecommendedDate: '2027-01-15',
    })

    // Act
    const change = readTreatmentChange(values, record, context)

    // Assert
    expect(change).toEqual({
      type: 'valid',
      value: {
        processingTime: 90,
        nextRecommendedDate: '2027-01-15',
        customerSatisfaction: null,
        staffEvaluation: null,
      },
    })
  })

  it('should send each text of the consultation, the result and the home care that was changed', () => {
    // Arrange
    const values = formOfRecord(record, {
      consultationNotes: '前回より短めを希望。',
      scalpCondition: '健康',
      hairCondition: 'ダメージ少なめ',
      colorFormula: '7N:OX6%=1:1',
      resultNotes: '自然な仕上がり。',
      homeCareSuggestions: '週に 1 回のトリートメント。',
    })

    // Act
    const change = readTreatmentChange(values, record, context)

    // Assert
    expect(change).toEqual({
      type: 'valid',
      value: {
        consultationNotes: '前回より短めを希望。',
        scalpCondition: '健康',
        hairCondition: 'ダメージ少なめ',
        colorFormula: '7N:OX6%=1:1',
        resultNotes: '自然な仕上がり。',
        homeCareSuggestions: '週に 1 回のトリートメント。',
      },
    })
  })

  it('should send a list that was changed whole', () => {
    // Arrange
    const values = formOfRecord(record, {
      services: [CUT],
      techniques: 'ローライト、レイヤーカット、ブロー',
      nextRecommendedServices: [],
    })

    // Act
    const change = readTreatmentChange(values, record, context)

    // Assert
    expect(change).toEqual({
      type: 'valid',
      value: {
        services: [CUT],
        techniques: ['ローライト', 'レイヤーカット', 'ブロー'],
        nextRecommendedServices: [],
      },
    })
  })

  it('should send every material when one of them was changed', () => {
    // Arrange
    const [first] = record.materials
    const values = formOfRecord(record, {}, [
      {
        productId: first?.productId ?? '',
        quantity: '1.5',
        unit: first?.unit ?? '',
        lotNumber: first?.lotNumber ?? '',
        notes: '',
      },
    ])

    // Act
    const change = readTreatmentChange(values, record, context)

    // Assert
    expect(change).toEqual({
      type: 'valid',
      value: {
        materials: [
          {
            productId: COLOR_AGENT,
            quantity: 1.5,
            unit: '本',
            lotNumber: 'LOT-2026-031',
            notes: null,
          },
        ],
      },
    })
  })

  it('should send nothing while something is wrong', () => {
    expect(
      readTreatmentChange(
        formOfRecord(record, { services: [] }),
        record,
        context,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        services: {
          en: 'Choose the services provided.',
          ja: '提供したサービスを選んでください。',
        },
      },
    })
  })
})

describe('afterTreatmentWrite', () => {
  it('should say what the API refused beside the controls, in the words of the form', () => {
    // Arrange
    const refused = (field: string, rule: string) => ({ field, rule })

    // Act
    const says = afterTreatmentWrite(
      {
        type: 'invalid',
        values: [
          refused('staffId', 'not_found'),
          refused('services.1', 'not_found'),
          refused('nextRecommendedDate', 'too_small'),
          refused('nextRecommendedServices.0', 'not_found'),
          refused('materials.0.productId', 'not_found'),
          refused('materials.1.lotNumber', 'custom'),
        ],
      },
      'entry',
      booking.bookingDate,
    )

    // Assert
    expect(says).toEqual({
      message: undefined,
      errors: {
        staffId: {
          en: 'This staff member was removed or moved to another salon meanwhile. Choose another staff member.',
          ja: 'このスタッフは、その間に削除されたか、ほかのサロンに移りました。ほかのスタッフを選んでください。',
        },
        services: {
          en: 'A service was removed meanwhile. Choose again.',
          ja: 'その間に削除されたサービスがあります。選び直してください。',
        },
        nextRecommendedDate: {
          en: 'Make the next recommended date the day of the booking (Fri, November 20, 2026) or a later one.',
          ja: '次に勧める日は、予約の日（2026年11月20日（金））から後の日にしてください。',
        },
        nextRecommendedServices: {
          en: 'A service was removed meanwhile. Choose again.',
          ja: 'その間に削除されたサービスがあります。選び直してください。',
        },
        'materials.0.productId': {
          en: 'This product was removed meanwhile. Choose another product, or remove this material.',
          ja: 'この商品は、その間に削除されました。ほかの商品を選ぶか、この商材を外してください。',
        },
        'materials.1.lotNumber': {
          en: 'Meanwhile the salon changed whether this product is kept by lots. Open the screen again and write the material again.',
          ja: 'その間に、この商品のロットの管理が変わりました。画面を開き直して、書き直してください。',
        },
      },
    })
  })

  it.each<[string, string, LocalizedText]>([
    [
      'materials.0.productId',
      'too_small',
      { en: 'Choose a product.', ja: '商品を選んでください。' },
    ],
    [
      'materials.0.quantity',
      'too_small',
      {
        en: 'Enter a quantity greater than 0, with up to two decimal places.',
        ja: '量は、0 より大きい数で、小数第 2 位まで入力してください。',
      },
    ],
    [
      'materials.0.unit',
      'too_big',
      {
        en: 'Unit: enter up to 20 characters.',
        ja: '単位は、20 文字以内で入力してください。',
      },
    ],
    [
      'materials.0.unit',
      'too_small',
      { en: 'Enter the unit.', ja: '単位を入力してください。' },
    ],
    [
      'materials.0.lotNumber',
      'too_big',
      {
        en: 'Lot number: enter up to 100 characters.',
        ja: 'ロット番号は、100 文字以内で入力してください。',
      },
    ],
  ])(
    'should say beside the control of a material what the API refused of it: %s, %s',
    (field, rule, said) => {
      // Act
      const says = afterTreatmentWrite(
        { type: 'invalid', values: [{ field, rule }] },
        'entry',
        booking.bookingDate,
      )

      // Assert
      expect(says).toEqual({ message: undefined, errors: { [field]: said } })
    },
  )

  it.each<[string, string, string, LocalizedText]>([
    [
      'techniques',
      'too_big',
      'techniques',
      {
        en: 'Enter up to 20 techniques.',
        ja: '技法は、20 件までで入力してください。',
      },
    ],
    [
      'techniques.2',
      'too_big',
      'techniques',
      {
        en: 'Name of a technique: enter up to 100 characters for each entry.',
        ja: '技法の名前は、1 つ 100 文字以内で入力してください。',
      },
    ],
    [
      'nextRecommendedServices',
      'too_big',
      'nextRecommendedServices',
      {
        en: 'Choose up to 20 next recommended services.',
        ja: '次に勧めるサービスは、20 件までにしてください。',
      },
    ],
    [
      'services',
      'too_small',
      'services',
      {
        en: 'Choose the services provided.',
        ja: '提供したサービスを選んでください。',
      },
    ],
    [
      'nextRecommendedDate',
      'invalid_format',
      'nextRecommendedDate',
      {
        en: 'Enter the next recommended date as a date.',
        ja: '次に勧める日を、日付で入力してください。',
      },
    ],
    [
      'customerSatisfaction',
      'too_big',
      'customerSatisfaction',
      {
        en: 'Choose the satisfaction again.',
        ja: '満足度を選び直してください。',
      },
    ],
  ])(
    'should say beside the control what the API refused of the record: %s, %s',
    (field, rule, control, said) => {
      // Act
      const says = afterTreatmentWrite(
        { type: 'invalid', values: [{ field, rule }] },
        'change',
        booking.bookingDate,
      )

      // Assert
      expect(says).toEqual({ message: undefined, errors: { [control]: said } })
    },
  )

  it('should say the first thing the API says of a control, and ask to check the values it has no control of', () => {
    // Arrange
    const outcome: Extract<TreatmentWrite, { type: 'invalid' }> = {
      type: 'invalid',
      values: [
        { field: 'services.3', rule: 'not_found' },
        { field: 'services', rule: 'too_big' },
        { field: 'processingTime', rule: 'custom' },
        { field: 'consultationNotes', rule: 'too_small' },
      ],
    }

    // Act
    const says = afterTreatmentWrite(outcome, 'change', booking.bookingDate)

    // Assert
    expect(says).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {
        services: {
          en: 'A service was removed meanwhile. Choose again.',
          ja: 'その間に削除されたサービスがあります。選び直してください。',
        },
        processingTime: {
          en: 'Enter the treatment time as a whole number of minutes from 0 to 1,440.',
          ja: '施術時間は、0 から 1,440 までの分の整数で入力してください。',
        },
      },
    })
  })

  it('should say that the customer left the ledger meanwhile', () => {
    // Arrange
    const outcome: Extract<TreatmentWrite, { type: 'invalid' }> = {
      type: 'invalid',
      values: [{ field: 'customerId', rule: 'not_found' }],
    }

    // Act
    const says = afterTreatmentWrite(outcome, 'entry', booking.bookingDate)

    // Assert
    expect(says).toEqual({
      message: {
        en: 'This customer was removed from the ledger meanwhile. No treatment record can be written.',
        ja: 'このお客様は、その間に台帳から削除されました。施術記録は書けません。',
      },
      errors: {},
    })
  })

  it.each<
    [
      'forbidden' | 'tooManyRequests' | 'failed',
      'entry' | 'change',
      LocalizedText,
    ]
  >([
    [
      'forbidden',
      'entry',
      {
        en: 'This account cannot write treatment records.',
        ja: 'このアカウントでは、施術記録を書けません。',
      },
    ],
    [
      'tooManyRequests',
      'change',
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'failed',
      'entry',
      {
        en: 'The treatment record could not be written. Check your connection and try again.',
        ja: '施術記録を書けませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
    [
      'failed',
      'change',
      {
        en: 'The treatment record could not be changed. Check your connection and try again.',
        ja: '施術記録を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what came of %s in the %s', (type, write, message) => {
    // Act
    const says = afterTreatmentWrite({ type }, write, booking.bookingDate)

    // Assert
    expect(says).toEqual({ message, errors: {} })
  })
})

describe('treatmentWrittenOf', () => {
  it.each<['entry' | 'change', LocalizedText]>([
    [
      'entry',
      {
        en: 'Wrote the treatment record of 山田 花子.',
        ja: '山田 花子 様の施術記録を書きました。',
      },
    ],
    [
      'change',
      {
        en: 'Saved the treatment record of 山田 花子.',
        ja: '山田 花子 様の施術記録を直しました。',
      },
    ],
  ])('should say what the %s did', (write, said) => {
    // Act
    const written = treatmentWrittenOf(
      { en: '山田 花子', ja: '山田 花子 様' },
      write,
    )

    // Assert
    expect(written).toEqual(said)
  })
})
