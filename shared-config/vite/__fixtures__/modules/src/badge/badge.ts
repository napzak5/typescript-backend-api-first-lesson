import styles from './badge.module.css'

export const BADGE = styles.badge

export const describeBadge = (label: string): string => `${label}: ${BADGE}`
