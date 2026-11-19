import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// What a test rendered does not stay for the next one
afterEach(cleanup)
