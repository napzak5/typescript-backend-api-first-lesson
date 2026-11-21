import type {
  ModelsCustomerResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  KeywordSearch,
  keywordIn,
  keywordOf,
  NOT_FOUND,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  Alert,
  ButtonLink,
  Card,
  LoadingIndicator,
  UnreadNotice,
  useNotifications,
} from '@beauty-salon-frontend/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { customerHrefOf, customerMergeHrefOf } from '../navigation'
import { CustomerMerge } from './components/customer-merge/customer-merge'
import { KEPT_BY_OTHERS, mayKeepCustomers } from './customer-history'
import {
  afterMerge,
  type MergePair,
  type MergeWay,
  mergeObstaclesOf,
} from './customer-merge'
import {
  mergeCustomers,
  mergeKeyOf,
  mergeRecordsOf,
  readMerge,
} from './customer-merge-api'
import {
  CUSTOMER_LISTS,
  type CustomerRead,
  customerKeyOf,
} from './customers-api'
import { FoundCustomers } from './found-customers'
import { fullNameOf, WithCustomer } from './with-customer'

const TITLE = 'ほかのお客様とまとめる'

type MergeWithProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
  otherId: string
  /** The address of the search the other was chosen from */
  chooseAgainHref: string
  /** The heading of the part: the focus goes there when the API refuses */
  headingRef: RefObject<HTMLHeadingElement | null>
}

/**
 * The customer of the address and the one chosen to merge with them: the
 * other and what the merge looks at of both are read whenever the part is
 * shown, and read again when the API refuses. The dialog that had the focus
 * is gone then, and the button that opened it may be too: the focus goes to
 * the heading of the part, above what says why.
 */
const MergeWith = ({
  salon,
  customer,
  otherId,
  chooseAgainHref,
  headingRef,
}: MergeWithProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const read = useQuery({
    queryKey: mergeKeyOf(customer.id, otherId),
    queryFn: () => readMerge(customer.id, otherId),
    staleTime: 0,
    gcTime: 0,
  })
  const [thisKept, setThisKept] = useState(true)
  const [way, setWay] = useState<MergeWay>('keep_primary')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [refusal, setRefusal] = useState<string | undefined>(undefined)

  useLayoutEffect(() => {
    if (refusal !== undefined) {
      headingRef.current?.focus()
    }
  }, [refusal, headingRef])

  const merging = useMutation({
    mutationFn: (pair: MergePair) => mergeCustomers(pair, way),
    onSuccess: (outcome, pair) =>
      match(afterMerge(outcome, pair))
        .with({ type: 'done' }, ({ customer: merged, message: said }) => {
          const kept: CustomerRead = { type: 'found', customer: merged }
          notify({ tone: 'success', message: said })
          void navigate(customerHrefOf(salon.id, merged.id))
          // What was read of either is old: the lists, and what was read
          // below their records (history, points, preferences, statistics)
          queryClient.removeQueries({ queryKey: CUSTOMER_LISTS })
          for (const id of [pair.primary.id, pair.secondary.id]) {
            const key = customerKeyOf(id)
            queryClient.removeQueries({
              queryKey: key,
              predicate: ({ queryKey }) => queryKey.length > key.length,
            })
          }
          queryClient.setQueryData(customerKeyOf(merged.id), kept)
          queryClient.setQueryData(customerKeyOf(pair.secondary.id), NOT_FOUND)
        })
        .with({ type: 'again' }, ({ message: said }) => setMessage(said))
        .with({ type: 'refused' }, ({ message: said }) => {
          setOpen(false)
          setRefusal(said)
          // The customer of the address, and what the merge looks at of both
          void queryClient.invalidateQueries({
            queryKey: customerKeyOf(customer.id),
          })
        })
        .exhaustive(),
  })

  return match(read.isFetchedAfterMount ? read.data : undefined)
    .with(undefined, () => (
      <LoadingIndicator label='まとめる相手を読み込んでいます' />
    ))
    .with({ type: 'notFound' }, () => (
      <>
        {refusal !== undefined && <Alert tone='danger'>{refusal}</Alert>}
        <p>
          選んだお客様は、台帳にいません。まとめる相手を選び直してください。
        </p>
        <ButtonLink href={chooseAgainHref}>相手を選び直す</ButtonLink>
      </>
    ))
    .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
      <UnreadNotice
        message={unreadMessageOf('まとめる相手', reason)}
        onRetry={() => void read.refetch()}
        pending={read.isFetching}
      />
    ))
    .with({ type: 'found' }, (found) => {
      const pair: MergePair = thisKept
        ? { primary: customer, secondary: found.other }
        : { primary: found.other, secondary: customer }

      return (
        <>
          <p>{`${fullNameOf(found.other)} 様（${found.other.email}）`}</p>
          <ButtonLink href={chooseAgainHref}>相手を選び直す</ButtonLink>
          <CustomerMerge
            customer={customer}
            other={found.other}
            thisKept={thisKept}
            onKeep={setThisKept}
            way={way}
            onWay={setWay}
            obstacles={mergeObstaclesOf(pair, mergeRecordsOf(found, thisKept))}
            customerHref={(customerId) => customerHrefOf(salon.id, customerId)}
            refusal={refusal}
            open={open}
            onOpen={() => {
              setMessage(undefined)
              setRefusal(undefined)
              setOpen(true)
            }}
            onClose={() => setOpen(false)}
            message={message}
            pending={merging.isPending}
            onMerge={() => merging.mutate(pair)}
          />
        </>
      )
    })
    .exhaustive()
}

type MergePartProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * The search of the ledger for the other record of the customer, and the
 * merge with the one chosen. The keyword and the choice are the query of
 * the address. When the one replaces the other, the focus moves to the
 * heading of the part, as the link or the button that was pressed is gone.
 */
const MergePart = ({ salon, customer }: MergePartProps) => {
  const navigate = useNavigate()
  const [query] = useSearchParams()
  const keyword = keywordIn(query, 'keyword')
  const chosen = query.get('with')
  // The customer cannot be merged with themselves
  const otherId = chosen === null || chosen === customer.id ? undefined : chosen
  const heading = useRef<HTMLHeadingElement>(null)
  const shown = useRef(otherId)

  useLayoutEffect(() => {
    if (shown.current !== otherId) {
      shown.current = otherId
      heading.current?.focus()
    }
  }, [otherId])

  return (
    <Card title='まとめる相手' headingRef={heading}>
      {otherId === undefined ? (
        <>
          <KeywordSearch
            label='まとめる相手を探す'
            description='お名前（カナでも）、メールアドレス、電話番号の一部。'
            keyword={keyword}
            clearHref={customerMergeHrefOf(salon.id, customer.id)}
            onSubmit={(values) =>
              void navigate(
                customerMergeHrefOf(salon.id, customer.id, {
                  keyword: keywordOf(values),
                  otherId: undefined,
                }),
              )
            }
          />
          {keyword !== undefined && (
            <FoundCustomers
              keyword={keyword}
              choose={{
                type: 'link',
                hrefOf: ({ id }) =>
                  customerMergeHrefOf(salon.id, customer.id, {
                    keyword,
                    otherId: id,
                  }),
                excluded: customer.id,
              }}
            />
          )}
        </>
      ) : (
        <MergeWith
          key={otherId}
          salon={salon}
          customer={customer}
          otherId={otherId}
          chooseAgainHref={customerMergeHrefOf(salon.id, customer.id, {
            keyword,
            otherId: undefined,
          })}
          headingRef={heading}
        />
      )}
    </Card>
  )
}

/** Merges a customer with another record of the same person, below the salon of the address. */
export const CustomerMergeScreen = () => {
  const { salonId = '' } = useParams()
  const session = useSession()
  const keeper =
    session.type === 'signedIn' && mayKeepCustomers(session.user.role)

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => (
        <WithCustomer key={salon.id} salon={salon} title={TITLE} fresh>
          {(customer) =>
            keeper ? (
              <>
                <p>
                  同じお客様が台帳に 2 人いるとき、もう一方を探して選び、1
                  人にまとめます。
                </p>
                <MergePart
                  key={customer.id}
                  salon={salon}
                  customer={customer}
                />
              </>
            ) : (
              <p>{KEPT_BY_OTHERS}</p>
            )
          }
        </WithCustomer>
      )}
    </WithSalon>
  )
}
