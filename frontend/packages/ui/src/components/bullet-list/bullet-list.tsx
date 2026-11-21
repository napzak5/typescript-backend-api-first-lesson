import type { ComponentProps } from 'react'
import { classNames } from '../../class-names'
import styles from './bullet-list.module.css'

export type BulletListProps = ComponentProps<'ul'>

/**
 * A few short lines in a text, each after a bullet: what stands in the way
 * of a step, the names of what was chosen.
 */
export const BulletList = ({ className, ...props }: BulletListProps) => (
  <ul className={classNames(styles['bulletList'], className)} {...props} />
)
