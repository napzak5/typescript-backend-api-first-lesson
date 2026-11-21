/**
 * What the catalogue gives every story, for the tests of the stories of a
 * package or an application: Storybook empties the callbacks of a story
 * (`fn()`) before every test, and a story that the catalogue shows at the
 * width of a phone is drawn at that width in a test too. A test that
 * renders with `@testing-library/react` directly does not leave what it
 * rendered to the next.
 *
 * Name it in `setupFiles`, after `@beauty-salon-frontend/testing/setup`. A
 * package with a preview of its own (`ui`) gives it with
 * `atTheWidthOfTheStory` in a setup of its own instead.
 */
import { setProjectAnnotations } from '@storybook/react-vite'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import { atTheWidthOfTheStory } from './story-width'

const annotations = setProjectAnnotations([atTheWidthOfTheStory])

beforeAll(annotations.beforeAll)

afterEach(cleanup)
