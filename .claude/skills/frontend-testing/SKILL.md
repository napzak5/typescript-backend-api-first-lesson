---
name: frontend-testing
description: "How frontend code of this repository is tested: stories as the entry point of component tests (composeStories from Storybook, run by Vitest in jsdom), an accessibility test for every story (axe-core), queries by role, tests of screens and of code that calls the API against the real API on a real database (*.integration.test.tsx, no stub), browser tests of the built applications against the same API (Playwright, frontend/e2e, *.e2e.test.ts), and the checks of the style rules and of token contrast. Use it before writing or changing a story, a *.test.tsx, a Vitest configuration, a browser test or the test helpers under frontend/."
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
| What a screen makes of its address and of what it read: the conditions of a search, dates and amounts, the pages of a list | The same | `frontend/apps/portal-app/src/salons/salon-format.test.ts` |
| The frame and the routes of an application, as somebody who is not signed in sees them | Rendered in a `MemoryRouter`; no API | `frontend/apps/portal-app/src/App.test.tsx` |
| The style rules, for every package and app | One test in the theme package | `frontend/packages/theme/src/style-rules.test.ts` |
| The contrast of the colour tokens | Computed from `tokens.css` | `frontend/packages/theme/src/tokens.test.ts` |
| Modules without markup (configuration, the style rules) | Unit tests in Node | `frontend/packages/config/src/env/env.test.ts` |
| The fetch function, the session and the generated client | In jsdom, over the real client and the real fetch function, with `fetch` itself stubbed | `frontend/packages/session/src/session.test.tsx` |
| The functions of a screen that call the API, for the answers the real API cannot be made to give | The same | `frontend/apps/portal-app/src/account/account-api.test.ts` |
| Code that calls the API, as it meets the real one | In jsdom, against the production application on a real PostgreSQL with the seed data; nothing is stubbed | `frontend/packages/session/src/session.integration.test.tsx` |
| A screen, and an application with somebody signed in, worked as a user works them | The same, typed into and pressed with `@testing-library/user-event` | `frontend/packages/session/src/sign-in.integration.test.tsx`, `frontend/apps/admin-app/src/App.integration.test.tsx` |
| A critical path from the address bar to the database, and what only a browser shows (layout at a width, contrast, focus as the browser moves it, two tabs, a reload, CORS) | Playwright in Chromium, on the built applications and the same API; nothing is stubbed | `frontend/e2e/src/sign-in.e2e.test.ts` |

`@beauty-salon-frontend/testing` holds what the tests share: the setup
(`@beauty-salon-frontend/testing/setup`: the matchers of jest-dom, and the
methods of the `dialog` element that jsdom lacks), `findAccessibilityViolations`
and `itShouldBeAccessibleInEveryStory`, and the real API of the integration
tests (`@beauty-salon-frontend/testing/api`). The browser tests take from it
what knows no test runner: how to start the test server and what to ask it
for (`@beauty-salon-frontend/testing/api/test-server`), and the rules of the
accessibility check (`@beauty-salon-frontend/testing/accessibility`).

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
- The catalogue of `ui` also shows the stories of `session` and of the
  applications (`stories` in `frontend/packages/ui/.storybook/main.ts`). A
  story of an application says so in its title (`Portal/Salons/SalonHours`).
- A component that shows a model of the API takes its examples from one
  file beside the components
  (`frontend/apps/portal-app/src/salons/components/examples.ts`): typed as
  the generated models, and written as a salon in Japan would write them.

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
- A link is found by its name, and the name of one that has an
  `aria-label` is that label: `getByRole('link', { name:
  'レディースカットを予約する' })`. Do not build a name from text that a
  stylesheet hides: jsdom joins it to the text that is seen, a browser
  puts a space between, and one of the two tests looks for a name that is
  not there.
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

