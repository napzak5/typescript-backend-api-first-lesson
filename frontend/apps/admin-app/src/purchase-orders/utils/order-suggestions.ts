import type {
  ModelsInventoryResponse,
  ModelsReorderSuggestionResponse,
} from '@beauty-salon-frontend/api-client'

/*
 * The reorder suggestions of a salon: which products to order, how many,
 * and from whom. A suggestion names a product; an order names stock rows,
 * so a new order puts the quantity of a product on one of its rows.
 */

/** The suggestions of one supplier, or of the products that name none */
export type SuggestionGroup = {
  supplier: string | null
  suggestions: ModelsReorderSuggestionResponse[]
}

/** Suppliers in the order of their names, no supplier last */
const bySupplier = (one: string | null, other: string | null): number => {
  if (one === null || other === null) {
    return one === other ? 0 : one === null ? 1 : -1
  }

  return one.localeCompare(other, 'ja')
}

/**
 * The suggestions by supplier: an order is made of one supplier. The
 * suppliers come in the order of their names, the products that name no
 * supplier last, and the products of each in the order of their codes.
 */
export const suggestionGroupsOf = (
  suggestions: readonly ModelsReorderSuggestionResponse[],
): SuggestionGroup[] =>
  [...new Set(suggestions.map(({ supplier }) => supplier))]
    .toSorted(bySupplier)
    .map((supplier) => ({
      supplier,
      suggestions: suggestions.filter(
        (suggestion) => suggestion.supplier === supplier,
      ),
    }))

/**
 * The quantities a new order of a supplier starts with, by the IDs of the
 * rows: the quantity suggested for each of its products, on the last row
 * of the product in the order of the form, which is its only row unless
 * its lots are kept apart, and then the lot that comes last. The products
 * that name no supplier are those of the supplier `''`.
 */
export const suggestedQuantitiesOf = (
  suggestions: readonly ModelsReorderSuggestionResponse[],
  rows: readonly Pick<ModelsInventoryResponse, 'id' | 'productId'>[],
  supplier: string,
): Record<string, string> =>
  Object.fromEntries(
    suggestions
      .filter((suggestion) => (suggestion.supplier ?? '') === supplier)
      .flatMap(({ productId, suggestedQuantity }): [string, string][] => {
        const row = rows.findLast((stock) => stock.productId === productId)

        return row === undefined ? [] : [[row.id, `${suggestedQuantity}`]]
      }),
  )

/** What a new order that starts with the suggestions of a supplier says above its form, after how many rows it filled in. */
export const suggestedNoteOf = (supplier: string, filled: number): string => {
  if (filled === 0) {
    return 'この仕入先の発注の提案は、いまはありません。発注する行に、数量を入力してください。'
  }

  return supplier === ''
    ? `仕入先の決まっていない商品の、発注の提案の数量を ${filled} 行に入れました。仕入先を入力し、数量と単価を確かめてください。`
    : `${supplier} の発注の提案の数量を ${filled} 行に入れました。数量と単価を確かめてください。`
}
