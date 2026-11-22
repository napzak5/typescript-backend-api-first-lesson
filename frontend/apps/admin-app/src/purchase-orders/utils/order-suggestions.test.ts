import { describe, expect, it } from 'vitest'
import {
  colourLot,
  expiredColour,
  glovesRow,
  shampooRow,
} from '../../inventory/components/examples'
import { SUGGESTIONS_OF_THE_SALON } from '../components/examples'
import {
  suggestedNoteOf,
  suggestedQuantitiesOf,
  suggestionGroupsOf,
} from './order-suggestions'

describe('suggestionGroupsOf', () => {
  it('should group the suggestions by supplier, in the order of the names, and those of no supplier last', () => {
    expect(
      suggestionGroupsOf(SUGGESTIONS_OF_THE_SALON.toReversed()).map(
        ({ supplier, suggestions }) => [
          supplier,
          suggestions.map(({ productCode }) => productCode),
        ],
      ),
    ).toEqual([
      ['カラーテック・ジャパン', ['COLOR001']],
      ['東京ビューティーサプライ', ['SHMP001']],
      [null, ['SUP-GLOVE']],
    ])
  })

  it('should keep the products of a supplier in the order they came', () => {
    const others = SUGGESTIONS_OF_THE_SALON.map((suggestion) => ({
      ...suggestion,
      supplier: '東京ビューティーサプライ',
    }))

    expect(
      suggestionGroupsOf(others).map(({ suggestions }) =>
        suggestions.map(({ productCode }) => productCode),
      ),
    ).toEqual([['COLOR001', 'SHMP001', 'SUP-GLOVE']])
  })

  it('should give no groups for no suggestions', () => {
    expect(suggestionGroupsOf([])).toEqual([])
  })
})

describe('suggestedQuantitiesOf', () => {
  /** The rows of the salon of the stories, in the order of the form: the expired lot of the colour before the newer one */
  const ROWS = [expiredColour, colourLot, shampooRow, glovesRow]

  it('should put the quantity of each product of the supplier on its last row', () => {
    expect(
      suggestedQuantitiesOf(
        SUGGESTIONS_OF_THE_SALON,
        ROWS,
        'カラーテック・ジャパン',
      ),
    ).toEqual({ [colourLot.id]: '92' })
  })

  it('should take the products that name no supplier for the supplier nobody named', () => {
    expect(suggestedQuantitiesOf(SUGGESTIONS_OF_THE_SALON, ROWS, '')).toEqual({
      [glovesRow.id]: '1.5',
    })
  })

  it('should leave out a product whose rows were not read', () => {
    expect(
      suggestedQuantitiesOf(
        SUGGESTIONS_OF_THE_SALON,
        [expiredColour, colourLot],
        '東京ビューティーサプライ',
      ),
    ).toEqual({})
  })
})

describe('suggestedNoteOf', () => {
  it.each<[string, string, number, string]>([
    [
      'a supplier',
      '東京ビューティーサプライ',
      2,
      '東京ビューティーサプライ の発注の提案の数量を 2 行に入れました。数量と単価を確かめてください。',
    ],
    [
      'the products that name no supplier',
      '',
      1,
      '仕入先の決まっていない商品の、発注の提案の数量を 1 行に入れました。仕入先を入力し、数量と単価を確かめてください。',
    ],
    [
      'a supplier with nothing suggested now',
      '東京ビューティーサプライ',
      0,
      'この仕入先の発注の提案は、いまはありません。発注する行に、数量を入力してください。',
    ],
  ])(
    'should say what the form starts with for %s',
    (_case, supplier, filled, note) => {
      expect(suggestedNoteOf(supplier, filled)).toBe(note)
    },
  )
})