The functions of a screen that call the API are tested the same way for
those answers alone: too many requests, an error of the server, no answer,
and a status the contract does not name (502, 503 and 504 of a gateway,
with a body that is no JSON), for which the function must answer `failed`
and not reject
(`frontend/apps/portal-app/src/account/account-api.test.ts`). One table
of the operations and one of the answers show that every operation reads
every answer. Functions that read are also asked what they ask for (the
parameters and the cursor of each request) and how they read a list to its
end: `frontend/apps/portal-app/src/salons/salons-api.test.ts`.

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
  bring about in the steps of a test (time that has passed:
  `update sessions set "expiresAt" = …`; rows in numbers and a failure of
  the API, under "A screen that reads") and for asserting what was stored.
  Values go in `values` (`$1`), never into the text. A statement the
  database refuses fails the test, and no statement drops a constraint: what
  the database refuses, the application cannot have stored.
- Arrange through the API and assert on what the user sees; assert on the
  database only for what no screen shows.
- A request may be watched (`vi.spyOn(globalThis, 'fetch')` without an
  implementation) to count what was sent. It is never answered by the test.
- **Mail** is delivered nowhere: the API of a test keeps what it would
  send. `testApi().mails()` are the mails of this test (`to`, `subject`,
  `text`), oldest first. `testApi().mailedLink(to)` is the link in the last
  mail to an address, and fails the test when there is none.
- Files are kept in memory: the API of a test has no object storage.
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
- The focus is asserted as soon as what it goes to is there, as above: a
  component moves it in the commit that shows the change, so no second wait
  is needed. A component that moves the focus has a test of just that, which
  looks at `document.activeElement` from a layout effect around the
  component (`ui/src/components/app-shell/app-shell.test.tsx`): after an
  event of the user, React runs every effect before the test goes on, so a
  test that looks afterwards cannot tell a focus that moved too late.
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
- **A screen that a mailed link opens** is rendered at the path and the
  fragment of that link, which is the person pressing it:

  ```tsx
  const { pathname, hash } = new URL(await testApi().mailedLink(email))
  render(
    <MemoryRouter initialEntries={[`${pathname}${hash}`]}>
      <App />
    </MemoryRouter>,
  )
  ```

  `frontend/apps/portal-app/src/account/account.integration.test.tsx` is the
  example to read. What the test starts from (a registration, an invitation
  by the owner of a salon) is asked of the API with `fetch`; a link that ran
  out is a statement with `testApi().query`.
- **That opening a screen asks the API for nothing**, or for a check alone,
  is asserted on the watched `fetch`: the paths below `/api/v1` that were
  asked for.
- **Two-factor authentication.** A test has no authenticator app.
  `testApi().authenticatorCode(secret)` is the code such an app shows for the
  secret the API returned when it was set up. The API takes a code once and
  after it only later ones: set up with the code of now, and sign in with
  `authenticatorCode(secret, 1)` (the code of the next 30 seconds, which the
  API takes as well) or with a backup code.
- Run a new file a few times before trusting it: a test that waits for the
  wrong thing passes on one run and fails on the next.

### A screen that reads

`frontend/apps/portal-app/src/salons/salons.integration.test.tsx` is the
example to read: a search and the page of a record, rendered at an address.

- **Render at the address** (`MemoryRouter` with `initialEntries`), with a
  component beside `App` that keeps what `useLocation()` says. A search is
  asserted on what is shown and on the address it wrote
  (`/?keyword=osaka`). An address is an arrangement, too: conditions that
  somebody typed by hand, an ID that names nothing.
- **Rows in numbers are inserted.** The second page of a list needs more
  rows than the seed data has, and the API creates one a request:
  `insert into salons (…) select … from generate_series(1, $1::int)`. A row
  that takes a whole flow (a review needs a visit that was completed) is
  inserted together with the rows it stands on, in one statement.
