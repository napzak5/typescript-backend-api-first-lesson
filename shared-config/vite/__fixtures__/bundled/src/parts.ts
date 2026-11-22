import { part } from 'a-dependency/part'
import { tool } from 'a-tool'
import { toolbox } from 'a-toolbox'

export const parts = (): string[] => [part, tool, toolbox]
