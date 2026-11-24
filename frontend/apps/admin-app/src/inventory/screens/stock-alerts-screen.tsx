import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  UNREAD_TYPES,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type {
  ModelsInventoryAlertResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  OtherSalonNotice,
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
  useSay,
  useScreenHeadingFocus,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { match, P } from 'ts-pattern'
import {
  inventoryHrefOf,
  stockAlertsHrefOf,
  stockRowHrefOf,
} from '../../navigation'
import {
  readStaffProfiles,
  staffProfilesKeyOf,
} from '../../salons/api/salons-api'
import {
  acknowledgeAlert,
  alertSummaryKeyOf,
  alertsKeyOf,
  readAlertPage,
  readAlertSummary,
} from '../api/alerts-api'
import { AlertDialog } from '../components/alert-dialog/alert-dialog'
import { AlertFilter } from '../components/alert-filter/alert-filter'
import { AlertSummary } from '../components/alert-summary/alert-summary'
import { AlertTable } from '../components/alert-table/alert-table'
import {
  acknowledgementOf,
  afterAcknowledgement,
} from '../utils/alert-acknowledgement'
import {
  alertConditionsIn,
  alertQueryOf,
  isNarrowedAlerts,
  readAlertConditions,
} from '../utils/alert-search'

const { alerts: words, names, titles } = adminInventoryMessages
const { list } = words

/** An alert to be seen to, with the notes of the dialog */
type Seen = { alert: ModelsInventoryAlertResponse; values: FormData }

/**
 * The alerts of the stock of a salon, worked out by the API whenever they
 * are read: how many there are, then each, those of the conditions of the
 * address. An alert nobody saw to is acknowledged in a dialog; the alerts
 * are read again before it closes, as they are then.
 */
const AlertsPart = ({ salon }: { salon: ModelsSalonResponse }) => {
  const say = useSay()
  const queryClient = useQueryClient()
  const { notify } = useNotifications()
  const focusHeading = useScreenHeadingFocus()
  const [query, setQuery] = useSearchParams()
  const conditions = alertConditionsIn(query)
  const asked = alertQueryOf(conditions).toString()
  const narrowed = isNarrowedAlerts(conditions)
  const summary = useQuery({
    queryKey: alertSummaryKeyOf(salon.id),
    queryFn: () => readAlertSummary(salon.id),
    staleTime: 0,
  })
  const read = useInfiniteQuery({
    queryKey: [...alertsKeyOf(salon.id), 'list', asked],
    queryFn: ({ pageParam }) => readAlertPage(salon.id, conditions, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    staleTime: 0,
  })
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })
  /** The alert the dialog sees to */
  const [seeing, setSeeing] = useState<ModelsInventoryAlertResponse>()
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<LocalizedText>()
  /** What changed meanwhile: said under the heading */
  const [refusal, setRefusal] = useState<LocalizedText>()
  /** How many times the dialog closed on what it changed: the heading takes the focus each time */
  const [moves, setMoves] = useState(0)

  useLayoutEffect(() => {
    if (moves > 0) {
      focusHeading()
    }
  }, [moves, focusHeading])

  const acknowledgement = useMutation({
    mutationFn: ({ alert, values }: Seen) =>
      acknowledgeAlert(acknowledgementOf(alert, values)),
    onMutate: () => setMessage(undefined),
    onSuccess: (outcome, { alert }) =>
      match(afterAcknowledgement(outcome, alert))
        .with({ type: 'again' }, ({ message: said }) => setMessage(said))
        .with({ type: P.union('done', 'refused') }, async (says) => {
          // The alerts are read as they are now before the dialog closes on them
          await queryClient.invalidateQueries({
            queryKey: alertsKeyOf(salon.id),
          })
          setSeeing(undefined)
          setMoves((count) => count + 1)
          match(says)
            .with({ type: 'done' }, ({ message: said }) => {
              setRefusal(undefined)
              notify({ tone: 'success', message: said })
            })
            .with({ type: 'refused' }, ({ message: said }) => setRefusal(said))
            .exhaustive()
        })
        .exhaustive(),
  })

  const filter = (values: FormData): void => {
    const next = alertQueryOf(readAlertConditions(values))
    if (next.toString() === asked) {
      // The same alerts again: whoever sends it wants what there is now
      void queryClient.invalidateQueries({ queryKey: alertsKeyOf(salon.id) })
      return
    }
    setQuery(next, { replace: true })
  }

  const pages = read.data?.pages ?? []
  if (pages[0]?.type === 'forbidden') {
    return (
      <>
        <PageHeader title={say(titles.alerts)} description={salon.name} />
        <OtherSalonNotice what={names.inventoryOfTheSalon} />
      </>
    )
  }

  return (
    <>
      <PageHeader title={say(titles.alerts)} description={salon.name} />
      {refusal !== undefined && <Alert tone='warning'>{say(refusal)}</Alert>}
      <p>{say(words.about)}</p>
      {match(summary.data)
        .with(undefined, () => (
          <LoadingIndicator label={say(words.summary.loading)} />
        ))
        .with({ type: 'found' }, ({ summary: counted }) => (
          <AlertSummary summary={counted} />
        ))
        // The list says that the account reads no alerts of the salon
        .with({ type: 'forbidden' }, () => null)
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.alertCount, reason))}
            onRetry={() => void summary.refetch()}
            pending={summary.isFetching}
          />
        ))
        .exhaustive()}
      <AlertFilter
        conditions={conditions}
        clearHref={narrowed ? stockAlertsHrefOf(salon.id) : undefined}
        onSubmit={filter}
      />
      {match(
        read.data === undefined
          ? undefined
          : listingOf(
              // A page after the first is refused only when the account
              // moved meanwhile: it ends the list there
              pages.map((page) => (page.type === 'forbidden' ? FAILED : page)),
            ),
      )
        .with(undefined, () => <LoadingIndicator label={say(list.loading)} />)
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.alerts, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title={say(list.noneMatch)}
              description={say(list.noneMatchDescription)}
            />
          ) : (
            <EmptyState
              title={say(list.empty)}
              description={say(list.emptyDescription)}
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <AlertTable
            // Other conditions are another list
            key={asked}
            caption={narrowed ? list.narrowedCaption : list.caption}
            alerts={items}
            staff={match(staff.data)
              .with({ type: 'found' }, ({ items: members }) => members)
              .otherwise(() => undefined)}
            timezone={salon.timezone}
            rowHref={(inventoryId) => stockRowHrefOf(salon.id, inventoryId)}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
            onAcknowledge={(alert) => {
              setMessage(undefined)
              setSeeing(alert)
            }}
          />
        ))
        .exhaustive()}
      <ButtonLink href={inventoryHrefOf(salon.id)}>
        {say(list.toInventory)}
      </ButtonLink>
      <AlertDialog
        alert={seeing}
        onClose={() => setSeeing(undefined)}
        message={message}
        pending={acknowledgement.isPending}
        onSubmit={(values) => {
          if (seeing !== undefined) {
            acknowledgement.mutate({ alert: seeing, values })
          }
        }}
      />
    </>
  )
}

/** The alerts of the stock of the salon of the address, for every member of its staff and an administrator. */
export const StockAlertsScreen = () => {
  const say = useSay()
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={say(titles.alerts)}>
      {(salon) => <AlertsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
