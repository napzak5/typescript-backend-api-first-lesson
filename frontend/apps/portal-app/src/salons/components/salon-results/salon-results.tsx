import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  Link,
  type More,
  Note,
  PagedList,
  Rating,
  TagList,
} from '@beauty-salon-frontend/ui'
import { useId } from 'react'
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
 * The salons a search found. The name of a salon is the link to its page,
 * and takes the focus when 「さらに表示」 added the salon.
 */
export const SalonResults = ({
  salons,
  total,
  more,
  onMore,
  salonHref,
}: SalonResultsProps) => {
  const headingId = useId()

  return (
    <section className={styles['results']} aria-labelledby={headingId}>
      <h2 className={styles['heading']} id={headingId}>
        検索結果
      </h2>
      <PagedList
        items={salons}
        itemKey={({ id }) => id}
        count={countOf(total, salons.length)}
        more={more}
        onMore={onMore}
      >
        {(salon) => (
          <>
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
          </>
        )}
      </PagedList>
    </section>
  )
}
