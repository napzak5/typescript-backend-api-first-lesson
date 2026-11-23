import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  inJapanese,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { productChangeHrefOf, productsHrefOf } from '../../navigation'
import { productKeyOf, readProduct } from '../api/products-api'
import { ProductRecord } from '../components/product-record/product-record'
import { ProductNotFound, useKeepsProducts } from './keeps-products'

const TITLE = '商品の内容'

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
  const header = <PageHeader title={TITLE} description={salon.name} />

  return match(product.data)
    .with(undefined, () => (
      <>
        {header}
        <LoadingIndicator label='商品を読み込んでいます' />
      </>
    ))
    .with({ type: 'notFound' }, () => <ProductNotFound salon={salon} />)
    .with({ type: 'forbidden' }, () => (
      <>
        {header}
        <OtherSalonNotice what='商品' />
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        {header}
        <UnreadNotice
          message={inJapanese(
            unreadMessageOf(writtenInJapanese('商品'), reason),
          )}
          onRetry={() => void product.refetch()}
          pending={product.isFetching}
        />
      </>
    ))
    .with({ type: 'found' }, (found) => (
      <>
        <PageHeader
          title={TITLE}
          description={salon.name}
          actions={
            keeps ? (
              <ButtonLink
                href={productChangeHrefOf(salon.id, found.product.id)}
                variant='primary'
              >
                商品を直す
              </ButtonLink>
            ) : undefined
          }
        />
        <ProductRecord product={found.product} currency={salon.currency} />
        <ButtonLink href={productsHrefOf(salon.id)}>商品台帳へ</ButtonLink>
      </>
    ))
    .exhaustive()
}

/** A product of the salon of the address, for everybody who works there and an administrator. */
export const ProductScreen = () => {
  const { salonId = '', productId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <ProductPart key={productId} salon={salon} productId={productId} />
      )}
    </WithSalon>
  )
}
