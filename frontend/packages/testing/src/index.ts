// The matchers of `./setup` are part of what a test file sees when it
// imports from this package: their types come with this import
import './setup'

export {
  type AccessibilityViolation,
  findAccessibilityViolations,
} from './accessibility'
export { itShouldBeAccessibleInEveryStory } from './story-accessibility'
