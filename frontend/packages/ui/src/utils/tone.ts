import styles from './tone.module.css'

/**
 * The state that something says, as a colour: `danger` is something that
 * went wrong, `warning` something to look at, `success` something done,
 * `info` anything else. The words say which state; the colour only groups.
 */
export type Tone = 'info' | 'success' | 'warning' | 'danger'

/** The class that gives an element the colours of a state: its surface, and the text and the edge on it */
export const toneClass: Record<Tone, string | undefined> = {
  info: styles['info'],
  success: styles['success'],
  warning: styles['warning'],
  danger: styles['danger'],
}