- **A failure is arranged in the database, never in the answer.**
  `alter table reviews rename to reviews_away` makes the API answer 500
  where it reads the table, and the name given back lets the next request
  through: the test presses 「もう一度読み込む」 and sees the content. A
  stored value that is no value of its model (a `jsonb` column) does the
  same for one record. The fresh database after the test undoes both.
- **A row with a date is written relative to today, in the database**
  (`(now() at time zone 'Asia/Tokyo')::date + 1`), so that the test holds
  on every day. Rows that the seed data wrote at one moment get moments of
  their own before an order by time is asserted.
- **What was read before is not what is read now.** A screen keeps what
  it read, under the key of its query, and shows it again at once. A test
  that opens one record only never sees a key that leaves the record out:
  open a salon, then another, and assert from the moment the other is named
  that nothing of the first is on its page; send a search, then one that
  was read before, and assert that its results are shown as a list of its
  own (no focus on an "added" item).
- **What waits its turn is found by its text**:
  `expect(screen.getByText('サロンを探しています')).toHaveRole('status')`.
  The frame keeps a `status` region for the notification inside `main`,
  also while it is empty, so `getByRole('status')` finds two.
- **A part of a page** is the region of its heading
  (`findByRole('region', { name: 'レビュー' })`). Look inside it with
  `within`: the parts arrive one by one.
- testing-library does not know the role of the `search` element. In jsdom,
  assert the element and its name
  (`expect(control.closest('search')).toHaveAttribute('aria-label', 'サロンを探す')`);
  the browser test finds the landmark with `getByRole('search', { name })`.
- `getAllByRole` takes one role and no pattern. What stands in a row,
  whatever its role, is `Array.from(row.children, (cell) => cell.textContent)`.

### A screen that writes what it read

`frontend/apps/portal-app/src/bookings/bookings.integration.test.tsx` is
the example to read: a customer books a time that the screen read.

- **The day is arranged in the database, relative to today.** What is
  free on a day depends on the hours of the salon, on who works, and on
  the bookings there are. The test writes the hours of one date and the
  working hours of each member of the staff on it
  (`openDay({ 'Hiroshi Tanaka': '10:00' })`: `opening_hours` and
  `staff_schedules` for
  `(now() at time zone 'Asia/Tokyo')::date + 14`, beyond the bookings of
  the seed data), and knows from them the times the screen must offer, on
  whatever day it runs. A date is never written out in a test.
- **What somebody else did meanwhile is done through the API.** Between
  the moment the screen read the times and the moment its form is sent,
  another customer books one of them: a request with `fetch` and the
  access token of that customer (`bookThroughApi`). The refusal the screen
  then gets is the real one.
- **An account in a state the seed data does not have** is made as a
  person would make it, through the API: registered, its address confirmed
  with the token of `testApi().mailedLink(email)`. It then signs in on the
  screen.
- **What was written is asserted where it is kept**: the row of
  `bookings` (whose it is, with whom, its state and its source), besides
  what the next screen shows.
- **Which table to take away** for a failure is read from the repository
  of the operation: the read of a customer's booking touches `bookings`
  and `booking_services`, not `services`. A table that does not exist
  fails the test at the statement.
- **The order of a list the API sorts by ID differs from one seeded
  database to the next.** Assert the order the screen gives it (the staff
  by name), never the order of the answer.
- **A date is given to its control as a value**: jsdom has no picker to
  work, so the test sets it
  (`fireEvent.change(control, { target: { value: date } })`), and a
  browser test fills it (`fill(date)`). The date is the one the database
  gave (`dayAhead`).

`App.test.tsx` of an application keeps what needs no API: what somebody who
is not signed in sees. Everything behind the sign-in is in
`App.integration.test.tsx`, and so is a route whose screen reads from the
API as soon as it opens (the root of the portal).

The test server needs a PostgreSQL: the one at `TEST_DATABASE_URL` when it is
set (its user creates databases), otherwise a container, and so a running
Docker daemon. When it cannot start, the run fails before the first test and
the reason is printed above the error.

