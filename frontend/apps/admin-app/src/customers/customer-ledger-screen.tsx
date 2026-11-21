import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { saveFile } from '@beauty-salon-frontend/io'
import {
  cursorAfter,
  firstCursor,
  listingOf,
  moreOf,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import {
  chartSearchHrefOf,
  customerEntryHrefOf,
  customerHrefOf,
  customerImportHrefOf,
} from '../navigation'
import {
  ChosenCustomers,
  type ChosenDialog,
} from './components/chosen-customers/chosen-customers'
import { CustomerFilter } from './components/customer-filter/customer-filter'
import { CustomerTable } from './components/customer-table/customer-table'
import {
  afterRemoval,
  afterRetagging,
  type BulkSays,
  type Chosen,
  choose,
  NONE_CHOSEN,
  readTagChange,
  type TagChange,
  withoutGone,
} from './customer-bulk'
import { removeCustomers, retagCustomers } from './customer-bulk-api'
import { afterLedgerExport } from './customer-export'
import { exportLedger } from './customer-export-api'
import { mayKeepCustomers } from './customer-history'
import {
  type CustomerConditions,
  customerConditionsIn,
  customerQueryOf,
  isNarrowed,
  readCustomerConditions,
} from './customer-ledger'
import {
  CUSTOMER_LISTS,
  customerNameOf,
  readCustomerPage,
} from './customers-api'

const TITLE = '顧客台帳'

/** What a dialog of the chosen customers says */
type DialogSays = { message: string | undefined; errors: FormErrors }

const NOTHING_SAID: DialogSays = { message: undefined, errors: {} }

/** Why an export of the ledger saved no file, under the conditions it was asked for */
type ExportSaid = {
  asked: string
  tone: 'warning' | 'danger'
  message: string
}

type CustomerLedgerProps = {
  salon: ModelsSalonResponse
}

/**
 * The customers of the ledger, the latest registered first. The ledger is
 * one for every salon; it is shown below a salon so that the days a
 * customer was registered on are those of its clock. The conditions are
 * in the query of the address, as those of the bookings are: a reload, the
 * way back from a customer and an address that is passed on show the same
 * customers.
 *
 * Customers are chosen in the table, to be given a tag or to have it taken
 * away, or to be removed from the ledger, all at once. Who is chosen
 * belongs to the conditions they were chosen under: other conditions
 * choose nobody, so that nothing is written to customers out of sight.
 *
 * An owner or a manager exports the customers who meet the conditions as
 * a CSV file. Why no file was saved is said under the header, and belongs
 * to the conditions it was asked for, as the choice does.
 */
const CustomerLedger = ({ salon }: CustomerLedgerProps) => {
  const session = useSession()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors | undefined>(undefined)
  const conditions = customerConditionsIn(query)
  const asked = customerQueryOf(conditions).toString()
  const narrowed = isNarrowed(conditions)
  const [choice, setChoice] = useState<{ asked: string; chosen: Chosen }>({
    asked,
    chosen: NONE_CHOSEN,
  })
  if (choice.asked !== asked) {
    // Other conditions: nobody is chosen, and coming back chooses nobody again
    setChoice({ asked, chosen: NONE_CHOSEN })
  }
  const chosen = choice.asked === asked ? choice.chosen : NONE_CHOSEN
  const setChosen = (next: Chosen): void => setChoice({ asked, chosen: next })
  const [dialog, setDialog] = useState<ChosenDialog>('none')
  const [said, setSaid] = useState<DialogSays>(NOTHING_SAID)
  const [exportSaid, setExportSaid] = useState<ExportSaid>()
  const mayKeep =
    session.type === 'signedIn' && mayKeepCustomers(session.user.role)
  const read = useInfiniteQuery({
    queryKey: [...CUSTOMER_LISTS, 'ledger', salon.timezone, asked],
    queryFn: ({ pageParam }) =>
      readCustomerPage(conditions, salon.timezone, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Customers are registered at every salon: the ledger is read whenever it is shown
    staleTime: 0,
  })

  const filter = (values: FormData): void => {
    const filled = readCustomerConditions(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next = customerQueryOf(filled.request)
    if (next.toString() === asked) {
      // The same customers again: whoever sends it wants what there is now
      void read.refetch()
      return
    }
    setQuery(next, { replace: true })
  }

  /** What follows a write of the chosen customers */
  const after = (says: BulkSays): void =>
    match(says)
      .with({ type: 'done' }, ({ message, clear }) => {
        setDialog('none')
        if (clear) {
          setChosen(NONE_CHOSEN)
        }
        void queryClient.invalidateQueries({ queryKey: CUSTOMER_LISTS })
        notify({ tone: 'success', message })
      })
      .with({ type: 'again' }, ({ message }) =>
        setSaid({ message, errors: {} }),
      )
      // Some left the ledger meanwhile: nobody was written
      .with({ type: 'gone' }, ({ message, ids }) => {
        setDialog('none')
        setChosen(withoutGone(chosen, ids))
        void queryClient.invalidateQueries({ queryKey: CUSTOMER_LISTS })
        notify({ tone: 'warning', message })
      })
      .exhaustive()

  const retagging = useMutation({
    mutationFn: (change: TagChange) =>
      retagCustomers([...chosen.keys()], change),
    onSuccess: (attempt, change) =>
      after(afterRetagging(attempt, change, chosen)),
  })
  const removal = useMutation({
    mutationFn: () => removeCustomers([...chosen.keys()]),
    onSuccess: (attempt) => after(afterRemoval(attempt, chosen)),
  })

  const exporting = useMutation({
    mutationFn: (exported: CustomerConditions) =>
      exportLedger(exported, salon.timezone),
    onMutate: () => setExportSaid(undefined),
    onSuccess: (outcome, exported) =>
      match(afterLedgerExport(outcome))
        .with({ type: 'saved' }, ({ file, message }) => {
          saveFile(file)
          notify({ tone: 'success', message })
        })
        .with({ type: 'said' }, ({ tone, message }) =>
          setExportSaid({
            asked: customerQueryOf(exported).toString(),
            tone,
            message,
          }),
        )
        .exhaustive(),
  })

  const retag = (values: FormData): void =>
    match(readTagChange(values))
      .with({ type: 'invalid' }, ({ errors: wrong }) =>
        setSaid({ message: undefined, errors: wrong }),
      )
      .with({ type: 'valid' }, ({ request }) => {
        setSaid(NOTHING_SAID)
        retagging.mutate(request)
      })
      .exhaustive()

  const entry = (
    <ButtonLink href={customerEntryHrefOf(salon.id)} variant='primary'>
      お客様を登録する
    </ButtonLink>
  )

  return (
    <>
      <PageHeader
        title={TITLE}
        description={salon.name}
        actions={entry}
        otherActions={
          <>
            <ButtonLink href={customerImportHrefOf(salon.id)}>
              CSV から登録する
            </ButtonLink>
            <ButtonLink href={chartSearchHrefOf(salon.id)}>
              カルテを探す
            </ButtonLink>
            {mayKeep && (
              <Button
                pending={exporting.isPending}
                onClick={() => exporting.mutate(conditions)}
              >
                CSV に出力する
              </Button>
            )}
          </>
        }
      />
      {exportSaid !== undefined && exportSaid.asked === asked && (
        <Alert tone={exportSaid.tone}>{exportSaid.message}</Alert>
      )}
      <CustomerFilter
        conditions={conditions}
        errors={errors}
        clearHref={narrowed ? '?' : undefined}
        onSubmit={filter}
      />
      {match(read.data === undefined ? undefined : listingOf(read.data.pages))
        .with(undefined, () => (
          <LoadingIndicator label='お客様を読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('顧客台帳', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title='条件に合うお客様はいません'
              description='条件を変えて探すか、新しいお客様として登録してください。'
              actions={entry}
            />
          ) : (
            <EmptyState
              title='台帳にお客様はいません'
              description='最初のお客様を登録してください。'
              actions={entry}
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <>
            <ChosenCustomers
              customers={[...chosen.values()].map((customer) => ({
                id: customer.id,
                name: customerNameOf(customer),
              }))}
              mayRemove={mayKeep}
              open={dialog}
              onOpen={(opened) => {
                setSaid(NOTHING_SAID)
                setDialog(opened)
              }}
              onClose={() => setDialog('none')}
              onClear={() => setChosen(NONE_CHOSEN)}
              message={said.message}
              errors={said.errors}
              pending={retagging.isPending || removal.isPending}
              onRetag={retag}
              onRemove={() => removal.mutate()}
            />
            <CustomerTable
              // Other conditions are another list
              key={asked}
              caption={narrowed ? '条件に合うお客様' : TITLE}
              rows={items}
              total={total}
              more={moreOf(rest, {
                nextPage: read.isFetchingNextPage,
                again: read.isRefetching,
              })}
              onMore={() =>
                void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
              }
              customerHref={({ id }) => customerHrefOf(salon.id, id)}
              choice={{
                chosen: new Set(chosen.keys()),
                onChoose: (customer, wanted) =>
                  setChosen(choose(chosen, customer, wanted)),
              }}
            />
          </>
        ))
        .exhaustive()}
    </>
  )
}

/** The ledger of the customers, below the salon of the address. */
export const CustomerLedgerScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <CustomerLedger key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
