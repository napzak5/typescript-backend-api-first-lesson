import {
  NOT_FOUND,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerResponse,
  ModelsCustomerVersionResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { PreferencesDetails } from '@beauty-salon-frontend/preferences'
import {
  dayAt,
  lastYearUntil,
  OtherSalonNotice,
  type Period,
  periodIn,
  periodNameOf,
  periodQueryOf,
  readPeriod,
  StatisticsPeriod,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  Card,
  type FormErrors,
  LoadingIndicator,
  UnreadNotice,
  useNotifications,
  useSay,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { type RefObject, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  bookingOfCustomerHrefOf,
  chartHrefOf,
  customerChangeHrefOf,
  customerHistoryHrefOf,
  customerHrefOf,
  customerMergeHrefOf,
  customerPointsHrefOf,
  customerPreferencesHrefOf,
  customersHrefOf,
  treatmentsOfCustomerHrefOf,
  userAccountHrefOf,
} from '../../navigation'
import { useAdministersAccounts } from '../../user-accounts/hooks/administers-accounts'
import {
  type Removal,
  removeCustomer,
  removedKeyOf,
  restoreCustomer,
} from '../api/customer-history-api'
import {
  CUSTOMER_LISTS,
  type CustomerRead,
  customerKeyOf,
  customerNameOf,
  preferencesKeyOf,
  readCustomer,
  readPreferences,
  readStatistics,
  statisticsKeyOf,
} from '../api/customers-api'
import { CustomerKeeping } from '../components/customer-keeping/customer-keeping'
import {
  CustomerRecord,
  type CustomerRecordProps,
} from '../components/customer-record/customer-record'
import { CustomerStatistics } from '../components/customer-statistics/customer-statistics'
import {
  RemovedRecord,
  type RemovedRecordProps,
} from '../components/removed-record/removed-record'
import { type Referrer, referrerOf } from '../utils/customer-form'
import { staffNamesOf } from '../utils/customer-format'
import {
  afterRemoval,
  afterRestoration,
  changerNameOf,
  mayKeepCustomers,
} from '../utils/customer-history'
import { customerQueryOf } from '../utils/customer-ledger'
import { RemovedRequestsPart, RequestsPart } from './customer-requests-part'
import { RemovedCustomer } from './removed-customer'
import { WithCustomer } from './with-customer'

const {
  account,
  gone,
  names,
  notices,
  preferences: preferencesWords,
  restoration: restorationWords,
  titles,
  use,
} = adminCustomerMessages

const TITLE = titles.customer

type PartProps = {
  salon: ModelsSalonResponse
  customer: ModelsCustomerResponse
}

/**
 * What the ledger keeps of the customer, with the customer who referred
 * them named once they were read. Until then, and when they could not be
 * read, the page of the referrer is led to all the same: the record does
 * not wait for them.
 */
const RecordPart = ({
  customer,
  ...record
}: Omit<CustomerRecordProps, 'referrer'>) => {
  const { referredBy } = customer
  const read = useQuery({
    queryKey: customerKeyOf(referredBy ?? ''),
    queryFn: () => readCustomer(referredBy ?? ''),
    enabled: referredBy !== null,
    staleTime: 0,
  })
  const referrer = match(read.data)
    .returnType<Referrer | undefined>()
    .with({ type: 'found' }, ({ customer: found }) => referrerOf(found))
    .with({ type: 'notFound' }, () =>
      referredBy === null ? undefined : { type: 'gone', id: referredBy },
    )
    .with(undefined, { type: P.union(...UNREAD_TYPES) }, () => undefined)
    .exhaustive()

  return <CustomerRecord {...record} customer={customer} referrer={referrer} />
}

/**
 * What the customer wants the salons to keep in mind, with the members of
 * the staff named as the salons show them; of one who is shown no more it
 * says that there is one. It is read with the page; the customer may
 * change it from the portal at any time, and the salon from here.
 */
const PreferencesPart = ({ salon, customer }: PartProps) => {
  const say = useSay()
  const read = useQuery({
    queryKey: preferencesKeyOf(customer.id),
    queryFn: () => readPreferences(customer.id),
    staleTime: 0,
  })

  return (
    <Card
      title={say(preferencesWords.title)}
      actions={
        <ButtonLink href={customerPreferencesHrefOf(salon.id, customer.id)}>
          {say(preferencesWords.change)}
        </ButtonLink>
      }
    >
      {match(read.data)
        .with(undefined, () => (
          <LoadingIndicator label={say(preferencesWords.loading)} />
        ))
        .with({ type: 'found' }, ({ preferences, staff }) => (
          <PreferencesDetails
            preferences={preferences}
            staffNames={(ids) => staffNamesOf(ids, staff)}
          />
        ))
        .with({ type: 'notFound' }, () => <p>{say(gone)}</p>)
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.preferences, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}

/**
 * Whether the customer signs in to the portal, for an administrator, who
 * is led to the account: its lock is lifted, and its second factor reset,
 * there.
 */
const AccountPart = ({ customer }: Pick<PartProps, 'customer'>) => {
  const say = useSay()

  return (
    <Card
      title={say(account.title)}
      actions={
        customer.userId === null ? undefined : (
          <ButtonLink href={userAccountHrefOf(customer.userId)}>
            {say(account.open)}
          </ButtonLink>
        )
      }
    >
      <p>{say(customer.userId === null ? account.none : account.some)}</p>
    </Card>
  )
}

/**
 * What the customer did at the salon over a period: the year up to today
 * at the salon, or the days in the query of the address. Another period is
 * another address, so the way back shows the period that was shown.
 */
const UsePart = ({ salon, customer }: PartProps) => {
  const say = useSay()
  const [query, setQuery] = useSearchParams()
  const [errors, setErrors] = useState<FormErrors<LocalizedText> | undefined>(
    undefined,
  )
  const period = periodIn(
    query,
    lastYearUntil(dayAt(new Date(), salon.timezone)),
  )
  const read = useQuery({
    queryKey: statisticsKeyOf(customer.id, salon.id, period),
    queryFn: () => readStatistics(customer.id, salon.id, period),
    staleTime: 0,
  })

  const count = (values: FormData): void => {
    const filled = readPeriod(values)
    if (filled.type === 'invalid') {
      setErrors(filled.errors)
      return
    }
    setErrors(undefined)
    const next: Period = filled.value
    if (periodQueryOf(next).toString() === periodQueryOf(period).toString()) {
      void read.refetch()
      return
    }
    setQuery(periodQueryOf(next), { replace: true })
  }

  return (
    <Card
      title={say(use.title)}
      actions={
        <ButtonLink href={treatmentsOfCustomerHrefOf(salon.id, customer.id)}>
          {say(use.treatments)}
        </ButtonLink>
      }
    >
      <StatisticsPeriod
        period={period}
        description={say(use.periodDescription)}
        errors={errors}
        onSubmit={count}
      />
      <p>{say(use.of(periodNameOf(period)))}</p>
      {match(read.data)
        .with(undefined, () => <LoadingIndicator label={say(use.counting)} />)
        .with({ type: 'found' }, ({ statistics }) => (
          <CustomerStatistics
            statistics={statistics}
            timezone={salon.timezone}
            currency={salon.currency}
          />
        ))
        .with({ type: 'notFound' }, () => <p>{say(gone)}</p>)
        .with({ type: 'forbidden' }, () => (
          <OtherSalonNotice what={names.usage} />
        ))
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.usage, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .exhaustive()}
    </Card>
  )
}

/**
 * Forgets what was read of a customer who left the ledger or came back:
 * the lists that showed them or not, and what was read below their record
 * (their history, versions, preferences, statistics). The record itself is
 * then set to what the ledger holds now, where the screen reads it.
 */
const forgetCustomer = (queryClient: QueryClient, customerId: string): void => {
  const key = customerKeyOf(customerId)
  queryClient.removeQueries({ queryKey: CUSTOMER_LISTS })
  queryClient.removeQueries({
    queryKey: key,
    predicate: ({ queryKey }) => queryKey.length > key.length,
  })
}

type HeadingAfterMoveProps = {
  /** The customer left the ledger here, or came back */
  moved: RefObject<boolean>
}

/**
 * The customer left the ledger, here or by another account: the page
 * shows them as removed, and its heading takes the focus.
 */
const showRemoved = (
  queryClient: QueryClient,
  customerId: string,
  moved: RefObject<boolean>,
): void => {
  moved.current = true
  forgetCustomer(queryClient, customerId)
  queryClient.setQueryData(customerKeyOf(customerId), NOT_FOUND)
}

/**
 * The button that removed or brought back the customer went with what it
 * did, and the screen is the same one: the focus goes to its heading, in
 * the commit that shows the customer as they are now.
 */
const HeadingAfterMove = ({ moved }: HeadingAfterMoveProps) => {
  const focusHeading = useScreenHeadingFocus()

  useLayoutEffect(() => {
    if (moved.current) {
      moved.current = false
      focusHeading()
    }
  }, [moved, focusHeading])

  return null
}

type KeepingPartProps = PartProps & HeadingAfterMoveProps

/**
 * The history of the customer, and their removal from the ledger after a
 * dialog has asked. A removed customer stays at the address, as the
 * ledger kept them, and can be brought back from there.
 */
const KeepingPart = ({ salon, customer, moved }: KeepingPartProps) => {
  const session = useSession()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [open, setOpen] = useState(false)
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<LocalizedText>()
  /** What the API refused: said beside the buttons */
  const [refusal, setRefusal] = useState<LocalizedText>()
  const name = customerNameOf(customer)

  const left = (): void => showRemoved(queryClient, customer.id, moved)

  const removal = useMutation({
    mutationFn: () => removeCustomer(customer.id),
    onSuccess: (outcome) =>
      match(afterRemoval(outcome))
        .with({ type: 'done' }, () => {
          left()
          notify({ tone: 'success', message: notices.removed(name) })
        })
        .with({ type: 'again' }, ({ message: said }) => setMessage(said))
        .with({ type: 'refused' }, ({ message: said }) => {
          setOpen(false)
          setRefusal(said)
        })
        // Another account removed them first: the page says who and when
        .with({ type: 'gone' }, left)
        .exhaustive(),
  })

  return (
    <CustomerKeeping
      keepable={
        session.type === 'signedIn' && mayKeepCustomers(session.user.role)
      }
      name={name}
      historyHref={customerHistoryHrefOf(salon.id, customer.id)}
      mergeHref={customerMergeHrefOf(salon.id, customer.id)}
      open={open}
      onOpen={() => {
        setMessage(undefined)
        setRefusal(undefined)
        setOpen(true)
      }}
      onClose={() => setOpen(false)}
      message={message}
      refusal={refusal}
      pending={removal.isPending}
      onRemove={() => removal.mutate()}
    />
  )
}

type RemovedPartProps = HeadingAfterMoveProps & {
  salon: ModelsSalonResponse
  version: ModelsCustomerVersionResponse
  removal: Removal
}

/**
 * A customer who left the ledger, as their latest version keeps them, and
 * the way back for one who was removed. Another customer who took their
 * address of mail in the meantime is to be changed first: the refusal
 * leads to them.
 */
const RemovedPart = ({ salon, version, removal, moved }: RemovedPartProps) => {
  const session = useSession()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const [refusal, setRefusal] = useState<RemovedRecordProps['refusal']>()
  const { customerId } = version

  const restoration = useMutation({
    mutationFn: () => restoreCustomer(customerId),
    onSuccess: (outcome) =>
      match(afterRestoration(outcome, version.email))
        .with({ type: 'done' }, ({ customer }) => {
          const read: CustomerRead = { type: 'found', customer }
          moved.current = true
          forgetCustomer(queryClient, customerId)
          queryClient.setQueryData(customerKeyOf(customerId), read)
          notify({
            tone: 'success',
            message: notices.restored(customerNameOf(customer)),
          })
        })
        .with({ type: 'emailTaken' }, ({ message }) =>
          setRefusal({
            message,
            link: {
              href: `${customersHrefOf(salon.id)}?${customerQueryOf({ search: version.email, tags: [] })}`,
              label: restorationWords.findThem,
            },
          }),
        )
        .with({ type: 'refused' }, ({ message }) => setRefusal({ message }))
        // The customer came back, or left otherwise, in the meantime: what the ledger holds now is read
        .with({ type: 'changed' }, () => {
          setRefusal(undefined)
          void queryClient.invalidateQueries({
            queryKey: removedKeyOf(customerId),
            exact: true,
          })
          void queryClient.invalidateQueries({
            queryKey: customerKeyOf(customerId),
            exact: true,
          })
        })
        .exhaustive(),
  })

  return (
    <RemovedRecord
      version={version}
      removal={removal}
      changer={changerNameOf(version.changedBy, {
        me: session.type === 'signedIn' ? session.user.id : '',
        customer: null,
      })}
      timezone={salon.timezone}
      historyHref={customerHistoryHrefOf(salon.id, customerId)}
      customerHref={(id) => customerHrefOf(salon.id, id)}
      refusal={refusal}
      pending={restoration.isPending}
      onRestore={() => restoration.mutate()}
    />
  )
}

type CustomerPageProps = {
  salon: ModelsSalonResponse
}

const CustomerPage = ({ salon }: CustomerPageProps) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const moved = useRef(false)
  const administers = useAdministersAccounts()

  return (
    <WithCustomer
      salon={salon}
      title={say(TITLE)}
      fresh={false}
      removed={(customerId) => (
        <>
          <RemovedCustomer
            salon={salon}
            customerId={customerId}
            title={say(TITLE)}
          >
            {({ version, removal }) => (
              <>
                <RemovedPart
                  key={`removed-${customerId}`}
                  salon={salon}
                  version={version}
                  removal={removal}
                  moved={moved}
                />
                <RemovedRequestsPart
                  key={`erasure-${customerId}`}
                  customerId={customerId}
                  name={customerNameOf(version)}
                  timezone={salon.timezone}
                />
              </>
            )}
          </RemovedCustomer>
          <HeadingAfterMove moved={moved} />
        </>
      )}
    >
      {(customer) => (
        <>
          <RecordPart
            key={`record-${customer.id}`}
            customer={customer}
            timezone={salon.timezone}
            changeHref={customerChangeHrefOf(salon.id, customer.id)}
            bookingHref={bookingOfCustomerHrefOf(
              salon.id,
              dayAt(new Date(), salon.timezone),
              customer.id,
            )}
            pointsHref={customerPointsHrefOf(salon.id, customer.id)}
            chartHref={chartHrefOf(salon.id, customer.id)}
            customerHref={(customerId) => customerHrefOf(salon.id, customerId)}
          />
          {/* Another customer (the one who referred this one) is another part */}
          <PreferencesPart
            key={`preferences-${customer.id}`}
            salon={salon}
            customer={customer}
          />
          <UsePart
            key={`use-${customer.id}`}
            salon={salon}
            customer={customer}
          />
          {administers && (
            <AccountPart key={`account-${customer.id}`} customer={customer} />
          )}
          <RequestsPart
            key={`requests-${customer.id}`}
            salon={salon}
            customer={customer}
            onLeft={() => showRemoved(queryClient, customer.id, moved)}
          />
          <KeepingPart
            key={`keeping-${customer.id}`}
            salon={salon}
            customer={customer}
            moved={moved}
          />
          <HeadingAfterMove moved={moved} />
        </>
      )}
    </WithCustomer>
  )
}

/**
 * A customer of the ledger: what the ledger keeps of them, what they want
 * the salons to keep in mind, and what they did at the salon of the
 * address. From here a booking of the customer is entered, and the ledger
 * is changed; an owner or a manager exports the data of the customer when
 * they ask for it, takes their request to have it erased and calls it off,
 * reads the history of the ledger, and removes the customer from it.
 *
 * A customer who was removed stays at the address for an owner or a
 * manager, as the ledger kept them, and can be brought back from there;
 * their request to have their data erased is shown, and called off while
 * it is pending.
 */
export const CustomerScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(TITLE)}>
      {(salon) => <CustomerPage key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
