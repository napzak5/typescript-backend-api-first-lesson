import type { ModelsSessionResponse } from '@beauty-salon-frontend/api-client'
import {
  Badge,
  Button,
  COUNTED,
  countOf,
  DescriptionList,
  type More,
  PagedList,
  useSay,
} from '@beauty-salon-frontend/ui'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  momentOf,
  sessionNameOf,
  signOutNameOf,
} from '../../utils/security-format'
import styles from './session-list.module.css'

/** The words of the devices: `sessions` is the list */
const { sessions: devices } = securityMessages

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
}: SessionListProps) => {
  const say = useSay()
  /** What the API kept of a session, or that it kept nothing: the User-Agent and the address, as they are */
  const recorded = (value: string | null): string =>
    value ?? say(devices.notRecorded)

  return (
    <PagedList
      items={sessions}
      itemKey={({ id }) => id}
      label={say(devices.title)}
      count={say(
        countOf(total, sessions.length, COUNTED.devices, devices.signedInOn),
      )}
      focus='item'
      more={more}
      onMore={onMore}
    >
      {(session) => (
        <>
          <div className={styles['heading']}>
            <h3 className={styles['name']}>
              {say(sessionNameOf(session, timeZone))}
            </h3>
            {session.current && (
              <Badge tone='info'>{say(devices.thisDevice)}</Badge>
            )}
          </div>
          <DescriptionList
            items={[
              {
                term: say(devices.browser),
                description: recorded(session.userAgent),
              },
              {
                term: say(devices.ipAddress),
                description: recorded(session.ipAddress),
              },
              {
                term: say(devices.lastUsed),
                description: say(momentOf(session.lastActivityAt, timeZone)),
              },
              {
                term: say(devices.expires),
                description: say(momentOf(session.refreshExpiresAt, timeZone)),
              },
            ]}
          />
          {!session.current && (
            <Button
              variant='danger'
              size='small'
              aria-label={say(signOutNameOf(session, timeZone))}
              pending={ending === session.id}
              onClick={() => onEnd(session)}
            >
              {say(devices.signOut)}
            </Button>
          )}
        </>
      )}
    </PagedList>
  )
}
