import { Alert, Button } from '@beauty-salon-frontend/ui'
import { unreadMessageOf } from './pages'
import type { NotFound, Unread } from './salons-api'

type UnreadNoticeProps = {
  /** What was to be read: 「メニュー」 */
  what: string
  reason: Unread | NotFound
  /** Asks the API again */
  onRetry: () => void
  /** The API is being asked again */
  retrying: boolean
}

/** Something of a screen could not be read: the visitor may ask again. */
export const UnreadNotice = ({
  what,
  reason,
  onRetry,
  retrying,
}: UnreadNoticeProps) => (
  <>
    <Alert tone='danger'>{unreadMessageOf(what, reason)}</Alert>
    <p>
      <Button onClick={onRetry} pending={retrying}>
        もう一度読み込む
      </Button>
    </p>
  </>
)
