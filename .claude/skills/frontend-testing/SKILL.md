---
name: frontend-testing
description: "How frontend code of this repository is tested: stories as the entry point of component tests (composeStories from Storybook, run by Vitest in jsdom), an accessibility test for every story (axe-core), queries by role, tests of screens and of code that calls the API against the real API on a real database (*.integration.test.tsx, no stub), and the checks of the style rules and of token contrast. Use it before writing or changing a story, a *.test.tsx, a Vitest configuration or the test helpers under frontend/."
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
| What a form does with its values and with the answer of the API | Unit tests of the pure functions | `frontend/packages/session/src/components/sign-in-screen/sign-in-flow.test.ts` |
| The frame and the routes of an application, as somebody who is not signed in sees them | Rendered in a `MemoryRouter`; no API | `frontend/apps/portal-app/src/App.test.tsx` |
| The style rules, for every package and app | One test in the theme package | `frontend/packages/theme/src/style-rules.test.ts` |
| The contrast of the colour tokens | Computed from `tokens.css` | `frontend/packages/theme/src/tokens.test.ts` |
| Modules without markup (configuration, the style rules) | Unit tests in Node | `frontend/packages/config/src/env/env.test.ts` |
| The fetch function, the session and the generated client | In jsdom, over the real client and the real fetch function, with `fetch` itself stubbed | `frontend/packages/session/src/session.test.tsx` |
| Code that calls the API, as it meets the real one | In jsdom, against the production application on a real PostgreSQL with the seed data; nothing is stubbed | `frontend/packages/session/src/session.integration.test.tsx` |
| A screen, and an application with somebody signed in, worked as a user works them | The same, typed into and pressed with `@testing-library/user-event` | `frontend/packages/session/src/sign-in.integration.test.tsx`, `frontend/apps/admin-app/src/App.integration.test.tsx` |

`@beauty-salon-frontend/testing` holds what the tests share: the setup
(`@beauty-salon-frontend/testing/setup`: the matchers of jest-dom, and the
methods of the `dialog` element that jsdom lacks), `findAccessibilityViolations`
and `itShouldBeAccessibleInEveryStory`, and the real API of the integration
tests (`@beauty-salon-frontend/testing/api`).

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

This is how the code that sends the requests is tested, and nothing else:
the order and the number of requests, and answers the real API gives only
under conditions a test cannot arrange. What a user does on a screen is
tested against the real API.

## Against the real API

A test in a file `*.integration.test.tsx` runs the code as it is, against the
production application of the backend on a real PostgreSQL. Nothing is
replaced: not `fetch`, not the client, not a module.

```tsx
import { testApi } from '@beauty-salon-frontend/testing/api'
import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { signIn } from '.'

describe('the session against the API', () => {
  it('should sign a user in and know who it is', async () => {
    // Act
    await signIn({
      email: 'customer1@example.com',
      password: testApi().seedPassword,
      rememberMe: false,
      twoFactorCode: null,
    })
    // `useSession` in a `QueryClientProvider`, as in the file of the example
    const { result } = renderSession()

    // Assert
    await waitFor(() =>
      expect(result.current).toMatchObject({ type: 'signedIn' }),
    )
    expect(
      await testApi().query('select "userId"::text as "userId" from sessions'),
    ).toHaveLength(1)
  })
})
```

- The run starts one **test server**
  (`backend/packages/api/src/__tests__/test-server/`). Every test file gets an
  API of its own from it: the production `createApp`, on its own port and on
  its own copy of a database that has the schema and the seed data. The code
  under test finds it through `VITE_BACKEND_BASE_URL`, which the setup sets
  before the file imports anything.
- After every test the API gets a fresh copy of the seeded database, and
  `localStorage` and `sessionStorage` are emptied. A test starts from the seed
  data and never from what another test left.
- The data is the seed data (`backend/packages/database/src/seeds/seed-data/`):
  two salons, and accounts of every role (`customer1@example.com`,
  `owner@beautysalon.jp`, `manager@beautysalon.jp`, `stylist1@beautysalon.jp`,
  `admin@beautysalon.jp`), all with the password `testApi().seedPassword`.
  What a test needs beyond it, it creates the way a user would: through the
  screen or the API.
- `testApi().query(text, values)` runs a statement on the database of the API
  and returns its rows. It is for what neither the screen nor the API can
  bring about (time that has passed: `update sessions set "expiresAt" = …`)
  and for asserting what was stored. Values go in `values` (`$1`), never into
  the text. A statement the database refuses fails the test.
- Arrange through the API and assert on what the user sees; assert on the
  database only for what no screen shows.
- A request may be watched (`vi.spyOn(globalThis, 'fetch')` without an
  implementation) to count what was sent. It is never answered by the test.
