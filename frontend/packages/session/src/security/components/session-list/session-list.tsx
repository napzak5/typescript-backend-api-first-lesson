import type { ModelsSessionResponse } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  Badge,
  Button,
  DescriptionList,
  Note,
} from '@beauty-salon-frontend/ui'
import { useLayoutEffect, useRef } from 'react'
import type { More } from '../../security-flow'
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
 * here; this one signs out in the header. When the button below adds
 * devices to the list, the focus moves to the first of them; devices that
 * nobody asked for (a list that was read again) leave the focus where it is.
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
  const list = useRef<HTMLUListElement>(null)
  const shown = useRef(sessions.length)
  // Whether the button was pressed and what it asked for is yet to be shown
  const asked = useRef(false)

  // In the commit that shows the added sessions, before they are painted
  useLayoutEffect(() => {
    if (asked.current && sessions.length > shown.current) {
      list.current?.children
        .item(shown.current)
        ?.querySelector<HTMLHeadingElement>('h3')
        ?.focus()
      asked.current = false
    }
    shown.current = sessions.length
  }, [sessions.length])

  const askForMore = (): void => {
    asked.current = true
    onMore()
  }

  return (
    <div className={styles['list']}>
      <Note role='status'>{countOf(total, sessions.length)}</Note>
      <ul
        className={styles['sessions']}
        ref={list}
        aria-label='サインインしている端末'
      >
        {sessions.map((session) => {
          const name = sessionNameOf(session, timeZone)

          return (
            <li key={session.id} className={styles['session']}>
              <div className={styles['heading']}>
                <h3 className={styles['name']} tabIndex={-1}>
                  {name}
                </h3>
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
            </li>
          )
        })}
      </ul>
      {more === 'failed' && (
        <Alert tone='danger'>
          続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。
        </Alert>
      )}
      {more !== 'none' && (
        <Button onClick={askForMore} pending={more === 'loading'}>
          {more === 'failed' ? 'もう一度読み込む' : 'さらに表示'}
        </Button>
      )}
    </div>
  )
}
