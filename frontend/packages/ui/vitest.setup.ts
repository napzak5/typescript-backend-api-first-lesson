import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeAll } from 'vitest'
import * as preview from './.storybook/preview'

// The stories a test composes are rendered as the catalogue renders them
const annotations = setProjectAnnotations([preview])

beforeAll(annotations.beforeAll)