- Mail is not delivered and files are kept in memory: the API of a test has
  no SMTP server and no object storage.
- The answer of the real API takes time. Wait for what appears (`findByRole`,
  `waitFor`); never for a duration.
- Every test of a package costs a reset of the database (about a tenth of a
  second). What needs no API stays a test of the stories.

### A screen

A screen that calls the API is tested as its user works it: the test types
into its controls and presses its buttons, and the requests go to the real
API. `frontend/packages/session/src/sign-in.integration.test.tsx` is the
example to read.

```tsx
import userEvent from '@testing-library/user-event'

it('should show the screen that was asked for after signing in', async () => {
  // Arrange
  renderApplication()
  const user = userEvent.setup()

  // Act
  await user.type(
    await screen.findByRole('textbox', { name: 'メールアドレス' }),
    'customer1@example.com',
  )
  await user.type(screen.getByLabelText('パスワード'), testApi().seedPassword)
  await user.click(screen.getByRole('button', { name: 'サインイン' }))

  // Assert
  expect(
    await screen.findByRole('heading', { level: 1, name: 'マイページ' }),
  ).toHaveFocus()
})
```

- Render the screen inside what it really stands in: a `QueryClientProvider`
  with a new `QueryClient` whose queries do not retry, `NotificationProvider`,
  and `AppShell` when the title of the document or the focus is asserted. An
  application is rendered whole, `App` in a `MemoryRouter`.
- `userEvent` is that of `@testing-library/user-event`, a dev dependency of
  the package. (A test of stories takes it from `storybook/test`.)
- Sign in on the screen when signing in is what the test is about, and with
  `signIn(…)` of the session package when it only has to have happened.
- Every state the screen reaches gets `findAccessibilityViolations()`: the
  stories cover the parts, this covers the whole.
- Assert on an element when it has been found. After the next action the
  screen may have changed and the element is gone: two things to assert at
  two moments are two tests, or values kept before the action.
- A test that counts requests restores the spy (`vi.restoreAllMocks()` in
  `afterEach`).
- **Two-factor authentication.** A test has no authenticator app.
  `testApi().authenticatorCode(secret)` is the code such an app shows for the
  secret the API returned when it was set up. The API takes a code once and
  after it only later ones: set up with the code of now, and sign in with
  `authenticatorCode(secret, 1)` (the code of the next 30 seconds, which the
  API takes as well) or with a backup code.
- Run a new file a few times before trusting it: a test that waits for the
  wrong thing passes on one run and fails on the next.

`App.test.tsx` of an application keeps what needs no API: what somebody who
is not signed in sees. Everything behind the sign-in is in
`App.integration.test.tsx`.

The test server needs a PostgreSQL: the one at `TEST_DATABASE_URL` when it is
set (its user creates databases), otherwise a container, and so a running
Docker daemon. When it cannot start, the run fails before the first test and
the reason is printed above the error.

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

A package whose stories the catalogue of `ui` shows has no preview of its own
and gives none (`frontend/packages/session/vitest.setup.ts`). The call is
still needed: it is what empties the `fn()` callbacks of a story between two
tests.

```ts
const annotations = setProjectAnnotations([])

beforeAll(annotations.beforeAll)
```

A test that renders with `@testing-library/react` directly, as `App.test.tsx`
does, needs `afterEach(cleanup)` in its `vitest.setup.ts`.

A package with tests against the real API has a second configuration,
`vitest.integration.config.ts`, and the script
`"test:integration": "vitest run --config vitest.integration.config.ts"`
(`frontend/packages/session`, and each application). It differs from the
first in three lines, and `vitest.config.ts` gets
`exclude: [...configDefaults.exclude, '**/*.integration.test.*']` so that
`pnpm test` needs no database:

```ts
  test: {
    environment: 'jsdom',
    include: ['src/**/*.integration.test.tsx'],
    // Starts the test server of the backend for the run, and stops it
    globalSetup: ['@beauty-salon-frontend/testing/api/global-setup'],
    // An API for the file, a fresh database for every test
    setupFiles: [
      '@beauty-salon-frontend/testing/setup',
      '@beauty-salon-frontend/testing/api/setup',
      './vitest.setup.ts',
    ],
    css: {
      // The class names of the CSS Modules, as they are written
      modules: { classNameStrategy: 'non-scoped' },
    },
  },
```

`@beauty-salon-frontend/testing` is a dev dependency of such a package, and
so is `@testing-library/user-event` when its tests work a screen.

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

pnpm --filter @beauty-salon-frontend/session test:integration   # against the real API, one package
pnpm --filter @beauty-salon-frontend/admin-app test:integration # the same for one application
pnpm test:integration                                # every integration test, backend and frontend
```
