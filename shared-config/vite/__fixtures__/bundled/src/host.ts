import { hostname } from 'node:os'

export const host = (): string => hostname()
