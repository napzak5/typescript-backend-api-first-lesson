import { atTheWidthOfTheStory } from '@beauty-salon-frontend/testing'
import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeAll } from 'vitest'
import * as preview from './.storybook/preview'

// The stories a test composes are rendered as the catalogue renders them,
// at the width it shows them at
const annotations = setProjectAnnotations([preview, atTheWidthOfTheStory])

beforeAll(annotations.beforeAll)
