import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  FAILED,
  firstCursor,
  listingOf,
  moreOf,
  unreadMessageOf,
  WithSalon,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  EmptyState,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { match } from 'ts-pattern'
import { staffEntryHrefOf, staffMemberHrefOf } from '../navigation'
import { StaffTable } from './components/staff-table/staff-table'
import { readStaffPage, STAFF_LISTS, type StaffPageRead } from './staff-api'
import { StaffLedgerForbidden, useKeepsStaffLedger } from './with-staff-member'

const TITLE = 'スタッフ'

type StaffListProps = { salon: ModelsSalonResponse }

/** Where the page after one begins: nowhere after a page that was not read. */
const cursorAfter = (page: StaffPageRead): string | undefined =>
  page.type === 'found' ? (page.nextCursor ?? undefined) : undefined

/**
 * The members of the staff ledger of the salon, in the order they were
 * registered in, the inactive among them. The way to register one is
 * offered once the ledger was read: an account the API refuses it to is
 * told so instead.
 */
const StaffList = ({ salon }: StaffListProps) => {
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
      title={TITLE}
      description={salon.name}
      actions={
        pages === undefined || forbidden ? undefined : (
          <ButtonLink href={staffEntryHrefOf(salon.id)} variant='primary'>
            スタッフを登録する
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
        .with(undefined, () => (
          <LoadingIndicator label='スタッフを読み込んでいます' />
        ))
        .with({ type: 'unread' }, ({ reason }) => (
          <UnreadNotice
            message={unreadMessageOf('スタッフ', reason)}
            onRetry={() => void read.refetch()}
            pending={read.isFetching}
          />
        ))
        .with({ type: 'listed', items: [] }, () => (
          <EmptyState
            title='スタッフはいません'
            description='サロンで働くスタッフを、台帳に登録してください。'
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

  return (
    <WithSalon salonId={salonId} title={TITLE}>
      {(salon) =>
        keeps ? (
          <StaffList key={salon.id} salon={salon} />
        ) : (
          <>
            <PageHeader title={TITLE} description={salon.name} />
            <StaffLedgerForbidden />
          </>
        )
      }
    </WithSalon>
  )
}
