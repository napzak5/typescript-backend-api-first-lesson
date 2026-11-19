import { useId } from 'react'
import { classNames } from '../../class-names'
import styles from './rating.module.css'

export type RatingProps = {
  /** The rating, from 0 to 5: one, or the mean of many. `null` while there is none */
  value: number | null
  /** How many ratings `value` is the mean of */
  count?: number | undefined
  className?: string | undefined
}

const HIGHEST = 5

/** The width of one star in the drawing, and its outline */
const STAR_WIDTH = 20
const STAR =
  'M10 1.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 15l-5.2 2.8 1-5.9L1.5 7.8l5.9-.8z'

const STARS = Array.from({ length: HIGHEST }, (_, index) => index * STAR_WIDTH)

/**
 * A rating out of five, as stars and as a number. The stars are a drawing
 * for the eye; the number is what is read out, in one piece with what it is
 * out of (「5 段階中 4.5（128 件）」).
 */
export const Rating = ({ value, count, className }: RatingProps) => {
  const clipId = useId()

  if (value === null) {
    return (
      <span className={classNames(styles['rating'], styles['none'], className)}>
        評価なし
      </span>
    )
  }

  const shown = value.toFixed(1)
  const counted = count === undefined ? '' : `（${count} 件）`

  return (
    <span
      className={classNames(styles['rating'], className)}
      role='img'
      aria-label={`${HIGHEST} 段階中 ${shown}${counted}`}
    >
      <svg
        className={styles['stars']}
        viewBox={`0 0 ${HIGHEST * STAR_WIDTH} ${STAR_WIDTH}`}
        aria-hidden='true'
      >
        <clipPath id={clipId}>
          <rect width={value * STAR_WIDTH} height={STAR_WIDTH} />
        </clipPath>
        <g className={styles['empty']}>
          {STARS.map((x) => (
            <path key={x} d={STAR} transform={`translate(${x})`} />
          ))}
        </g>
        <g className={styles['filled']} clipPath={`url(#${clipId})`}>
          {STARS.map((x) => (
            <path key={x} d={STAR} transform={`translate(${x})`} />
          ))}
        </g>
      </svg>
      <span className={styles['value']} aria-hidden='true'>
        {shown}
      </span>
      {count !== undefined && (
        <span className={styles['count']} aria-hidden='true'>
          {counted}
        </span>
      )}
    </span>
  )
}
