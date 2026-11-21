import { Badge } from '../badge/badge'
import styles from './tag-list.module.css'

export type TagListProps = {
  /** What the words say about: 「特徴」. It names the list for assistive technology */
  label: string
  /** The words; one that is repeated is shown once */
  items: readonly string[]
}

/**
 * Short words about one thing (the features of a salon, what a stylist is
 * good at), as a list. The words follow each other like text and go on in
 * the next line, and a word longer than the line breaks, so the list is as
 * wide as it is given and never wider.
 */
export const TagList = ({ label, items }: TagListProps) => (
  <ul className={styles['tagList']} aria-label={label}>
    {Array.from(new Set(items), (item) => (
      <li key={item} className={styles['item']}>
        <Badge className={styles['word']}>{item}</Badge>
      </li>
    ))}
  </ul>
)
