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
  inJapanese,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  useNotifications,
  useScreenHeadingFocus,
  writtenInJapanese,
} from '@beauty-salon-frontend/ui'
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

const TITLE = '在庫のアラート'

/** An alert to be seen to, with the notes of the dialog */
type Seen = { alert: ModelsInventoryAlertResponse; values: FormData }

/**
 * The alerts of the stock of a salon, worked out by the API whenever they
 * are read: how many there are, then each, those of the conditions of the
 * address. An alert nobody saw to is acknowledged in a dialog; the alerts
 * are read again before it closes, as they are then.
 */
const AlertsPart = ({ salon }: { salon: ModelsSalonResponse }) => {
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
    getNextPageParam: (page) =>
      page.type === 'forbidden' ? undefined : cursorAfter(page),
    staleTime: 0,
  })
  const staff = useQuery({
    queryKey: staffProfilesKeyOf(salon.id),
    queryFn: () => readStaffProfiles(salon.id),
  })
  /** The alert the dialog sees to */
  const [seeing, setSeeing] = useState<ModelsInventoryAlertResponse>()
  /** What went wrong with an attempt that can be made again: said in the dialog */
  const [message, setMessage] = useState<string>()
  /** What changed meanwhile: said under the heading */
  const [refusal, setRefusal] = useState<string>()
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
        <PageHeader title={TITLE} description={salon.name} />
        <OtherSalonNotice what='在庫' />
      </>
    )
  }

  return (
    <>
      <PageHeader title={TITLE} description={salon.name} />
      {refusal !== undefined && <Alert tone='warning'>{refusal}</Alert>}
      <p>
        在庫僅少と在庫過剰は、商品のすべての在庫の行を合わせた在庫数を、最低在庫数と最大在庫数に比べて出ます。期限切れ間近（使用期限まで
        30 日以内）と期限切れは、在庫の行ごとに出ます。
      </p>
      {match(summary.data)
        .with(undefined, () => (
          <LoadingIndicator label='アラートの件数を読み込んでいます' />
        ))
        .with({ type: 'found' }, ({ summary: counted }) => (
          <AlertSummary summary={counted} />
        ))
        // The list says that the account reads no alerts of the salon
        .with({ type: 'forbidden' }, () => null)
        .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
          <UnreadNotice
            message={inJapanese(
              unreadMessageOf(writtenInJapanese('アラートの件数'), reason),
            )}
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
        .with(undefined, () => (
          <LoadingIndicator label='在庫のアラートを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={inJapanese(
              unreadMessageOf(writtenInJapanese('在庫のアラート'), reason),
            )}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () =>
          narrowed ? (
            <EmptyState
              title='条件に合う在庫のアラートはありません'
              description='条件を変えて、見直してください。'
            />
          ) : (
            <EmptyState
              title='在庫のアラートはありません'
              description='在庫数が最低在庫数以下か最大在庫数より多くなった商品と、使用期限が近いか過ぎた在庫の行が、ここに出ます。'
            />
          ),
        )
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <AlertTable
            // Other conditions are another list
            key={asked}
            caption={narrowed ? '条件に合う在庫のアラート' : TITLE}
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
      <ButtonLink href={inventoryHrefOf(salon.id)}>在庫へ</ButtonLink>
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
  const { salonId = '' } = useParams()

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) => <AlertsPart key={salon.id} salon={salon} />}
    </WithSalon>
  )
}
