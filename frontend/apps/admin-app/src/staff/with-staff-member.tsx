import type {
  ModelsSalonResponse,
  ModelsStaffResponse,
} from '@beauty-salon-frontend/api-client'
import { unreadMessageOf } from '@beauty-salon-frontend/salon-screens'
import { useSession } from '@beauty-salon-frontend/session'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { staffLedgerHrefOf } from '../navigation'
import { readStaffMember, staffKeyOf } from './staff-api'
import { fullStaffNameOf, mayKeepStaffLedger } from './staff-format'

/**
 * What an account is told that does not keep the staff ledger of the salon:
 * a manager or a member of the staff, or the owner of another salon. The
 * start leads to their own salon.
 */
export const StaffLedgerForbidden = () => (
  <>
    <p>
      このサロンのスタッフ台帳は、扱えません。スタッフ台帳を扱えるのは、そのサロンのオーナーと、管理者です。
    </p>
    <p>
      <ButtonLink href='/' variant='secondary'>
        トップへ戻る
      </ButtonLink>
    </p>
  </>
)

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
const StaffNotFound = ({ salon }: StaffNotFoundProps) => (
  <>
    <PageHeader
      title='スタッフが見つかりません'
      description='アドレスが正しいか、お確かめください。台帳から削除したスタッフは、表示できません。'
    />
    <p>
      <ButtonLink href={staffLedgerHrefOf(salon.id)} variant='secondary'>
        スタッフ台帳へ
      </ButtonLink>
    </p>
  </>
)

export type WithStaffMemberProps = {
  salon: ModelsSalonResponse
  /** The title of the screen */
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
        <LoadingIndicator label='スタッフを読み込んでいます' />
      </>
    ))
    .with({ type: 'found' }, ({ member }) => (
      <>
        <PageHeader title={title} description={salon.name} />
        <p>{fullStaffNameOf(member)}</p>
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
    .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
      <>
        <PageHeader title={title} description={salon.name} />
        <UnreadNotice
          message={unreadMessageOf('スタッフ', reason)}
          onRetry={() => void read.refetch()}
          retrying={read.isFetching}
        />
      </>
    ))
    .exhaustive()
}
