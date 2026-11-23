import type { ModelsSalonResponse } from '@beauty-salon-frontend/api-client'
import {
  COUNTED,
  countOf,
  Link,
  type More,
  Note,
  PagedList,
  Rating,
  TagList,
  useSay,
} from '@beauty-salon-frontend/ui'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { useId } from 'react'
import { addressOf } from '../../utils/salon-format'
import styles from './salon-results.module.css'

const { results: words } = portalSalonMessages

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
  const say = useSay()
  const headingId = useId()

  return (
    <section className={styles['results']} aria-labelledby={headingId}>
      <h2 className={styles['heading']} id={headingId}>
        {say(words.title)}
      </h2>
      <PagedList
        items={salons}
        itemKey={({ id }) => id}
        count={say(countOf(total, salons.length, COUNTED.items, words.found))}
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
              <TagList
                label={say(words.featuresOf(salon.name))}
                items={salon.features}
              />
            )}
          </>
        )}
      </PagedList>
    </section>
  )
}
