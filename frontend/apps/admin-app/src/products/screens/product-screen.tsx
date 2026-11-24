import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { productChangeHrefOf, productsHrefOf } from '../../navigation'
import { productKeyOf, readProduct } from '../api/products-api'
import { ProductRecord } from '../components/product-record/product-record'
import { ProductNotFound, useKeepsProducts } from './keeps-products'

const { loading, names, titles, words } = adminProductMessages

type ProductPartProps = {
  salon: ModelsSalonResponse
  productId: string
}

/**
 * A product of the salon, read whenever the screen opens. An account that
 * keeps the products is offered to change it.
 */
const ProductPart = ({ salon, productId }: ProductPartProps) => {
  const keeps = useKeepsProducts()
  const product = useQuery({
    queryKey: productKeyOf(productId),
    queryFn: () => readProduct(salon.id, productId),
    staleTime: 0,
  })
  const say = useSay()
  const header = (
    <PageHeader title={say(titles.product)} description={salon.name} />
  )

  return match(product.data)
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label={say(loading.product)} />
      </>
    ))
    .with({ type: 'notFound' }, () => <ProductNotFound salon={salon} />)
    .with({ type: 'forbidden' }, () => (
      <>
        {header}
        <OtherSalonNotice what={names.productsOfTheSalon} />
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={say(unreadMessageOf(names.product, reason))}
          onRetry={() => void product.refetch()}
          pending={product.isFetching}
        />
      </>
    ))
    .with({ type: 'found' }, (found) => (
      <>
        <PageHeader
          title={say(titles.product)}
          description={salon.name}
          actions={
            keeps ? (
              <ButtonLink
                href={productChangeHrefOf(salon.id, found.product.id)}
                variant='primary'
              >
                {say(titles.change)}
              </ButtonLink>
            ) : undefined
          }
        />
        <ProductRecord product={found.product} currency={salon.currency} />
        <ButtonLink href={productsHrefOf(salon.id)}>
          {say(words.toLedger)}
        </ButtonLink>
      </>
    ))
    .exhaustive()
}

/** A product of the salon of the address, for everybody who works there and an administrator. */
export const ProductScreen = () => {
  const { salonId = '', productId = '' } = useParams()
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.product)}>
      {(salon) => (
        <ProductPart key={productId} salon={salon} productId={productId} />
      )}
    </WithSalon>
  )
}
