import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type {
  ModelsSalonResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { staffLedgerHrefOf } from '../../navigation'
import { readStaffMember, staffKeyOf } from '../api/staff-api'
import { fullStaffNameOf, mayKeepStaffLedger } from '../utils/staff-format'

const { keepers, loading, names, notFound, words } = adminStaffMessages

/**
 * What an account is told that does not keep the staff ledger of the salon:
 * a manager or a member of the staff, or the owner of another salon. The
 * start leads to their own salon.
 */
export const StaffLedgerForbidden = () => {
  const say = useSay()

  return (
    <>
      <p>{say(keepers.forbidden)}</p>
      <ButtonLink href='/'>{say(keepers.toStart)}</ButtonLink>
    </>
  )
}

/**
 * Whether the signed-in account has a role that keeps a staff ledger: one
 * that has not is told so before the API is asked. The owner of another
 * salon is refused by the API.
 */
export const useKeepsStaffLedger = (): boolean => {
  const session = useSession()

  return session.type === 'signedIn' && mayKeepStaffLedger(session.user.role)
}

/** The account the session is of: the member it is linked to is the account's own. */
export const useSignedInUserId = (): string | undefined => {
  const session = useSession()

  return session.type === 'signedIn' ? session.user.id : undefined
}

type StaffNotFoundProps = { salon: ModelsSalonResponse }

/** What a screen of a member says when there is none to show. */
const StaffNotFound = ({ salon }: StaffNotFoundProps) => {
  const say = useSay()

  return (
    <>
      <PageHeader
        title={say(notFound.title)}
        description={say(notFound.description)}
      />
      <ButtonLink href={staffLedgerHrefOf(salon.id)}>
        {say(words.toLedger)}
      </ButtonLink>
    </>
  )
}

export type WithStaffMemberProps = {
  salon: ModelsSalonResponse
  /** The title of the screen, said in the language of the page */
  title: string
  /**
   * Whether the screen shows the member only once they were read anew: a
   * screen that writes them does, so that what it writes on is what the
   * ledger holds now. A screen that shows them shows what was read before
   * at once, and what is read anew when it comes.
   */
  fresh: boolean
  /** The screen, below its heading, for the member of the address that was read */
  children: (member: ModelsStaffResponse) => ReactNode
}

/**
 * A screen of a member of the staff ledger, below the salon of the
 * address. The member is read whenever the screen opens; one who was
 * removed is not found, as one who never was. Below the heading, the
 * member is named as the ledger keeps them.
 */
export const WithStaffMember = ({
  salon,
  title,
  fresh,
  children,
}: WithStaffMemberProps) => {
  const { staffId = '' } = useParams()
  const keeps = useKeepsStaffLedger()
  const say = useSay()
  const read = useQuery({
    queryKey: staffKeyOf(staffId),
    queryFn: () => readStaffMember(salon.id, staffId),
    enabled: keeps,
    // Another owner may write the member meanwhile: what is shown is read whenever the screen opens
    staleTime: 0,
    refetchOnReconnect: !fresh,
  })
  const shown = !fresh || read.isFetchedAfterMount ? read.data : undefined

  if (!keeps) {
    return (
      <>
        <PageHeader title={title} description={salon.name} />
        <StaffLedgerForbidden />
      </>
    )
  }

  return match(shown)
    .with(undefined, () => (
      <>
        <PageHeader title={title} description={salon.name} />
        <LoadingIndicator label={say(loading.member)} />
      </>
    ))
    .with({ type: 'found' }, ({ member }) => (
      <>
        <PageHeader title={title} description={salon.name} />
        <p>{say(fullStaffNameOf(member))}</p>
        {children(member)}
      </>
    ))
    .with({ type: 'notFound' }, () => <StaffNotFound salon={salon} />)
    .with({ type: 'forbidden' }, () => (
      <>
        <PageHeader title={title} description={salon.name} />
        <StaffLedgerForbidden />
      </>
    ))
    .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
      <>
        <PageHeader title={title} description={salon.name} />
        <UnreadNotice
          message={say(unreadMessageOf(names.member, reason))}
          onRetry={() => void read.refetch()}
          pending={read.isFetching}
        />
      </>
    ))
    .exhaustive()
}
