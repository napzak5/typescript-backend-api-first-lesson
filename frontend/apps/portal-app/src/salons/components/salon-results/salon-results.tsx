import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  Button,
  Link,
  Note,
  Rating,
  TagList,
} from '@beauty-salon-frontend/ui'
import { useId, useLayoutEffect, useRef } from 'react'
import type { More } from '../../pages'
import { addressOf } from '../../salon-format'
import styles from './salon-results.module.css'

export type SalonResultsProps = {
  /** The salons that were read so far, in the order of the API; at least one */
  salons: readonly ModelsSalonResponse[]
  /** How many salons meet the conditions; `null` when the API did not count them */
  total: number | null
  /**
   * What comes after the salons: nothing (`none`), a page that can be asked
   * for (`available`), one that is on its way (`loading`), or one that was
   * asked for and did not come (`failed`)
   */
  more: More
  /** Asks for the salons that come next */
  onMore: () => void
  /** The address of the page of a salon */
  salonHref: (salon: ModelsSalonResponse) => string
}

const countOf = (total: number | null, shown: number): string => {
  if (total === null) {
    return `${shown} 件を表示しています`
  }

  return shown < total
    ? `${total} 件のサロンが見つかりました（${shown} 件を表示しています）`
    : `${total} 件のサロンが見つかりました`
}

/**
 * The salons a search found. When its button adds salons to the list, the
 * focus moves to the first of them: whoever pressed 「さらに表示」 goes on
 * reading where the new salons begin. Salons that nobody asked for (those
 * of a list that was read again) leave the focus where it is.
 */
export const SalonResults = ({
  salons,
  total,
  more,
  onMore,
  salonHref,
}: SalonResultsProps) => {
  const headingId = useId()
  const list = useRef<HTMLUListElement>(null)
  const shown = useRef(salons.length)
  // Whether the button was pressed and what it asked for is yet to be shown
  const asked = useRef(false)

  // In the commit that shows the added salons, before they are painted
  useLayoutEffect(() => {
    if (asked.current && salons.length > shown.current) {
      list.current?.children
        .item(shown.current)
        ?.querySelector<HTMLAnchorElement>('a')
        ?.focus()
      asked.current = false
    }
    shown.current = salons.length
  }, [salons.length])

  const askForMore = (): void => {
    asked.current = true
    onMore()
  }

  return (
    <section className={styles['results']} aria-labelledby={headingId}>
      <h2 className={styles['heading']} id={headingId}>
        検索結果
      </h2>
      <Note role='status'>{countOf(total, salons.length)}</Note>
      <ul className={styles['salons']} ref={list}>
        {salons.map((salon) => (
          <li key={salon.id} className={styles['salon']}>
            <h3 className={styles['name']}>
              <Link href={salonHref(salon)}>{salon.name}</Link>
            </h3>
            <Note size='small'>{addressOf(salon)}</Note>
            <p>
              <Rating
                value={salon.rating}
                count={salon.rating === null ? undefined : salon.reviewCount}
              />
            </p>
            {salon.description !== null && <p>{salon.description}</p>}
            {salon.features.length > 0 && (
              <TagList label={`${salon.name}の特徴`} items={salon.features} />
            )}
          </li>
        ))}
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
    </section>
  )
}
