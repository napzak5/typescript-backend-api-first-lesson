import {
  cursorAfter,
  FAILED,
  firstCursor,
  listingOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/answers'
import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import { WithSalon } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  moreOf,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import { staffEntryHrefOf, staffMemberHrefOf } from '../../navigation'
import { readStaffPage, STAFF_LISTS } from '../api/staff-api'
import { StaffTable } from '../components/staff-table/staff-table'
import { StaffLedgerForbidden, useKeepsStaffLedger } from './with-staff-member'

const { ledger, loading, names, titles } = adminStaffMessages

type StaffListProps = { salon: ModelsSalonResponse }

/**
 * The members of the staff ledger of the salon, in the order they were
 * registered in, the inactive among them. The way to register one is
 * offered once the ledger was read: an account the API refuses it to is
 * told so instead.
 */
const StaffList = ({ salon }: StaffListProps) => {
  const say = useSay()
  const read = useInfiniteQuery({
    queryKey: [...STAFF_LISTS, salon.id],
    queryFn: ({ pageParam }) => readStaffPage(salon.id, pageParam),
    initialPageParam: firstCursor(),
    getNextPageParam: cursorAfter,
    // Another owner may register a member meanwhile: the list is read whenever it is shown
    staleTime: 0,
  })
  const pages = read.data?.pages
  const forbidden = pages?.[0]?.type === 'forbidden'
  const header = (
    <PageHeader
      title={say(titles.ledger)}
      description={salon.name}
      actions={
        pages === undefined || forbidden ? undefined : (
          <ButtonLink href={staffEntryHrefOf(salon.id)} variant='primary'>
            {say(ledger.register)}
          </ButtonLink>
        )
      }
    />
  )

  if (forbidden) {
    return (
      <>
        {header}
        <StaffLedgerForbidden />
      </>
    )
  }

  return (
    <>
      {header}
      {match(
        pages === undefined
          ? undefined
          : // A later page the API refused is one that was not read
            listingOf(
              pages.map((page) => (page.type === 'forbidden' ? FAILED : page)),
            ),
      )
        .with(undefined, () => <LoadingIndicator label={say(loading.staff)} />)
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={say(unreadMessageOf(names.staff, reason))}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState
            title={say(ledger.none)}
            description={say(ledger.noneDescription)}
          />
        ))
        .with({ type: 'listed' }, ({ items, total, rest }) => (
          <StaffTable
            rows={items}
            total={total}
            more={moreOf(rest, {
              nextPage: read.isFetchingNextPage,
              again: read.isRefetching,
            })}
            onMore={() =>
              void (rest === 'unread' ? read.refetch() : read.fetchNextPage())
            }
            memberHref={(id) => staffMemberHrefOf(salon.id, id)}
          />
        ))
        .exhaustive()}
    </>
  )
}

/** The staff ledger of the salon of the address, for its owner and an administrator. */
export const StaffLedgerScreen = () => {
  const { salonId = '' } = useParams()
  const keeps = useKeepsStaffLedger()
  const say = useSay()

  return (
    <WithSalon salonId={salonId} title={say(titles.ledger)}>
      {(salon) =>
        keeps ? (
          <StaffList key={salon.id} salon={salon} />
        ) : (
          <>
            <PageHeader title={say(titles.ledger)} description={salon.name} />
            <StaffLedgerForbidden />
          </>
        )
      }
    </WithSalon>
  )
}
