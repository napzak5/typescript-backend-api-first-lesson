import { setProjectAnnotations } from '@storybook/react-vite'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'

// What Storybook does for every story: among other things, a callback of a
// story (`fn()`) starts every test without calls
const annotations = setProjectAnnotations([])

beforeAll(annotations.beforeAll)

// What a test rendered without a story does not stay for the next one
afterEach(cleanup)
