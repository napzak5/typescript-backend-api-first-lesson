---
name: frontend-testing
description: "How frontend code of this repository is tested: stories as the entry point of component tests (composeStories from Storybook, run by Vitest in jsdom), an accessibility test for every story (axe-core), queries by role, and the checks of the style rules and of token contrast. Use it before writing or changing a story, a *.test.tsx, a Vitest configuration or the test helpers under frontend/."
---

# Frontend Testing

A story is one state of a component. The catalogue shows it and the test
renders the same story, so what is tested is what is shown. Every story is
also checked for accessibility.

The styling and component rules are in the skill `frontend-ui`.

## The kinds of test

| Subject | Test | Example |
|---------|------|---------|
| A component | Its stories, composed and run by Vitest in jsdom | `frontend/packages/ui/src/components/button/button.test.tsx` |
| The frame and the routes of an application | Rendered in a `MemoryRouter` | `frontend/apps/portal-app/src/App.test.tsx` |
| The style rules, for every package and app | One test in the theme package | `frontend/packages/theme/src/style-rules.test.ts` |
| The contrast of the colour tokens | Computed from `tokens.css` | `frontend/packages/theme/src/tokens.test.ts` |
| Modules without markup (configuration, the style rules) | Unit tests in Node | `frontend/packages/config/src/env/env.test.ts` |
| The fetch function, the session and the generated client | In jsdom, over the real client and the real fetch function, with `fetch` itself stubbed | `frontend/packages/session/src/session.test.tsx` |

`@beauty-salon-frontend/testing` holds what the tests share: the setup
(`@beauty-salon-frontend/testing/setup`: the matchers of jest-dom, and the
methods of the `dialog` element that jsdom lacks), `findAccessibilityViolations`
and `itShouldBeAccessibleInEveryStory`.

## Stories

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  args: { children: '予約する', onClick: fn() },
}

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: { variant: 'primary' },
}
```

- One story per state worth seeing. A state that a test needs and no story
  shows is a missing story.
- The meta is annotated with its type; `satisfies` is not used for it.
- A callback is `fn()`, so a test can ask whether it was called.
- Text is what the interface would say, in Japanese.

## The test of a component

```tsx
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as buttonStories from './button.stories'

const stories = composeStories(buttonStories)

describe('Button', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should call onClick when it is pressed', async () => {
    // Arrange
    await stories.Primary.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '予約する' }))

    // Assert
    expect(stories.Primary.args.onClick).toHaveBeenCalledTimes(1)
  })
})
```

- `itShouldBeAccessibleInEveryStory(stories)` is the first line of every
  `describe` of a component: one accessibility test per story.
- `await Story.run()` renders the story. Running another story replaces what
  the previous one rendered; nothing is cleaned up by hand.
- Change an arg for one test with
  `Story.run({ args: { ...Story.args, type: 'submit' } })`.
- Find elements the way a user of assistive technology does: `getByRole` with
  the accessible name, `getByLabelText`, `getByText`. No test ids, no query by
  class.
- Act through `userEvent` (`click`, `tab`, `keyboard`, `type`). Cover the
  keyboard for everything a pointer can do.
- jsdom applies no stylesheet. Assert the attribute or the class a style hangs
  on (`toHaveAttribute('aria-busy', 'true')`, `toHaveClass('primary')`) and
  look at the catalogue for how it looks.
- Names are English sentences beginning with `should`; the body has the
  comments `// Arrange`, `// Act`, `// Assert`.
- No module is replaced: no `vi.mock` of a workspace package or of a
  component. A dependency a component needs is given to it as a prop or by
  the provider it really uses.

### Form controls

- A control is found by its role and its label:
  `getByRole('textbox', { name: 'お名前' })`, `'combobox'` for a select,
  `'checkbox'`, `'radio'`, `'radiogroup'`. An input of the type `password`,
  `date` or `time` has no role: `getByLabelText('パスワード')`.
- What is said about a value is asserted as assistive technology hears it:
  `toHaveAccessibleDescription('…')`, `toHaveAttribute('aria-invalid', 'true')`,
  `toBeRequired()`.
- `userEvent.type`, `selectOptions`, `click`, `tab` and `keyboard` act on the
  control. The arrow keys move the choice of a radio group.
