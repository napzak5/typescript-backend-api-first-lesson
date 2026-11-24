import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsProductResponse,
  ModelsProductUpdateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  aboutTheAttempt,
  Button,
  ButtonLink,
  Dialog,
  type FormSays,
  LoadingIndicator,
  NO_CHANGE_MESSAGE,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminProductMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { productHrefOf, productsHrefOf } from '../../navigation'
import {
  changeProduct,
  type ProductRead,
  productKeyOf,
  productsKeyOf,
  readProduct,
  removeProduct,
} from '../api/products-api'
import { ProductForm } from '../components/product-form/product-form'
import {
  afterProductRemoval,
  afterProductWrite,
  readProductChange,
} from '../utils/product-form'
import {
  ProductNotFound,
  ProductsForbidden,
  useKeepsProducts,
} from './keeps-products'

const {
  change: CHANGE,
  loading,
  names,
  removal: REMOVAL,
  titles,
  words,
} = adminProductMessages

type ProductChangeProps = {
  salon: ModelsSalonResponse
  product: ModelsProductResponse
}

/**
 * The form of a product, opened with what the salon has of it now. It
 * sends what was changed and nothing else, and a form sent as it was
 * opened asks the API for nothing. Beside the form, the product is
 * removed after a dialog; one the salon keeps stock of stays, and the
 * salon is told to stop carrying it instead.
 */
const ProductChange = ({ salon, product }: ProductChangeProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const say = useSay()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [removing, setRemoving] = useState(false)
  /** What went wrong with a removal that can be made again: said in the dialog */
  const [message, setMessage] = useState<LocalizedText>()
  const key = productKeyOf(product.id)
  const page = productHrefOf(salon.id, product.id)

  /** The products that were read are dropped: the ledger and the materials of a treatment read them anew */
  const forgetList = (): void =>
    queryClient.removeQueries({ queryKey: productsKeyOf(salon.id) })

  /** The product is not there any more: removed here, or by somebody else meanwhile */
  const gone = (): void => {
    forgetList()
    queryClient.setQueryData(key, NOT_FOUND)
  }

  const change = useMutation({
    mutationFn: (request: ModelsProductUpdateRequest) =>
      changeProduct(salon.id, product.id, request),
    onSuccess: (outcome) =>
      match(outcome)
        .with({ type: 'written' }, ({ product: changed }) => {
          const read: ProductRead = { type: 'found', product: changed }
          queryClient.setQueryData(key, read)
          forgetList()
          notify({
            tone: 'success',
            message: CHANGE.changed(changed.name),
          })
          void navigate(page)
        })
        .with({ type: 'notFound' }, gone)
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

  const removal = useMutation({
    mutationFn: () => removeProduct(salon.id, product.id),
    onSuccess: (outcome) =>
      match(afterProductRemoval(outcome, product.name))
        .with({ type: 'done' }, ({ message: done }) => {
          gone()
          notify({ tone: 'success', message: done })
          void navigate(productsHrefOf(salon.id))
        })
        .with({ type: 'gone' }, gone)
        .with({ type: 'again' }, ({ message: again }) => setMessage(again))
        .with({ type: 'refused' }, ({ message: refused }) => {
          setRemoving(false)
          setSaid(aboutTheAttempt(refused))
        })
        .exhaustive(),
  })

  const submit = (values: FormData): void =>
    match(readProductChange(values, product))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'unchanged' }, () => {
        notify({ tone: 'info', message: NO_CHANGE_MESSAGE })
        void navigate(page)
      })
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        change.mutate(value)
      })
      .exhaustive()

  const close = (): void => {
    setRemoving(false)
    setMessage(undefined)
  }

  return (
    <>
      <ProductForm
        product={product}
        submitLabel={say(CHANGE.submit)}
        message={said.message}
        errors={said.errors}
        pending={change.isPending}
        onSubmit={submit}
        actions={
          <>
            <ButtonLink href={page} variant='quiet'>
              {say(words.cancel)}
            </ButtonLink>
            <Button variant='danger' onClick={() => setRemoving(true)}>
              {say(REMOVAL.remove)}
            </Button>
          </>
        }
      />
      <Dialog
        open={removing}
        onClose={close}
        title={say(REMOVAL.title(product.name))}
        description={say(REMOVAL.description)}
        actions={
          <>
            <Button onClick={close}>{say(REMOVAL.back)}</Button>
            <Button
              variant='danger'
              pending={removal.isPending}
              onClick={() => {
                setMessage(undefined)
                removal.mutate()
              }}
            >
              {say(REMOVAL.submit)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </>
  )
}

type ChangePartProps = { salon: ModelsSalonResponse; productId: string }

/**
 * The product of the address, read anew whenever the screen opens, so that
 * what the form writes on is what the salon holds now; the form once it
 * was. It is not read again when the window comes back: the form compares
 * what is sent with what it was opened with.
 */
const ChangePart = ({ salon, productId }: ChangePartProps) => {
  const product = useQuery({
    queryKey: productKeyOf(productId),
    queryFn: () => readProduct(salon.id, productId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const say = useSay()
  const header = (
    <PageHeader title={say(titles.change)} description={salon.name} />
  )

  return match(product.isFetchedAfterMount ? product.data : undefined)
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
        {header}
        <ProductChange salon={salon} product={found.product} />
      </>
    ))
    .exhaustive()
}

/** Changes a product of the salon of the address, and removes it, for the owner, a manager and an administrator. */
export const ProductChangeScreen = () => {
  const { salonId = '', productId = '' } = useParams()
  const keeps = useKeepsProducts()
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.change)}>
      {(salon) =>
        keeps ? (
          <ChangePart key={productId} salon={salon} productId={productId} />
        ) : (
          <ProductsForbidden salon={salon} title={titles.change} />
        )
      }
    </WithSalon>
  )
}
