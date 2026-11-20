import {
  type ModelsProductResponse,
  productCrudList,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  from,
  LARGEST_PAGE,
  NOT_FOUND,
  type NotFound,
  type Page,
  pageOf,
  toTheEnd,
  type Unread,
  unreadOf,
} from '../reading'

/*
 * The products of a salon: its catalogue of what it sells and what its
 * treatments use.
 */

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

/** The key the products of a salon are read under */
export const productsKeyOf = (salonId: string): string[] => [
  'salons',
  salonId,
  'products',
]