- `userEvent` cannot press a `label` in this environment. It copies the click
  to the control together with the `view` of the document, which under Vitest
  is the global object of Node.js, and jsdom refuses that ("member view is not
  of type Window"). Press a label with `fireEvent.click`: jsdom passes the
  click on to the control, as a browser does. jsdom does not move the focus to
  the control; that part is seen in a real browser only.

### Links, landmarks, dialogs and play functions

- A story has no router. A link of a component is a plain `a` there: assert
  its `href`.
- testing-library takes every `header` element for a banner, also one inside
  `main`. `PageHeader` is therefore a `div`; when a page has several regions
  of one role (`status`, `region`), look inside the one that is meant with
  `within(screen.getByRole('main'))`.
- jsdom has no `showModal()` and no `close()` for the `dialog` element.
  `@beauty-salon-frontend/testing/setup` gives it both: the `open` attribute
  and the `close` event, which is what the test of a component asserts. The
  focus kept inside, the inert page behind and the Escape key are the
  browser's work and are checked in a real browser.
- A component that is generic in its data gets a wrapper with the type filled
  in, and the stories are those of the wrapper (`BookingTable` in
  `table.stories.tsx`).
- A story reaches a state that needs a step with a `play` function, and
  `Story.run()` runs it. Inside it, use `userEvent` imported from
  `storybook/test`; the context of a composed story has `canvas` but no
  `userEvent`. A play function shared by stories is a constant of the type
  `NonNullable<Story['play']>`.

## Code that calls the API

The fetch function (`io`), the session (`session`) and the generated client
are tested together, as they run. The test replaces `fetch` alone
(`vi.stubGlobal('fetch', …)`) and asserts on the requests that were sent: what
they carried, their order and their number.

- The stub answers as the API does: an error is problem details with a `code`
  of the contract. `frontend/packages/session/src/session.test.tsx` has an API
  of two users whose tokens a test can let expire or end.
- The session is in `localStorage`. Write it with `sessionStore.write` and
  clear `localStorage` after each test. Another tab is a change to
  `localStorage` followed by a `StorageEvent` on `window`.
- A hook is rendered with `renderHook`, inside a `QueryClientProvider` with a
  new `QueryClient` whose queries do not retry. When the test is about what
  must never be shown, keep every value the hook returned and assert on all
  of them.
- An answer that has to be seen while it is on its way takes time (a
  `setTimeout` in the stub). TanStack Query delivers its notifications in
  batches, and an answer that resolves at once is never rendered as
  "fetching".
- The module of the fetch function holds the renewal that is under way. A test
  that needs a fresh one loads the package anew (`vi.resetModules()` and a
  dynamic `import`).
- `frontend/packages/api-client/src/session.test.ts` compares what `io` knows
  of the API (a path and two codes) with what is generated from the contract.

This is how the code that sends the requests is tested, and nothing else. A
screen is tested against the real API and a real database, without a stub of
`fetch` or of the client; that harness does not exist yet (issue #276).

## Accessibility

`findAccessibilityViolations()` runs axe-core over the document with the rules
of WCAG 2.2 level AA and returns the violations as plain values (`rule`,
`impact`, `help`, `elements`), so a failing test prints which element broke
which rule.

jsdom computes no layout, so the rule `color-contrast` is off there. Contrast
is checked where the colours are defined: `tokens.test.ts` computes the ratio
of every pair of tokens that is used as text on a background (4.5:1) or as the
edge of a control (3:1). The accessibility panel of the catalogue shows
contrast for a single story in a real browser.

## Setting up a package or an application

`vitest.config.ts`:

```ts
import { defaultClientConditions, defaultServerConditions } from 'vite'
import { defineConfig } from 'vitest/config'

// Workspace packages are tested from source, not from their last build
const SOURCE = '@beauty-salon-frontend/source'

export default defineConfig({
  resolve: { conditions: [SOURCE, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [SOURCE, ...defaultServerConditions] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['@beauty-salon-frontend/testing/setup', './vitest.setup.ts'],
    css: {
      // The class names of the CSS Modules, as they are written
      modules: { classNameStrategy: 'non-scoped' },
    },
  },
})
```

`vitest.setup.ts` of a package with stories gives the tests what the catalogue
gives every story (`frontend/packages/ui/vitest.setup.ts`):

```ts
import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeAll } from 'vitest'
import * as preview from './.storybook/preview'

const annotations = setProjectAnnotations([preview])

beforeAll(annotations.beforeAll)
```

A test that renders with `@testing-library/react` directly, as `App.test.tsx`
does, needs `afterEach(cleanup)` in its `vitest.setup.ts`.

## A check is shown to fail

Before relying on a new test or rule, break what it guards and see it fail:
write the flex declaration, remove the label, pale the token. A check that
has never failed proves nothing.

## Commands

```bash
pnpm --filter @beauty-salon-frontend/ui test         # one package
pnpm --filter @beauty-salon-frontend/ui test:watch   # while writing
pnpm test:frontend                                   # every frontend test
pnpm test                                            # frontend and backend unit tests
```
