import type {
  ModelsProductCreateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  PageHeader,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import type { FormSays } from '../bookings/booking-entry'
import { productHrefOf, productsHrefOf } from '../navigation'
import { NOT_FOUND } from '../reading'
import { salonKeyOf } from '../salons/salons-api'
import { WithSalon } from '../salons/with-salon'
import { ProductForm } from './components/product-form/product-form'
import { ProductsForbidden, useKeepsProducts } from './keeps-products'
import { afterProductWrite, readProductEntry } from './product-form'
import {
  addProduct,
  type ProductRead,
  productKeyOf,
  productsKeyOf,
} from './products-api'

const TITLE = '商品を足す'

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

type ProductEntryProps = { salon: ModelsSalonResponse }

/**
 * The form of a new product. The products that were read are dropped: the
 * new one belongs in the ledger, and among the materials of a treatment.
 */
const ProductEntry = ({ salon }: ProductEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const entry = useMutation({
    mutationFn: (request: ModelsProductCreateRequest) =>
      addProduct(salon.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ product }) => {
          const read: ProductRead = { type: 'found', product }
          queryClient.setQueryData(productKeyOf(product.id), read)
          queryClient.removeQueries({ queryKey: productsKeyOf(salon.id) })
          notify({
            tone: 'success',
            message: `商品「${product.name}」を足しました。`,
          })
          void navigate(productHrefOf(salon.id, product.id))
        })
        // The salon was removed meanwhile
        .with({ type: 'notFound' }, () =>
          queryClient.setQueryData(salonKeyOf(salon.id), NOT_FOUND),
        )
        .with(
          {
            type: P.union(
              'invalid',
              'codeTaken',
              'forbidden',
              'tooManyRequests',
              'failed',
            ),
          },
          (refused) => setSaid(afterProductWrite(refused)),
        )
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readProductEntry(values))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        entry.mutate(request)
      })
      .exhaustive()

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      <ProductForm
        product={null}
        submitLabel='足す'
        message={said.message}
        errors={said.errors}
        pending={entry.isPending}
        onSubmit={submit}
        actions={
          <ButtonLink href={productsHrefOf(salon.id)} variant='quiet'>
            やめる
          </ButtonLink>
        }
      />
    </>
  )
}

/** Adds a product to the salon of the address, for the owner, a manager and an administrator. */
export const ProductEntryScreen = () => {
  const { salonId = '' } = useParams()
  const keeps = useKeepsProducts()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <ProductEntry key={salon.id} salon={salon} />
        ) : (
          <ProductsForbidden salon={salon} title={TITLE} />
        )
      }
    </WithSalon>
  )
}
