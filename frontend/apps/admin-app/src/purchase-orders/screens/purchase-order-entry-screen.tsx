import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryResponse,
  ModelsPurchaseOrderCreateRequest,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  type FormSays,
  LoadingIndicator,
  NOTHING_TO_SAY,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  everyStockRowKeyOf,
  readEveryStockRow,
} from '../../inventory/api/inventory-api'
import {
  inventoryHrefOf,
  purchaseOrderHrefOf,
  purchaseOrdersHrefOf,
  reorderSuggestionsHrefOf,
  SUGGESTED_PARAMETER,
} from '../../navigation'
import { productsKeyOf, readProducts } from '../../products/api/products-api'
import {
  type EverySuggestion,
  makeOrder,
  type OrderRead,
  purchaseOrderKeyOf,
  purchaseOrdersKeyOf,
  readEverySuggestion,
  suggestionsKeyOf,
} from '../api/purchase-orders-api'
import { OrderForm } from '../components/order-form/order-form'
import { afterOrderEntry, readOrderEntry } from '../utils/order-entry'
import { orderStatusNameOf } from '../utils/order-format'
import {
  suggestedNoteOf,
  suggestedQuantitiesOf,
} from '../utils/order-suggestions'

const { form, loading, names, titles, words } = adminPurchaseOrderMessages
const WORDS = form.entry

/** What a new order that does not start with suggestions reads of them */
const NONE_SUGGESTED: EverySuggestion = { type: 'found', items: [] }

/**
 * The form of a new purchase order of the salon: every stock row of it,
 * read whenever the screen opens, with the products that name the rows
 * and price them. When the address names a supplier of the suggestions,
 * the suggestions are read as well, and the form starts with the supplier
 * and the quantities suggested for its products. The order is made as a
 * draft, and its screen shows it. When the API says that a row was
 * removed meanwhile, the rows are read anew, and what was entered stays.
 */
const EntryPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays<LocalizedText>>(NOTHING_TO_SAY)
  const [searchParams] = useSearchParams()
  const suggested = searchParams.get(SUGGESTED_PARAMETER)
  const rows = useQuery({
    queryKey: everyStockRowKeyOf(salon.id),
    queryFn: () => readEveryStockRow(salon.id),
    staleTime: 0,
  })
  const products = useQuery({
    queryKey: productsKeyOf(salon.id),
    queryFn: () => readProducts(salon.id),
    staleTime: 0,
  })
  const suggestions = useQuery({
    queryKey: suggestionsKeyOf(salon.id),
    queryFn: () => readEverySuggestion(salon.id),
    staleTime: 0,
    enabled: suggested !== null,
  })

  const entry = useMutation({
    mutationFn: (request: ModelsPurchaseOrderCreateRequest) =>
      makeOrder(request),
    onSuccess: (outcome, request) =>
      match(outcome)
        .with({ type: 'made' }, ({ order }) => {
          const read: OrderRead = { type: 'found', order }
          queryClient.setQueryData(purchaseOrderKeyOf(order.id), read)
          // The new order belongs in every list of the orders of the salon
          queryClient.removeQueries({
            queryKey: purchaseOrdersKeyOf(salon.id),
          })
          notify({
            tone: 'success',
            message: WORDS.made(
              order.orderNumber,
              orderStatusNameOf(order.status),
            ),
          })
          void navigate(purchaseOrderHrefOf(salon.id, order.id))
        })
        .with({ type: 'rowsChanged' }, (refused) => {
          void queryClient.invalidateQueries({
            queryKey: everyStockRowKeyOf(salon.id),
            exact: true,
          })
          setSaid(afterOrderEntry(refused, request, salon.currency))
        })
        .with(
          {
            type: P.union('invalid', 'forbidden', 'tooManyRequests', 'failed'),
          },
          (refused) =>
            setSaid(afterOrderEntry(refused, request, salon.currency)),
        )
        .exhaustive(),
  })

  const submit = (
    values: FormData,
    read: readonly ModelsInventoryResponse[],
  ): void =>
    match(readOrderEntry(values, salon, read))
      .with({ type: 'invalid' }, ({ errors }) =>
        setSaid({ message: undefined, errors }),
      )
      .with({ type: 'tooMuch' }, ({ message }) =>
        setSaid({ message, errors: {} }),
      )
      .with({ type: 'valid' }, ({ value }) => {
        setSaid(NOTHING_TO_SAY)
        entry.mutate(value)
      })
      .exhaustive()

  return (
    <>
      <PageHeader title={say(titles.entry)} description={salon.name} />
      {match([rows.data, products.data])
        .with([undefined, P._], [{ type: 'found' }, undefined], () => (
          <LoadingIndicator label={say(WORDS.loadingRows)} />
        ))
        .with([{ type: 'forbidden' }, P._], () => (
          <OtherSalonNotice what={names.ordersOfTheSalon} />
        ))
        .with([{ type: P.union(...UNREAD_TYPES) }, P._], ([reason]) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.rows, reason))}
            onRetry={() => void rows.refetch()}
            pending={rows.isFetching}
          />
        ))
        // The salon was removed meanwhile, or the products could not be read
        .with(
          [
            { type: 'found' },
            { type: P.union('notFound', 'tooManyRequests', 'failed') },
          ],
          ([, reason]) => (
            <UnreadNotice
              message={say(unreadMessageOf(names.products, reason))}
              onRetry={() => void products.refetch()}
              pending={products.isFetching}
            />
          ),
        )
        .with([{ type: 'found', items: [] }, { type: 'found' }], () => (
          <EmptyState
            title={say(WORDS.noRows.title)}
            description={say(WORDS.noRows.description)}
            actions={
              <ButtonLink href={inventoryHrefOf(salon.id)}>
                {say(WORDS.noRows.toInventory)}
              </ButtonLink>
            }
          />
        ))
        .with([{ type: 'found' }, { type: 'found' }], ([read, named]) =>
          match(suggested === null ? NONE_SUGGESTED : suggestions.data)
            .with(undefined, () => (
              <LoadingIndicator label={say(loading.suggestions)} />
            ))
            .with({ type: 'forbidden' }, () => (
              <OtherSalonNotice what={names.ordersOfTheSalon} />
            ))
            .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
              <UnreadNotice
                message={say(unreadMessageOf(names.suggestions, reason))}
                onRetry={() => void suggestions.refetch()}
                pending={suggestions.isFetching}
              />
            ))
            .with({ type: 'found' }, (offered) => {
              const quantities =
                suggested === null
                  ? {}
                  : suggestedQuantitiesOf(offered.items, read.items, suggested)

              return (
                <>
                  {suggested !== null && (
                    <p>
                      {say(
                        suggestedNoteOf(
                          suggested,
                          Object.keys(quantities).length,
                        ),
                      )}
                    </p>
                  )}
                  <OrderForm
                    rows={read.items}
                    products={named.items}
                    salon={salon}
                    starting={{ supplier: suggested ?? '', quantities }}
                    submitLabel={say(WORDS.submit)}
                    message={said.message}
                    errors={said.errors}
                    pending={entry.isPending}
                    onSubmit={(values) => submit(values, read.items)}
                    actions={
                      <ButtonLink
                        href={
                          suggested === null
                            ? purchaseOrdersHrefOf(salon.id)
                            : reorderSuggestionsHrefOf(salon.id)
                        }
                        variant='quiet'
                      >
                        {say(words.cancel)}
                      </ButtonLink>
                    }
                  />
                </>
              )
            })
            .exhaustive(),
        )
        .exhaustive()}
    </>
  )
}

/** A new purchase order of the salon of the address, for every member of its staff and an administrator. */
export const PurchaseOrderEntryScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.entry)}>
      {(salon) => <EntryPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
