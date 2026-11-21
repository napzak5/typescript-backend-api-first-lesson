import { Alert } from '../alert/alert'
import { Button } from '../button/button'

export type UnreadNoticeProps = {
  /** Why nothing was read, and what to do: 「メニューを読み込めませんでした。…」 */
  message: string
  /** Asks the API again */
  onRetry: () => void
  /** The API is being asked again */
  pending: boolean
}

/**
 * Something of a screen could not be read: an alert that says so, and the
 * button that reads it again. The screen around it says what was not read
 * and why.
 */
export const UnreadNotice = ({
  message,
  onRetry,
  pending,
}: UnreadNoticeProps) => (
  <>
    <Alert tone='danger'>{message}</Alert>
    <Button onClick={onRetry} pending={pending}>
      もう一度読み込む
    </Button>
  </>
)
