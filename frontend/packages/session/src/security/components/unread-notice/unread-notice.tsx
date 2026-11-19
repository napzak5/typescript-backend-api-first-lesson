import { Alert, Button } from '@beauty-salon-frontend/ui'
import type { Unsent } from '../../security-api'
import { unreadMessageOf } from '../../security-flow'

export type UnreadNoticeProps = {
  /** What was to be read: 「アカウント」 */
  what: string
  reason: Unsent
  /** Asks the API again */
  onRetry: () => void
  /** The API is being asked again */
  retrying: boolean
}

/** Something of the screen could not be read: the person may ask again. */
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
