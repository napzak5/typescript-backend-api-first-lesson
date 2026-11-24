import { NOT_FOUND } from '@beauty-salon-frontend/answers'
import type {
  ModelsProductCreateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { salonKeyOf, WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  type FormSays,
  NOTHING_TO_SAY,
  PageHeader,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { productHrefOf, productsHrefOf } from '../../navigation'
import {
  addProduct,
  type ProductRead,
  productKeyOf,
  productsKeyOf,
} from '../api/products-api'
import { ProductForm } from '../components/product-form/product-form'
import { afterProductWrite, readProductEntry } from '../utils/product-form'
import { ProductsForbidden, useKeepsProducts } from './keeps-products'

const { entry: ENTRY, titles, words } = adminProductMessages

type ProductEntryProps = { salon: ModelsSalonResponse }

/**
 * The form of a new product. The products that were read are dropped: the
 * new one belongs in the ledger, and among the materials of a treatment.
 */
const ProductEntry = ({ salon }: ProductEntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const say = useSay()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
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
            message: ENTRY.added(product.name),
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
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        entry.mutate(value)
      })
      .exhaustive()

  return (
    <>
      <PageHeader title={say(titles.entry)} description={salon.name} />
      <ProductForm
        product={null}
        submitLabel={say(ENTRY.submit)}
        message={said.message}
        errors={said.errors}
        pending={entry.isPending}
        onSubmit={submit}
        actions={
          <ButtonLink href={productsHrefOf(salon.id)} variant='quiet'>
            {say(words.cancel)}
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
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.entry)}>
      {(salon) =>
        keeps ? (
          <ProductEntry key={salon.id} salon={salon} />
        ) : (
          <ProductsForbidden salon={salon} title={titles.entry} />
        )
      }
    </WithSalon>
  )
}
