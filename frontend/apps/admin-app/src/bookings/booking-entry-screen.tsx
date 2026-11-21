import {
  cursorAfter,
  firstCursor,
  listingOf,
  unreadMessageOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsCustomerResponse,
  ModelsSalonResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  dayAt,
  KeywordSearch,
  keywordOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  Alert,
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { CustomerChoices } from '../customers/components/customer-choices/customer-choices'
import {
  CUSTOMER_LISTS,
  customerKeyOf,
  findCustomers,
  readCustomer,
} from '../customers/customers-api'
import {
  bookingHrefOf,
  bookingsHrefOf,
  customerEntryHrefOf,
} from '../navigation'
import {
  readServices,
  readStaffProfiles,
  servicesKeyOf,
  staffProfilesKeyOf,
} from '../salons/salons-api'
import {
  afterEntry,
  checkedSaysOf,
  type EntryChoice,
  entryChoiceIn,
  entryQueryOf,
  type FormSays,
  readEntry,
  readLines,
} from './booking-entry'
import {
  type BookingRead,
  bookingKeyOf,
  bookingListsKeyOf,
  checkLine,
  createBooking,
  type LineCheck,
} from './bookings-api'
import { BookingEntryForm } from './components/booking-entry-form/booking-entry-form'
import { ChosenCustomer } from './components/chosen-customer/chosen-customer'

const TITLE = '予約を入れる'

const UNREAD = P.union('tooManyRequests', 'failed')

const NOTHING_SAID: FormSays = { message: undefined, errors: {} }

/** The address of the screen with another choice in it. */
const hrefOf = (choice: EntryChoice): string =>
  `?${entryQueryOf(choice).toString()}`

type CustomerResultsProps = {
  choice: EntryChoice
  keyword: string
  /** The address of the screen that registers a customer */
  entryHref: string
}

/** The customers of the ledger that have the keyword, to choose from. */
const CustomerResults = ({
  choice,
  keyword,
  entryHref,
}: CustomerResultsProps) => {
  const found = useInfiniteQuery({
    queryKey: [...CUSTOMER_LISTS, 'search', keyword],
    queryFn: ({ pageParam }) => findCustomers(keyword, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Customers are registered at every salon of the platform
    staleTime: 0,
  })

  return match(
    found.data === undefined ? undefined : listingOf(found.data.pages),
  )
    .with(undefined, () => <LoadingIndicator label='お客様を探しています' />)
    .with({ type: 'unread' }, ({ reason }) => (
      <UnreadNotice
        message={unreadMessageOf('お客様', reason)}
        onRetry={() => void found.refetch()}
        pending={found.isFetching}
      />
    ))
    .with({ type: 'listed', items: [] }, () => (
      <EmptyState
        title='キーワードに合うお客様が見つかりませんでした'
        description='キーワードを変えて、もう一度お探しください。台帳にないお客様は、先に台帳に登録してください。登録したお客様の台帳から、予約を入れられます。'
        actions={<ButtonLink href={entryHref}>お客様を登録する</ButtonLink>}
      />
    ))
    .with({ type: 'listed' }, ({ items, total, rest }) => (
      <CustomerChoices
        customers={items}
        total={total}
        more={moreOf(rest, {
          nextPage: found.isFetchingNextPage,
          again: found.isRefetching,
        })}
        onMore={() =>
          void (rest === 'unread' ? found.refetch() : found.fetchNextPage())
        }
        choose={{
          type: 'link',
          hrefOf: ({ id }) => hrefOf({ ...choice, customerId: id }),
          excluded: undefined,
        }}
      />
    ))
    .exhaustive()
}

type StepProps = {
  salon: ModelsSalonResponse
  choice: EntryChoice
}

/**
 * The first step: the customer the booking is for, found by a keyword.
 * Each search is a place to come back to, and so is the choice: the way
 * back from the form leads to the customers that were found.
 */
const CustomerStep = ({ salon, choice }: StepProps) => {
  const [, setQuery] = useSearchParams()
  const queryClient = useQueryClient()

  const search = (values: FormData): void => {
    const asked = keywordOf(values)
    if (asked !== undefined && asked === choice.search) {
      // The same search again: whoever sends it wants what there is now
      void queryClient.invalidateQueries({
        queryKey: [...CUSTOMER_LISTS, 'search', asked],
      })
      return
    }
    setQuery(entryQueryOf({ ...choice, search: asked }))
  }

  return (
    <>
      <KeywordSearch
        label='お客様を探す'
        description='お名前（カナでも）、メールアドレス、電話番号の一部。台帳のお客様から、予約を入れる方を探します。'
        keyword={choice.search}
        clearHref={hrefOf({ ...choice, search: undefined })}
        onSubmit={search}
      />
      {choice.search !== undefined && (
        <CustomerResults
          // The customers of another search are another list
          key={choice.search}
          choice={choice}
          keyword={choice.search}
          entryHref={customerEntryHrefOf(salon.id)}
        />
      )}
    </>
  )
}

type EntryProps = StepProps & {
  customer: ModelsCustomerResponse
  staff: readonly ModelsStaffProfileResponse[]
  services: readonly ModelsServiceResponse[]
}

/**
 * The form of the booking, for the customer that was chosen. What it
 * created is what the page of the booking shows at once; the lists of the
 * days were read before it, and are dropped.
 *
 * The members of the lines can be checked before the booking is sent, and
 * are checked when the API refused it because one of them is taken: the
 * API does not say which.
 */
const Entry = ({ salon, choice, customer, staff, services }: EntryProps) => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { notify } = useNotifications()
  const [said, setSaid] = useState<FormSays>(NOTHING_SAID)
  const checks = useMutation({
    mutationFn: (lines: Parameters<typeof checkLine>[1][]) =>
      Promise.all(lines.map((line) => checkLine(salon.id, line))),
  })
  const create = useMutation({ mutationFn: createBooking })
  const shownChecks: readonly LineCheck[] | undefined = checks.data

  const check = (values: FormData): void => {
    const lines = readLines(values, salon.timezone)
    if (lines.type === 'invalid') {
      setSaid({ message: undefined, errors: lines.errors })
      checks.reset()
      return
    }
    setSaid(NOTHING_SAID)
    checks.mutate(lines.request.services)
  }

  const submit = (values: FormData): void => {
    const entry = readEntry(values, {
      salonId: salon.id,
      customerId: customer.id,
      timezone: salon.timezone,
    })
    if (entry.type === 'invalid') {
      setSaid({ message: undefined, errors: entry.errors })
      return
    }
    setSaid(NOTHING_SAID)
    create.mutate(entry.request, {
      onSuccess: (outcome) => {
        if (outcome.type === 'created') {
          const read: BookingRead = { type: 'found', booking: outcome.booking }
          queryClient.setQueryData(bookingKeyOf(outcome.booking.id), read)
          queryClient.removeQueries({ queryKey: bookingListsKeyOf(salon.id) })
          notify({ tone: 'success', message: '予約を入れました。' })
          void navigate(bookingHrefOf(salon.id, outcome.booking.id))
          return
        }
        setSaid(afterEntry(outcome))
        if (outcome.type === 'conflict') {
          checks.mutate(entry.request.services)
        }
      },
    })
  }

  return (
    <>
      <ChosenCustomer
        customer={customer}
        againHref={hrefOf({ ...choice, customerId: undefined })}
      />
      <BookingEntryForm
        staff={staff}
        services={services}
        date={choice.date}
        timezone={salon.timezone}
        message={said.message}
        errors={said.errors}
        pending={create.isPending}
        checks={shownChecks}
        checking={checks.isPending}
        checked={
          shownChecks === undefined ? undefined : checkedSaysOf(shownChecks)
        }
        onCheck={check}
        onLinesChange={() => checks.reset()}
        onSubmit={submit}
        actions={
          <ButtonLink
            href={`${bookingsHrefOf(salon.id)}?date=${choice.date}`}
            variant='quiet'
          >
            やめる
          </ButtonLink>
        }
      />
    </>
  )
}

/**
 * The second step: the customer of the address, and what the form offers
 * (the staff and the services of the salon), read as one. The form opens
 * when all of them are there, and nothing is read behind it.
 */
const EntryStep = ({
  salon,
  choice,
  customerId,
}: StepProps & { customerId: string }) => {
  const customer = useQuery({
    queryKey: customerKeyOf(customerId),
    queryFn: () => readCustomer(customerId),
    refetchOnReconnect: false,
  })
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
    refetchOnReconnect: false,
  })
  const services = useQuery({
    queryKey: servicesKeyOf(salon.id),
    queryFn: () => readServices(salon.id),
    refetchOnReconnect: false,
  })
  const againHref = hrefOf({ ...choice, customerId: undefined })

  return match([customer.data, staff.data, services.data])
    .with(
      [undefined, P._, P._],
      [P._, undefined, P._],
      [P._, P._, undefined],
      () => <LoadingIndicator label='お客様とメニューを読み込んでいます' />,
    )
    .with([{ type: 'notFound' }, P._, P._], () => (
      <>
        <Alert tone='warning'>
          お客様が見つかりません。台帳から削除されたか、アドレスが正しくありません。
        </Alert>
        <ButtonLink href={againHref}>お客様を選び直す</ButtonLink>
      </>
    ))
    .with(
      [{ type: 'found' }, { type: 'found' }, { type: 'found' }],
      ([ofCustomer, ofStaff, ofServices]) =>
        ofStaff.items.length === 0 || ofServices.items.length === 0 ? (
          <EmptyState
            title='予約を入れられません'
            description='このサロンには、表示しているスタッフかメニューがありません。スタッフとメニューを登録すると、予約を入れられるようになります。'
          />
        ) : (
          <Entry
            salon={salon}
            choice={choice}
            customer={ofCustomer.customer}
            staff={ofStaff.items}
            services={ofServices.items}
          />
        ),
    )
    .with(
      [{ type: UNREAD }, P._, P._],
      [P._, { type: UNREAD }, P._],
      [P._, P._, { type: P.union(UNREAD, 'notFound') }],
      (reads) => (
        <UnreadNotice
          message={unreadMessageOf('お客様とメニュー', whyUnread(reads))}
          onRetry={() => {
            void customer.refetch()
            void staff.refetch()
            void services.refetch()
          }}
          pending={
            customer.isFetching || staff.isFetching || services.isFetching
          }
        />
      ),
    )
    .exhaustive()
}

/**
 * The screen of the salon that puts a booking into its ledger, in two
 * steps of the address: the customer, then the booking. A step that takes
 * the place of the other one took the link that was followed with it: the
 * focus goes to the heading of the screen.
 */
const BookingEntry = ({ salon }: { salon: ModelsSalonResponse }) => {
  const [query] = useSearchParams()
  const choice = entryChoiceIn(query, dayAt(new Date(), salon.timezone))
  const focusHeading = useScreenHeadingFocus()
  const stepBefore = useRef(choice.customerId)

  useLayoutEffect(() => {
    if (stepBefore.current !== choice.customerId) {
      focusHeading()
    }
    stepBefore.current = choice.customerId
  }, [choice.customerId, focusHeading])

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {choice.customerId === undefined ? (
        <CustomerStep salon={salon} choice={choice} />
      ) : (
        <EntryStep
          // The form of another customer is another form
          key={choice.customerId}
          salon={salon}
          choice={choice}
          customerId={choice.customerId}
        />
      )}
    </>
  )
}

/** Puts a booking into the ledger of the salon of the address. */
export const BookingEntryScreen = () => {
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <BookingEntry key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
