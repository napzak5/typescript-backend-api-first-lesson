import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSay } from '../../hooks/language'
import { classNames } from '../../utils/class-names'
import { type Tone, toneClass } from '../../utils/tone'
import { Button } from '../button/button'
import styles from './notifications.module.css'

export type Notification = {
  tone: Tone
  /**
   * What happened, as a sentence: 「予約を確定しました。」. It is said where
   * the notification is shown, in the language the page has then
   */
  message: LocalizedText
}

type Notifications = {
  /** What is shown now. `id` tells two notifications of the same text apart */
  current: (Notification & { id: number }) | null
  /** Shows a notification, in place of the one before */
  notify: (notification: Notification) => void
  dismiss: () => void
}

const NotificationContext = createContext<Notifications>({
  current: null,
  notify: () => undefined,
  dismiss: () => undefined,
})

export type NotificationProviderProps = {
  children: ReactNode
}

/**
 * Keeps the notification of an application: the result of the last thing the
 * user did. It stands at the root, above the routes, so a notification is
 * still there after the screen has changed. It stays until the user closes
 * it or the next one takes its place; nothing disappears by itself.
 */
export const NotificationProvider = ({
  children,
}: NotificationProviderProps) => {
  const [current, setCurrent] = useState<Notifications['current']>(null)
  const lastId = useRef(0)

  const notify = useCallback((notification: Notification): void => {
    lastId.current += 1
    setCurrent({ ...notification, id: lastId.current })
  }, [])
  const dismiss = useCallback((): void => {
    setCurrent(null)
  }, [])
  const notifications = useMemo(
    () => ({ current, notify, dismiss }),
    [current, notify, dismiss],
  )

  return (
    <NotificationContext value={notifications}>{children}</NotificationContext>
  )
}

/**
 * `notify({ tone: 'success', message: words.booked })` after something
 * was done, with a message of the catalogues. What went wrong with a form is said in the form, with
 * an `Alert`, not here.
 */
export const useNotifications = (): Pick<Notifications, 'notify' | 'dismiss'> =>
  useContext(NotificationContext)

/**
 * Where the notification is shown: `AppShell` has it at the top of the main
 * content. The status region is always there, also while it is empty, so
 * that assistive technology announces what is put into it.
 */
export const NotificationOutlet = () => {
  const say = useSay()
  const { current, dismiss } = useContext(NotificationContext)

  return (
    <div
      className={classNames(
        current !== null && styles['notification'],
        current !== null && toneClass[current.tone],
      )}
    >
      <p role='status'>
        {current !== null && (
          <span key={current.id}>{say(current.message)}</span>
        )}
      </p>
      {current !== null && (
        <Button size='small' onClick={dismiss}>
          {say(uiMessages.close)}
        </Button>
      )}
    </div>
  )
}
