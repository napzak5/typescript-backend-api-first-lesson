import { scoped } from '@a-scope/a-package'
import { whole } from 'a-dependency'
import { part } from 'a-dependency/part'
import { peer } from 'a-peer'
import { tool } from 'a-tool'
import about from '../about.txt?raw'

export const MODE = import.meta.env.MODE

export const words = (): string[] => [
  scoped,
  whole,
  part,
  peer,
  tool,
  about,
  MODE,
]
