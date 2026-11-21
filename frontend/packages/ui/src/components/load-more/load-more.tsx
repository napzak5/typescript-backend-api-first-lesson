import { useLayoutEffect, useRef } from 'react'
import { Alert } from '../alert/alert'
import { Button } from '../button/button'

/**
 * What comes after the items of a list that is read a page at a time:
 * nothing (`none`), a page that can be asked for (`available`), one that is
 * on its way (`loading`), or one that was asked for and did not come
 * (`failed`).
 */
export type More = 'none' | 'available' | 'loading' | 'failed'

/**
 * What comes after the items of a list, for the component that shows them.
 * A page that was not read is asked for again by reading the list again,
 * so it is on its way while the list is.
 */
export const moreOf = (
  rest: 'none' | 'more' | 'unread',
  fetching: { nextPage: boolean; again: boolean },
): More => {
  if (rest === 'none') {
    return 'none'
  }
  if (fetching.nextPage || (rest === 'unread' && fetching.again)) {
    return 'loading'
  }

  return rest === 'unread' ? 'failed' : 'available'
}

export type LoadMoreProps = {
  more: More
  /** Asks for the items that come next */
  onMore: () => void
}

/**
 * Below a list that is read a page at a time: the button that asks for the
 * next page, and why it did not come when it did not.
 */
export const LoadMore = ({ more, onMore }: LoadMoreProps) => (
  <>
    {more === 'failed' && (
      <Alert tone='danger'>
        続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。
      </Alert>
    )}
    {more !== 'none' && (
      <Button onClick={onMore} pending={more === 'loading'}>
        {more === 'failed' ? 'もう一度読み込む' : 'さらに表示'}
      </Button>
    )}
  </>
)

/**
 * Moves the focus into the first of the items that the button of
 * `LoadMore` added, in the commit that shows them, before they are
 * painted: whoever pressed 「さらに表示」 goes on reading where the new
 * ones begin. Items that nobody asked for (those of a list that was read
 * again) leave the focus where it is. `focusAdded` is given the index of
 * the first added item; what is returned is called before the next page is
 * asked for.
 */
export const useFocusOnMore = (
  count: number,
  focusAdded: (index: number) => void,
): (() => void) => {
  const shown = useRef(count)
  // Whether the button was pressed and what it asked for is yet to be shown
  const asked = useRef(false)

  useLayoutEffect(() => {
    if (asked.current && count > shown.current) {
      focusAdded(shown.current)
      asked.current = false
    }
    shown.current = count
  }, [count, focusAdded])

  return () => {
    asked.current = true
  }
}
