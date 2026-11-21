import type { ModelsSessionResponse } from '@beauty-salon-frontend/api-client'
import {
  Badge,
  Button,
  DescriptionList,
  type More,
  PagedList,
} from '@beauty-salon-frontend/ui'
import {
  addressOf,
  browserOf,
  countOf,
  momentOf,
  sessionNameOf,
} from '../../security-format'
import styles from './session-list.module.css'

export type SessionListProps = {
  /** The sessions that were read so far, the latest first; at least one, that of this device */
  sessions: readonly ModelsSessionResponse[]
  /** How many sessions the account has; `null` when the API did not count them */
  total: number | null
  /**
   * What comes after the sessions: nothing (`none`), a page that can be
   * asked for (`available`), one that is on its way (`loading`), or one
   * that was asked for and did not come (`failed`)
   */
  more: More
  /** Asks for the sessions that come next */
  onMore: () => void
  /** The session whose end is on its way */
  ending?: string | undefined
  /** The button that ends a session was pressed */
  onEnd: (session: ModelsSessionResponse) => void
  /** The time zone of whoever reads: the moments are said in it */
  timeZone: string
}

/**
 * The devices the account is signed in on: for each, when it signed in,
 * the browser and the address the API kept, when it was used last and when
 * its sign-in runs out. Every device but this one can be signed out from
 * here; this one signs out in the header. A device that 「さらに表示」 added
 * takes the focus itself, so that it is read from its name.
 */
export const SessionList = ({
  sessions,
  total,
  more,
  onMore,
  ending,
  onEnd,
  timeZone,
}: SessionListProps) => (
  <PagedList
    items={sessions}
    itemKey={({ id }) => id}
    label='サインインしている端末'
    count={countOf(total, sessions.length)}
    focus='item'
    more={more}
    onMore={onMore}
  >
    {(session) => {
      const name = sessionNameOf(session, timeZone)

      return (
        <>
          <div className={styles['heading']}>
            <h3 className={styles['name']}>{name}</h3>
            {session.current && <Badge tone='info'>この端末</Badge>}
          </div>
          <DescriptionList
            items={[
              { term: 'ブラウザー', description: browserOf(session) },
              { term: 'IP アドレス', description: addressOf(session) },
              {
                term: '最後に使われた日時',
                description: momentOf(session.lastActivityAt, timeZone),
              },
              {
                term: 'サインインが切れる日時',
                description: momentOf(session.refreshExpiresAt, timeZone),
              },
            ]}
          />
          {!session.current && (
            <Button
              variant='danger'
              size='small'
              aria-label={`${name}をサインアウトさせる`}
              pending={ending === session.id}
              onClick={() => onEnd(session)}
            >
              サインアウトさせる
            </Button>
          )}
        </>
      )
    }}
  </PagedList>
)
