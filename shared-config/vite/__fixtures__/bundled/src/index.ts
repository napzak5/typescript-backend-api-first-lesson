import { whole } from 'a-dependency'
import { tool } from 'a-tool'
import { inner } from './inner'

export const MODE = import.meta.env.MODE

export const outer = (): string[] => [whole, tool, inner(), MODE]
