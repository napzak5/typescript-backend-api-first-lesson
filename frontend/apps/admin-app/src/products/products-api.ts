import {
  type ModelsProductCreateRequest,
  type ModelsProductResponse,
  type ModelsProductUpdateRequest,
  productCrudCreate,
  productCrudDelete,
  productCrudGet,
  productCrudList,
  productCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import {
  FAILED,
  type Forbidden,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Page,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  toTheEnd,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'
import { type ProductConditions, productListParamsOf } from './product-ledger'

/*
 * The products of a salon: its catalogue of what it sells and what its
 * treatments use. Everybody who works at the salon reads them; the owner,
 * a manager and an administrator keep them.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

const KEEPERS: readonly string[] = ['owner', 'manager', 'admin']

/** Whether a role keeps the products of its salon: the owner, a manager and an administrator. */
export const mayKeepProducts = (role: string): boolean => KEEPERS.includes(role)

export type ProductsRead =
  | { type: 'found'; items: ModelsProductResponse[] }
  | NotFound
  | Unread

/**
 * The products of a salon, read to the end: those it no longer carries as
 * well, since a treatment record keeps the products it used. A product
 * that was removed is not among them.
 */
export const readProducts = (salonId: string): Promise<ProductsRead> =>
  toTheEnd(async (cursor) => {
    const answer = await productCrudList(salonId, {
      ...from(cursor),
      limit: LARGEST_PAGE,
    }).catch(() => null)

    return (
      match(answer)
        .returnType<Page<ModelsProductResponse> | NotFound | Unread>()
        .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
        .with({ status: 404 }, () => NOT_FOUND)
        // The screens of a salon are behind the same permission as its products
        .with({ status: 403 }, () => FAILED)
        .with(
          P.union(
            null,
            { status: 400 },
            { status: 401 },
            { status: 429 },
            { status: 500 },
          ),
          unreadOf,
        )
        .exhaustive(outsideTheContract)
    )
  })

/**
 * The key the products of a salon are read under. The pages of the ledger
 * are read below it, so that dropping it drops them as well.
 */
export const productsKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'products',
]

/** The products of the ledger a page holds */
const LEDGER_PAGE = 20

export type ProductPage = Page<ModelsProductResponse> | Forbidden | Unread

/** The products of a salon that meet the conditions, a page at a time, in the order of their codes. */
export const readProductPage = async (
  salonId: string,
  conditions: ProductConditions,
  cursor: string | undefined,
): Promise<ProductPage> => {
  const answer = await productCrudList(salonId, {
    ...productListParamsOf(conditions),
    ...from(cursor),
    limit: LEDGER_PAGE,
  }).catch(() => null)

  return (
    match(answer)
      .returnType<ProductPage>()
      .with({ status: 200 }, ({ data }) => pageOf(data.data, data.meta))
      .with({ status: 403 }, () => FORBIDDEN)
      // The salon was removed after it was read, or the product of the cursor meanwhile
      .with({ status: P.union(400, 404) }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/** The key a product is read under. */
export const productKeyOf = (productId: string): string[] => [
  'product',
  productId,
]

export type ProductRead =
  | { type: 'found'; product: ModelsProductResponse }
  | NotFound
  /** The account works at another salon */
  | Forbidden
  | Unread

/** A product of a salon: one of another salon, one that was removed, or none, is not found. */
export const readProduct = async (
  salonId: string,
  productId: string,
): Promise<ProductRead> => {
  const answer = await productCrudGet(salonId, productId).catch(() => null)

  return match(answer)
    .returnType<ProductRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      product: data.data,
    }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type ProductWrite =
  | { type: 'written'; product: ModelsProductResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** Another product of the salon that was not removed has the code */
  | { type: 'codeTaken' }
  | NotFound
  | Forbidden
  | Unread

/** Adds a product to a salon. */
export const addProduct = async (
  salonId: string,
  request: ModelsProductCreateRequest,
): Promise<ProductWrite> => {
  const answer = await productCrudCreate(salonId, request).catch(() => null)

  return match(answer)
    .returnType<ProductWrite>()
    .with({ status: 201 }, ({ data }) => ({
      type: 'written',
      product: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'codeTaken' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

/** Changes what is given of a product, and nothing else. */
export const changeProduct = async (
  salonId: string,
  productId: string,
  request: ModelsProductUpdateRequest,
): Promise<ProductWrite> => {
  const answer = await productCrudUpdate(salonId, productId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<ProductWrite>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      product: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 409 }, () => ({ type: 'codeTaken' }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type ProductRemoval =
  | { type: 'removed' }
  /** The salon keeps stock of the product: it stays */
  | { type: 'inStock' }
  | NotFound
  | Forbidden
  | Unread

/** Removes a product the salon keeps no stock of. */
export const removeProduct = async (
  salonId: string,
  productId: string,
): Promise<ProductRemoval> => {
  const answer = await productCrudDelete(salonId, productId).catch(() => null)

  return match(answer)
    .returnType<ProductRemoval>()
    .with({ status: 204 }, () => ({ type: 'removed' }))
    .with({ status: 409 }, () => ({ type: 'inStock' }))
    .with({ status: P.union(400, 404) }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