## In a browser

`frontend/e2e` holds the tests that drive a real browser (Playwright,
Chromium): the three applications as they are built, calling the production
API on a real PostgreSQL with the seed data. Nothing is stubbed here either.

### What belongs here

A browser test is the slowest test, and the one that says least about where a
fault is. A behaviour is tested here when jsdom cannot show it, or once as a
whole path:

| In a browser test | In an integration test in jsdom |
|-------------------|---------------------------------|
| A critical path, once, from the address bar to the database | Every state of a screen: each message, each refusal, each role |
| What the browser lays out and paints: nothing sticks out of a narrow window or out of the element it is in, nothing is laid out with flex, the contrast of what is on the page | The accessibility rules that need no layout |
| The focus as the browser moves it: the Tab key through a form, the heading after the screen changed | Which element has the focus after an action |
| A reload, a second tab, the address bar, the way back and forward | — |
| A link that leaves the page: from a mail to the portal, from one application to another | The screen such a link opens, rendered at its path |
| That a page of an application may call the API at all (CORS), and that a build calls the API it was built for | — |

### How a run is put together

`frontend/e2e/playwright.config.ts` says it all:

- `globalSetup` (`src/global-setup.ts`) starts the test server of the
  backend, the one of the integration tests, and on it one API: on port 4100,
  open to the origins of the three applications, and writing the links of
  its mails for the portal of the run. After the run it stops the server.
- `webServer` builds each application with `vite build --mode test` for that
  API, and for the addresses of the other applications of the run, into
  `frontend/e2e/dist/` and serves the build: the portal on port 4101, the
  admin application on 4102, the dashboard on 4103 (`src/applications.ts`).
  Everything listens on the loopback address and on ports of its own, so
  `pnpm dev` may run at the same time.
- One worker. The applications are built for one API, so the tests share it
  and take their turns. After every test the API gets a fresh copy of the
  seeded database, and Playwright gives every test a browser context of its
  own (storage, cookies): no test sees what another one did.
- No retries. A test that fails now and then is found and fixed; a second
  attempt would hide it.

A build reads the workspace packages as they were last built. `pnpm test:e2e`
at the root builds them first; `playwright test` in `frontend/e2e` does not.

### Writing a browser test

```ts
import { ADMIN } from './applications'
import { expectSoundPage } from './checks'
import { expect, test } from './fixtures'
import { enterCredentials, heading, STAFF } from './sign-in'

test.describe('the admin application', () => {
  test('should open for a member of the staff of a salon', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)

    // Act
    await enterCredentials(page, STAFF, api.seedPassword)

    // Assert
    await expect(heading(page, ADMIN.title)).toBeFocused()
    await expectSoundPage(page)
  })
})
```

- The file is `src/<subject>.e2e.test.ts`. `test` and `expect` come from
  `./fixtures`, never from `@playwright/test`: the `test` of the fixtures is
  what gives the API a fresh database after every test.
- The fixture `api` is what `testApi()` is in an integration test: `origin`,
  `seedPassword`, `query`, `authenticatorCode`, `mails` and `mailedLink`.
  `await page.goto(await api.mailedLink(email))` is the person pressing the
  link of a mail (`src/account.e2e.test.ts`).
- Elements are found as a user finds them: `getByRole`, `getByLabel`,
  `getByText`. No class name, no test ID. The locators and the steps that
  tests share are in `src/sign-in.ts` (`heading`, `enterCredentials`,
  `signOutButton`); the applications, their origins and their titles in
  `src/applications.ts`.
- Assertions on the page are the ones that wait:
  `await expect(locator).toBeVisible()`, `toBeFocused()`, `toHaveURL()`. A
  test never waits for an amount of time.
