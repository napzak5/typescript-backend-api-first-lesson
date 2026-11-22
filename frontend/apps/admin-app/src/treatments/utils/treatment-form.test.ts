import type {
  ModelsTreatmentMaterial,
  ModelsTreatmentRecordResponse,
} from '@beauty-salon-frontend/api-client'
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
        staffId: '担当を選んでください。',
        services: '提供したサービスを選んでください。',
        techniques: '技法の名前は、1 つ 100 文字以内で入力してください。',
        processingTime:
          '施術時間は、0 から 1440 までの分の整数で入力してください。',
        nextRecommendedDate:
          '次に勧める日は、予約の日（2026-11-20）から後の日にしてください。',
        customerSatisfaction: '満足度を選び直してください。',
      },
    })
  })

  it.each<[string, Record<string, string | string[]>, Record<string, string>]>([
    [
      'more than twenty techniques',
      {
        techniques: Array.from(
          { length: 21 },
          (_, index) => `技法${index}`,
        ).join('、'),
      },
      { techniques: '技法は、20 件までで入力してください。' },
    ],
    [
      'more than twenty services',
      {
        services: Array.from(
          { length: 21 },
          (_, index) => `${CUT.slice(0, -2)}${String(index).padStart(2, '0')}`,
        ),
      },
      { services: '提供したサービスは、20 件までにしてください。' },
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
        nextRecommendedServices:
          '次に勧めるサービスは、20 件までにしてください。',
      },
    ],
    [
      'minutes that are not whole',
      { processingTime: '7.5' },
      {
        processingTime:
          '施術時間は、0 から 1440 までの分の整数で入力してください。',
      },
    ],
    [
      'a day that is none',
      { nextRecommendedDate: '2026-12-32' },
      { nextRecommendedDate: '次に勧める日を、日付で入力してください。' },
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
        [materialControlOf(1, 'quantity')]:
          '量は、0 より大きい数で、小数第 2 位まで入力してください。',
        [materialControlOf(1, 'unit')]: '単位を入力してください。',
        [materialControlOf(1, 'lotNumber')]:
          'この商品は、ロットで管理しています。ロット番号を入力してください。',
        [materialControlOf(2, 'productId')]: '商品を選んでください。',
        [materialControlOf(2, 'quantity')]:
          '量は、0 より大きい数で、小数第 2 位まで入力してください。',
        [materialControlOf(2, 'unit')]:
          '単位は、20 文字以内で入力してください。',
        [materialControlOf(3, 'lotNumber')]:
          'この商品は、ロットで管理していません。ロット番号を消してください。',
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
        [materialControlOf(0, 'lotNumber')]:
          'ロット番号は、100 文字以内で入力してください。',
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
      errors: { services: '提供したサービスを選んでください。' },
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
        staffId:
          'このスタッフは、その間に削除されたか、ほかのサロンに移りました。ほかのスタッフを選んでください。',
        services: 'その間に削除されたサービスがあります。選び直してください。',
        nextRecommendedDate:
          '次に勧める日は、予約の日（2026-11-20）から後の日にしてください。',
        nextRecommendedServices:
          'その間に削除されたサービスがあります。選び直してください。',
        'materials.0.productId':
          'この商品は、その間に削除されました。ほかの商品を選ぶか、この商材を外してください。',
        'materials.1.lotNumber':
          'その間に、この商品のロットの管理が変わりました。画面を開き直して、書き直してください。',
      },
    })
  })

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
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {
        services: 'その間に削除されたサービスがあります。選び直してください。',
        processingTime:
          '施術時間は、0 から 1440 までの分の整数で入力してください。',
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
      message:
        'このお客様は、その間に台帳から削除されました。施術記録は書けません。',
      errors: {},
    })
  })

  it.each<
    ['forbidden' | 'tooManyRequests' | 'failed', 'entry' | 'change', string]
  >([
    ['forbidden', 'entry', 'このアカウントでは、施術記録を書けません。'],
    [
      'tooManyRequests',
      'change',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'failed',
      'entry',
      '施術記録を書けませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
    [
      'failed',
      'change',
      '施術記録を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say what came of %s in the %s', (type, write, message) => {
    expect(afterTreatmentWrite({ type }, write, booking.bookingDate)).toEqual({
      message,
      errors: {},
    })
  })
})

describe('treatmentWrittenOf', () => {
  it.each<['entry' | 'change', string]>([
    ['entry', '山田 花子 様の施術記録を書きました。'],
    ['change', '山田 花子 様の施術記録を直しました。'],
  ])('should say what the %s did', (write, said) => {
    expect(treatmentWrittenOf('山田 花子 様', write)).toBe(said)
  })
})
