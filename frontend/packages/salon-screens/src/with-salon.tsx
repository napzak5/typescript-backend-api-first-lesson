import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  ButtonLink,
  LoadingIndicator,
  PageHeader,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'
import { unreadMessageOf } from './reading'
import { readSalon, salonKeyOf } from './salons-api'

export type WithSalonProps = {
  salonId: string
  /** The title of the screen, when the salon could not be read */
  title: string
  /** The screen, for the salon that was read */
  children: (salon: ModelsSalonResponse) => ReactNode
}

/**
 * A screen of a salon. The salon says what the screen is of (its name), when
 * its times are (its time zone) and what its amounts are in (its currency),
 * so nothing of the screen is shown before it is read.
 *
 * While it is read, the screen is not there yet and has no heading: the
 * heading the screen then shows is a heading of another screen, and takes
 * the focus. A heading of the same title shown here first would be drawn
 * anew by the screen, and the focus it had would be lost.
 */
export const WithSalon = ({ salonId, title, children }: WithSalonProps) => {
  const read = useQuery({
    queryKey: salonKeyOf(salonId),
    queryFn: () => readSalon(salonId),
  })

  return match(read.data)
    .with(undefined, () => (
      <LoadingIndicator label='サロンを読み込んでいます' />
    ))
    .with({ type: 'found' }, ({ salon }) => children(salon))
    .with({ type: 'notFound' }, () => (
      <>
        <PageHeader
          title='サロンが見つかりません'
          description='アドレスが正しいか、お確かめください。削除されたサロンは、表示できません。'
        />
        <p>
          <ButtonLink href='/' variant='secondary'>
            トップへ戻る
          </ButtonLink>
        </p>
      </>
    ))
    .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
      <>
        <PageHeader title={title} />
        <UnreadNotice
          message={unreadMessageOf('サロン', reason)}
          onRetry={() => void read.refetch()}
          retrying={read.isFetching}
        />
      </>
    ))
    .exhaustive()
}

export type OtherSalonNoticeProps = {
  /** What is not theirs to see: 「売上」 */
  what?: string
  /** Who may see it */
  who?: string
  /** Where the start of the application leads a member: 「予約」 */
  start?: string
}

/**
 * What a member of the staff of another salon is told: the API shows what
 * is kept of a salon (its bookings, its sales) to its own staff. The start
 * leads to their own salon.
 */
export const OtherSalonNotice = ({
  what = '予約',
  who = 'そのサロンのスタッフと、管理者',
  start = '予約',
}: OtherSalonNoticeProps) => (
  <>
    <p>{`このサロンの${what}は、見られません。${what}を見られるのは、${who}です。`}</p>
    <p>
      <ButtonLink href='/' variant='secondary'>
        {`自分のサロンの${start}へ`}
      </ButtonLink>
    </p>
  </>
)