- Every screen a test reaches is checked with `expectSoundPage(page)`
  (`src/checks.ts`), which is `findAccessibilityViolations(page)` and a
  measure of the layout: the rules of WCAG 2.2 AA with the contrast of what
  is painted, a page no wider than the window, no element that holds
  something wider than it is without scrolling it or cutting it off, no
  element laid out with flex. A line that does not wrap sticks out of its
  card long before it makes the page wider, so the width of the page alone
  says too little.
  What has to fit a phone is tested in a `describe` with
  `test.use({ viewport: { width: 390, height: 844 } })`, on the record with
  the longest values the seed data has (the salon whose hours have a break,
  not the one whose hours are one time).
- What no screen does yet, a test asks of the API with the `request` fixture
  of Playwright (`accessTokenOf` and `setUpTwoFactor` in `src/sign-in.ts`),
  and checks the answer with a Zod schema. What neither a screen nor the API
  does, such as time having passed, is a statement with `api.query`.
- A screen whose state is in its address is taken back, forward and
  through a reload (`page.goBack()`, `page.reload()`, a second page of the
  `context` at the same address): `src/salons.e2e.test.ts`.
- `selectOption` sets the value of a `select` without giving it the focus.
  A test that asserts where the focus is after a choice gives it first
  (`await control.focus()`), as a person does.
- A path that begins on a public page and needs a session signs in on the
  way, at the address that was asked for (`src/bookings.e2e.test.ts`): the
  test presses the link, enters the credentials on the screen that stands
  there, and asserts the heading of the screen it wanted. What the
  database must hold for the path (the hours of a day) is arranged with
  `api.query` before the page is opened, relative to today.
- A radio button among many is found by its whole name
  (`getByRole('radio', { name: '10:30', exact: true })`), and the keyboard
  is taken through the group as a person takes it: Tab to the group, Space
  for the first, the arrow keys for the next.
- The modules of `frontend/e2e/src` that are no test files are under the
  lint prohibitions of application code: no type assertion, no type guard,
  and `node:assert` in place of `throw`.

### Running the browser tests

```bash
pnpm test:e2e:install   # once, and after Playwright was updated: its Chromium
pnpm test:e2e           # builds the frontend packages, then runs every test

# One file, on the packages as they were last built
pnpm --filter @beauty-salon-frontend/e2e exec playwright test src/sign-in.e2e.test.ts
# What the browser did in a test that failed
pnpm --filter @beauty-salon-frontend/e2e exec playwright show-trace test-results/<directory of the test>/trace.zip
```

A run needs a PostgreSQL as the integration tests do (`TEST_DATABASE_URL`, or
Docker for a container) and the ports 4100 to 4103. It refuses to start when
one of them is taken, so that it never tests what another run left behind.
`make ci-check` and the job "E2E Test" of CI run it; the job keeps the report
and the traces of a failed run as an artifact.

## Accessibility

`findAccessibilityViolations()` runs axe-core over the document with the rules
of WCAG 2.2 level AA and returns the violations as plain values (`rule`,
`impact`, `help`, `elements`), so a failing test prints which element broke
which rule.

jsdom computes no layout, so the rule `color-contrast` is off there. Contrast
is checked where the colours are defined: `tokens.test.ts` computes the ratio
of every pair of tokens that is used as text on a background (4.5:1) or as the
edge of a control (3:1). The browser tests measure it on the pages as they
are painted (`findAccessibilityViolations(page)` of `frontend/e2e/src/checks.ts`
runs the same rules with `color-contrast` on), and the accessibility panel of
the catalogue shows it for a single story.

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

A package or an application whose stories the catalogue of `ui` shows has no
preview of its own and gives none (`frontend/packages/session/vitest.setup.ts`,
`frontend/apps/portal-app/vitest.setup.ts`); `storybook` and
`@storybook/react-vite` are among its dev dependencies. The call is still
needed: it is what empties the `fn()` callbacks of a story between two tests.

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

pnpm test:e2e                                        # the browser tests (see "In a browser")
```
