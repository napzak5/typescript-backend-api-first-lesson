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
(`@beauty-salon-frontend/testing/setup`: the matchers of jest-dom, the
methods of the `dialog` element that jsdom lacks, and the saving of a file
a page made), `savedFiles`, `findAccessibilityViolations`
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
- jsdom has no `URL.createObjectURL`, and a link that names a file to save
  (`download`) saves nothing. `@beauty-salon-frontend/testing/setup` gives
  it object URLs and keeps the file a pressed link saves:
  `await savedFiles()` are the files of this test, oldest first, each with
  its name, its type and its text (the mark of the byte order kept as
  `\uFEFF`). A screen test of an export asserts on them, against the real
  API; a browser test waits for the download of the browser
  (`page.waitForEvent('download')`) and reads the bytes it saved, which is
  where the name crossing origins (CORS) is seen.
- jsdom has no `showModal()` and no `close()` for the `dialog` element.
  `@beauty-salon-frontend/testing/setup` gives it both: the `open` attribute
  and the `close` event, which is what the test of a component asserts. The
  focus kept inside, the inert page behind and the Escape key are the
  browser's work and are checked in a real browser. In jsdom the page
  behind an open dialog can still be found and pressed: look inside the
  dialog (`within(screen.getByRole('dialog', { name }))`), and assert that
  it is gone with `queryByRole('dialog')`. The Escape key is the `cancel`
  event (`fireEvent(dialog, new Event('cancel'))`): the browser fires it,
  closes the dialog, and fires `close` a task later. A `close` fired at a
  dialog that is still open is one the browser never sends, and `Dialog`
  takes it for a late one. A closed dialog is still in the document with
  its controls: what a test counts with `querySelectorAll` is counted
  inside the element it is about (`closest('form')`), not in the
  document.
- A component that is generic in its data gets a wrapper with the type filled
  in, and the stories are those of the wrapper (`BookingTable` in
  `table.stories.tsx`).
- A component that moves the focus after a press is also shown the change
  that no press asked for. The wrapper of its story has a second button
  that makes it, and the test presses that one with `fireEvent.click`,
  which moves no focus as `userEvent.click` would: the focus must be where
  it was (`booking-list.test.tsx`, `salon-results.test.tsx`).
- A story reaches a state that needs a step with a `play` function, and
  `Story.run()` runs it. Inside it, use `userEvent` imported from
  `storybook/test`; the context of a composed story has `canvas` but no
  `userEvent`. A play function shared by stories is a constant of the type
  `NonNullable<Story['play']>`.
- A state that only other props reach is a story of its own, not a second
  `render` in the test: `storybook/test` has no `render`, and a test that
  draws a component by itself leaves the catalogue without that state
  (`WithChoiceRefused` in `form.stories.tsx`).
- What moves the focus inside a dialog is shown by a story that gets
  there as a screen does: a dialog that is not open yet takes no focus,
  so a story that is drawn with the errors of a form already in its args
  shows them without the focus. The story draws the dialog open, and its
  `play` function sends the form; a wrapper then hands over what the
  screen would say (`Answering` in `review-report.stories.tsx`).
- A button that is on or off is found by its state
  (`getByRole('button', { pressed: true })`); one that was found by its
  name is asserted on the attribute
  (`toHaveAttribute('aria-pressed', 'true')`), and a button that is
  neither on nor off has none. A heading that takes the focus is asserted
  with `toHaveFocus()` and `tabindex='-1'`.

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
end: `frontend/apps/portal-app/src/salons/salons-api.test.ts`. The answers
such tests make up are one module of the application
(`frontend/apps/portal-app/src/__tests__/api-answers.ts`: `problem`,
`record`, `page`, `answering`, and `asked` and `sent` for what a function
asked for).

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
- **Files** go to an object storage: the test server starts a SeaweedFS
  container, which its APIs share, and an API signs URLs to it. A screen
  test uploads a file through the screen (`user.upload` with a `File` of
  real bytes: the API looks at the first bytes) and reads it back with
  `fetch` from the `href` of a link. `user.upload` drops a file the
  `accept` of the control does not name: a test of a kind the API
  refuses sets the user up with `applyAccept: false`, as a person who
  asks the dialog of the browser for every file. The `FormData` of a
  form in jsdom does not hold the file `user.upload` chose: a screen
  keeps the file from the change of the control.
- The answer of the real API takes time. Wait for what appears (`findByRole`,
  `waitFor` of `@testing-library/react`); never for a duration. The setup
  lets them wait 5 seconds, not the 1 of Testing Library, and a test 30:
  checking a password (argon2) takes more than a second on a runner that
  runs other tests besides. `vi.waitFor` of Vitest does not read that
  setting and gives up after 1 second: it is not used against the API. The
  tests of the stories call no API and keep the 1 second.
- Two answers come in either order. A screen that is shown without a
  session (the search and the page of a salon) can be there before the API
  has said who is signed in, and the links of the header come with that
  answer: find them (`await screen.findByRole('link', …)`) before pressing
  them. A screen that needs a session shows nothing before it, so what it
  shows brings the header along.
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
  API takes as well) or with a backup code. A test of the screen that sets
  it up takes the secret the screen shows (its `code`, without the spaces):
  that the API takes the code made from it is what shows that the screen
  showed the secret of the account. A code the API refused counts as a
  wrong attempt until a sign-in succeeds (`failedLoginAttempts`).
- **A link of the page that the header has as well** is found inside the
  page. A customer who is signed in has 「サロンを探す」 in the navigation
  of the header, and so has the page that leads back to the search:
  `within(screen.getByRole('main')).getByRole('link', { name })`.
- **What an `Alert` says** has its role on the element around the text
  (`alert` for `danger`, `status` for the others): find it by the role
  (`findByRole('alert')`), or read the texts of the regions of `main`,
  and do not ask the element of the text for its role.
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
  same for one record. A write is refused by a trigger that raises an
  exception (`before delete on sessions`, `before update of "passwordHash"
  on users`: `refuse` in
  `frontend/packages/session/src/security/security.integration.test.tsx`),
  where taking the table away would also refuse the session of the
  request. The fresh database after the test undoes all of them.
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
- **A list that grows in steps is read when it is whole.** The rows of a
  list that reads the names of what its records name arrive as the names
  do, and its button is busy until then: wait until no button of the list
  is busy before the rows are counted or read
  (`listNamed` in `own-bookings.integration.test.tsx`).
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
- **What the tests of several screens arrange is one module**:
  `src/bookings/__tests__/arrangements.ts` has the names of the seed data,
  who is signed in, the day and a booking made through the API, for the
  tests of the screen that books and of those that list, cancel and move.
  The browser tests have theirs in `frontend/e2e/src/bookings.ts`.
- **The times a screen must offer follow from the rows of the staff, too.**
  A booking takes its member of the staff from `bufferTimeBefore` before
  it until `bufferTimeAfter` after it, and a member of the staff may take
  more than one booking at once (`maxConcurrentBookings`). A time that
  somebody else took first is arranged with a member of the staff who
  takes one at a time.
- **What a write changed is asserted in the commit that shows it again.**
  The test reads the list, changes a record on its page and goes back. A
  list that showed first what it had read before, and the new word after
  reading again, passes a test that waits for the new word, and at times
  one that looks at the list as soon as it is there (`firstSight`,
  below). The list of the bookings is not
  kept after a write, so the commit that shows it again says that the
  bookings are being read (`expectListReadAnew`).
- **What must be read again is tested with what the application keeps.**
  The `QueryClient` of a test reads everything again whenever it is shown;
  the one of an application (`main.tsx`) keeps what it read for five
  minutes. A screen that sets `staleTime: 0` for what somebody else
  changes is rendered with a client that has the `staleTime` of the
  application (`asTheApplicationKeeps` in
  `own-bookings.integration.test.tsx`), the record is changed with a
  statement, and the screen is shown again: it must say what is stored
  now.
- **What the salon did meanwhile is a statement.** The booking begins
  while the dialog asks: `update bookings set status = 'in_progress', …`
  between opening the dialog and confirming. The refusal the screen then
  gets is the real one.
- **A list is asserted against what is stored.** The rows the screen
  must show are read from the database in the order the screen gives
  them, and the times are worked out for the time zone of the salon: the
  test then holds on every day, and in whatever time zone it runs.

A form that changes a record
(`frontend/apps/portal-app/src/profile/profile.integration.test.tsx`) is
tested for what it must leave alone as well:

- **What somebody else wrote while the form was open stays.** The test
  opens the form, writes another column of the row with a statement
  (`salonWrites`), sends a change of one value, and asserts the row: the
  value that was changed, and the one the statement wrote.
- **A form that is sent as it was opened writes nothing.** The row has
  the `updatedAt` it had before.
- **What a form opens with** is tested with what the application keeps
  (`asTheApplicationKeeps`): the page reads the record, a statement
  changes it, and the form that is opened through its link must hold what
  is stored now. The value of a control is found with
  `findByDisplayValue`; `findByText` does not see it.
- **That nothing is read behind a form** is tested with the managers of
  TanStack Query: `onlineManager.setOnline(false)` and then `true`,
  `focusManager.setFocused(false)` and then `true`. A read that they
  start begins a moment later, and a test cannot wait for what must not
  happen. So the table is taken away, `fetch` is watched, and the form is
  sent: when its failure is said, a read behind the form would have been
  asked for long before. The requests about the record are then the one
  of the form (`askedOfTheProfile(fetched)` is `['PATCH']`), and what was
  typed is still there. `afterEach` puts the managers back
  (`focusManager.setFocused(undefined)`, `onlineManager.setOnline(true)`).
- **What a write made is asserted in the commit that shows the next
  screen.** A page that showed first what it had kept (nothing, or the
  record as it was) and the new record after reading it again would pass
  a test that waits for the record. At times it passes a test that looks
  as soon as the heading of the page is there as well: a `findBy…` and an
  event of `userEvent` each let a moment pass, and the answer to one
  request can arrive in it (with the wrong change in place, it had
  arrived in two runs of three). So the component beside `App` that keeps
  the address also keeps, from a layout effect, what `main` said in the
  commit that showed that address (`firstSight`), and the test asserts on
  it:
  `expect(firstSight).toEqual(['/mypage', expect.stringContaining('お名前Sato Yuki')])`.
- **A reading the first sight races is held.** When a screen shows what
  it kept while it reads the record again, the answer comes before or
  after the next screen opens, as the machine is loaded. The test holds
  that reading until it has asserted the first sight
  (`holdReadingsOf` in `customer-points.integration.test.tsx`: `fetch`
  keeps the request to the record waiting, and sends it to the real API
  when the test releases it). The API still answers everything; only
  when is fixed, so the test fails every time the screen shows the old
  value, not once in a while.
- **A record that is gone is made gone as the API does it.** The
  statements are those of the repository (a customer who was removed from
  the ledger has `deletedAt`, and the account no longer names it:
  `users."customerId"` is `null`), not a guess at what would make the
  read fail.
- **A refusal the screen cannot bring about is not tested here.** A form
  that sends nothing the API refuses never gets the answer that names a
  value. What the form says then is tested where the answer can be made
  up (the pure function, and the function that calls the API), and the
  comment at the top of the integration test says what is missing from
  it, and why.

A form with rows and with choices that it reads
(`frontend/apps/portal-app/src/preferences/preferences.integration.test.tsx`)
adds:

- **What a test starts from is written as somebody writes it.** What the
  customer said before is their own request with `fetch` and their access
  token (`prefers`); what a salon does meanwhile is the request of an
  administrator (`salonWrites` for its ledger of the customer, `leaves`
  for a member of the staff it no longer shows). A statement is kept for
  what no request does: a table that is away, a row removed in a way the
  API refuses.
- **What a form offers is asserted against the database**, in the order
  the form gives it (`staffOffered`: the `order by` of the API). The seed
  data wrote the staff at one moment, so their order is another one in
  every database, and no order is written into the test. For the same
  reason the first control with an error in such a group is
  `getAllByRole('checkbox').at(0)`, not the box of a name.
- **A refusal the screen can bring about is tested here.** The form sends
  what was changed and nothing else, so the API compares it with what is
  stored: a salon stores a member as one to avoid after the form opened,
  the customer wishes for that member, and the answer names the control.
- **The requests of a form that reads several things** are asserted with
  their method and path (`askedOfTheApi(fetched)`): nothing behind the
  form is `['PATCH /customers/me/preferences']`.
- **A state of a part that a page cannot be opened in** (the part of an
  account that lost its profile after the page read it) is tested on the
  part alone, rendered inside the providers it stands in.

What a customer wrote, listed with what can be done with each, changed
and removed (`frontend/apps/portal-app/src/reviews/`) adds:

- **The tests of an area may be several files with one module of
  arrangements** (`__tests__/arrangements.tsx`: the application at an
  address with `firstSight`, the seed data the tests name, what they ask
  of the database and of the API, what they read on a screen). One file
  per thing that is done (`review-writing…`, `own-reviews…`), and one for
  who the screens are for and where they stand (`review-screens…`:
  `describe.each` over the screens, with somebody who is not signed in,
  an account of another role, the link of the header that is current and
  the title of the document). Every file has an API and a database of its
  own, so they run side by side.
- **A record the seed data has in one state is looked for, not named.**
  `visitToReview()` is the visit of the customer that took place and has
  no review, `visitReviewed()` the one that has: a statement finds them,
  and fails the test at the arrangement when the seed data has none.
- **Who does something meanwhile asks the API in their own name**: the
  customer in another tab (`writes`, `changes`, `removes`), the owner of
  the salon (`answers`), an administrator (`removes(id, ADMIN)`). Each
  asserts the status it expects, so an arrangement that the API refused
  fails there. A statement is kept for what no request does, and its
  comment says why (`staffIsRemoved`: the API refuses to remove a member
  who has a booking to come).
- **Rows in numbers follow the rules of the rows.** A visit has one
  review, so thirteen reviews are twelve more visits with a review each
  (`insertReviews`, one statement that inserts both), dated so that their
  order is known.
- **A row may hold a list.** `getAllByRole('listitem')` in a list gives
  the items of the lists inside its rows as well (the pictures of a
  review): the rows are the items whose parent is the list
  (`item.parentElement === list`). A browser test finds them by what a
  row alone has (`filter({ has: page.getByRole('heading', { level: 2 }) })`).
- **What a change was sent with is asserted on the request**
  (`sentWith(fetched)`, the bodies `fetch` was called with): the
  properties that were changed and nothing else, with `toEqual`. The row
  says what is stored; only the request says what was left out.
- **Every screen a write shows differently is asserted at first sight**:
  after a review was written, the list of what the customer wrote says
  that it is being read, the page of the booking says the review without
  reading (`expect.stringContaining` of its title, and not the sentence
  it said before), the page of the salon and the search that found the
  salon say nothing of what they had read (the count of its reviews is
  one more when they have read), and the form of the same visit, opened
  again, shows no form before the visit is read anew. Each is reached as
  a person reaches it, through links, with the client that keeps what it
  read (`asTheApplicationKeeps`).
- **A removal is asserted in four places**: what is said, the row that is
  no more, the rows that stay with their count, and the focus on the
  heading of the screen.
- **An error at a group of radio buttons** is asserted on the group
  (`toHaveAccessibleDescription`) and the focus on its first button.
- **A value too long to type is set** (`fireEvent.change` with 256
  characters): `userEvent.type` presses every key.
- **A parameter of a test file is never called `after` or `before`.**
  Biome takes a call of such a name inside a test for a hook
  (`noDuplicateTestHooks`).
- **What an account did before is asked of the API, not looked for in
  the seed data, where the seed data does not say whose it is.** The
  reports of the seed data are of whichever account the database returns
  first, and differ from one seeded database to the next. A test of
  `review-readers.integration.test.tsx` makes its own: the customer finds
  a review helpful (`findsHelpful`), reports one (`reports`), an
  administrator dismisses the report (`dismissesReportOf`). The review it
  acts on is one the account has done nothing with (`untouchedBy`).
- **Somebody who is offered nothing has nothing to wait for.** A test
  that asserts that a reader has no buttons first waits for what decides
  it: the name of the account in the header for a role, and for an
  account without a profile the read of the profile, in a `QueryClient`
  the test made (`client.getQueryData(OWN_PROFILE)`).
- **One press changes a count by one**, so it can make or break a tie
  and nothing else. A test of an order that must not change arranges a
  tie, reads the order from the screen, and presses for the last of the
  two; with the client that keeps what it read, the same test then sees
  the order read again when it is next chosen, and the other orders never
  as they were read before.
- **A press that the API counts is asserted in three places**: what the
  row says, the row of the table (who, and the count of the record), and
  the requests (`askedOfTheReviews`: the one that wrote, and no read
  after it).
- **A screen of a package that every application uses is tested in the
  package** (`frontend/packages/session/src/security/security.integration.test.tsx`):
  in `AppShell` and `RequireSession` as an application has them, without a
  router. What it hands to the application is a `vi.fn()` (`onChanged`),
  and asserted. The tests of an application add what it does with them:
  where they are, for whom, and the ways between them
  (`frontend/apps/portal-app/src/security/security.integration.test.tsx`,
  the header of `App.integration.test.tsx` of the admin and the dashboard
  application).
- **Another device is another session of the API.** It signs in through
  the generated client (`authCrudLogin`), which stores nothing: the
  browser of the test stays signed in as it was. Twenty more devices are
  rows the test writes (`insert … generate_series`), one an hour, so their
  order is known; a device that signs out while the screen shows it is a
  row the test deletes.
- **"Nothing was sent" is asked of `fetch` itself**: `vi.spyOn(globalThis,
  'fetch')`, which calls the real one, cleared once the screen has read
  what it reads (`mockClear`), and then `not.toHaveBeenCalled()`.
- **What the real API cannot be made to answer stays out.** A part of a
  screen behind the session that cannot be read is not brought about by
  taking a table away when that table also holds the sessions: the
  request is then refused as one without a session. It is in the test of
  the functions that call the API and in the stories. A write that fails
  is brought about, by a trigger.
- **A screen that reads again after a write is asserted at once and in
  the end.** Right after the write, nothing of what was read before is on
  the screen (`queryByText` of the old count is `null` in the commit that
  shows the screen again); then what was read anew (`findByText`). A page
  that was full is filled again from the rows after it: 21 devices, one
  of the first page signed out, and the page shows 20 with no
  「さらに表示」, which only a list that was read again does.
- **A wait for a text waits for the whole text.** `toHaveTextContent`
  takes a part of it: 「21 台の端末でサインインしています」 is in
  「21 台の端末でサインインしています（20 台を表示しています）」, and a
  wait for the first is over before the next page came. Wait with
  `findByText`, or compare `textContent` with `toBe`.
- **What a screen reads with two requests comes in either order.** The
  security of the account reads the account and the devices apart: that
  the devices are listed says nothing of the account. Wait for each part
  that is asserted (`findByRole`), not for one of them.
- **A change made elsewhere is a row the test writes**, between what the
  screen read and what it sends: the second factor turned off on another
  device is an `update` of `users` that clears the state, the secret, the
  last step that was used and the backup codes together (a check of the
  table ties them), and the screen then meets the 409 of the API.
- **The stand-in for the dialog of jsdom gives no focus back, and leaves
  the page behind it as it was.** That a closed `Dialog` gives the focus
  to the button that opened it, and that a screen moves the focus out of a
  dialog it closed, are asserted in a browser test: in jsdom the focus
  reaches a heading behind a dialog that is still open, which a browser
  refuses (`admin-bookings.e2e.test.ts` found it).

The bookings of a salon in the admin application
(`frontend/apps/admin-app/src/bookings/`, three files: the start and the list
of a day, a booking and its operations, and the bookings the salon puts in,
changes and removes) add:

- **A record in a state is a row the test writes, with what the operation
  that led to it writes.** `arrange({ day, at, status })` of
  `__tests__/arrangements.ts` inserts a booking and its line in one
  statement, on a day relative to today in Tokyo
  (`(now() at time zone 'Asia/Tokyo')::date + n`). A cancelled booking has
  `cancelledAt`, a completed one `completedAt`, one in progress
  `actualStartTime`: checks of the table tie them, and a statement that
  leaves one out fails at the arrangement. The seed data has no booking
  today, so the list of today is what the test wrote; a day the seed data
  has (the visit nobody came to, yesterday) is asserted as the seed data
  has it.
- **Many rows are one statement** (`arrangeMany(day, 55)` with
  `generate_series`), ten minutes apart, so their order is known.
- **An account of a salon role that belongs to no salon** is the account
  whose link to the staff was undone (`update users set "staffId" = null`).
- **A customer who was removed** has `deletedAt`: the batch of the
  customers is refused, the screen reads them one by one, and the test
  asserts the name it then shows and that the row still leads to its
  booking.
- **The focus on the heading of a screen is asserted once the screen
  shows what it read** (the name of the salon, the state of the booking).
  A heading found while the screen still loads may be drawn anew when the
  content comes, without the focus; a browser test, which waits until the
  heading has the focus, failed where the test that looked at once passed.
- **What an operation wrote is asserted in the row** (`storedBooking`: the
  state, the times in UTC, who cancelled, the reason). A dialog that sends
  nothing leaves the row as it was (`toEqual(before)`).
- **Who changed the booking meanwhile is a statement** (the customer
  cancelled it; the treatment began): the screen meets the real 409.
- **What refers to a record is a row the test writes** (a review of the
  booking, with the columns it needs): the removal meets the real 409. A
  member of the staff who is taken is a booking the test writes for them,
  so the check of the members and the creation meet the real answer.
- **A line that a test needs is a row the test writes, with the booking
  summed up as the ledger would** (`addLine`: the booking ends with its
  last line and costs what its lines cost), so that a move, an addition or
  a removal sums up again from a booking the API could have written. A
  line taken away meanwhile is a statement as well: the removal meets the
  real 409 of the last line.
- **A refusal the screen explains by reading again is asserted at the
  part that explains it**: the overlapping booking under the line where
  the move would put it, the sentence of the state of a booking that began
  meanwhile, and the row unchanged (`storedLines`, `storedBooking`).
  What only a fake answer brings about (a check that could not be made
  after the refusal, every member free) is a test of the function that
  calls the API (`bookings-api.test.ts`).
- **A booking the screen made is read by the ID of the address it led to**
  (`storedBooking`, `storedLines` with the beginnings on the clock of the
  salon), and the count of the bookings says that a refused one made none.
  A browser test that reads the bookings of a seeded customer leaves out
  those that were there before it began (the seed data has bookings of
  every customer).
- **That only what was changed is sent is asked of `fetch`**: the bodies of
  the `PATCH` requests, parsed (`changesAsked`); nothing changed is no
  request at all.

The sales of a salon (`frontend/apps/admin-app/src/sales/sales.integration.test.tsx`:
the checkout of a booking, the payments and the receipt of a sale, the
ledger) add:

- **A sale is a row the test writes from its booking**
  (`arrangeSale` of `sales/__tests__/arrangements.ts`: the lines of the
  booking at their prices, in one statement). The seed data has no sales.
  A sale voided or paid meanwhile is a statement (`voidSale`, `paySale`),
  between what the screen read and what it sends: the screen meets the
  real 409.
- **A tax that is not in the price is a statement** on the line of the
  booking and on the service that is added (`"taxIncluded" = false`, and a
  price that leaves a yen over when the tax is shared): the seed data
  prices everything with the tax in it, which leaves nothing to share.
- **A sale the screen made is read by its booking** (`storedSaleOf`: who
  it is for, who took it, its lines in their order with their tax), and
  the payments by their sale (`storedPaymentsOf`).
- **The page of a sale is waited for part by part** (`theSale`: the
  heading, then the table of the lines): the number of the sale is below
  the heading as soon as the sale is read, the rest once the payment
  methods are.
- **Printing is asked of `window.print`**, stubbed with
  `vi.spyOn(window, 'print').mockImplementation(() => {})`: jsdom prints
  nothing. What paper shows is a browser test.

The change, the refund and the voiding of a sale
(`frontend/apps/admin-app/src/sales/sale-changes.integration.test.tsx`)
add:

- **A payment given back meanwhile is a statement** (`refundSale`: the
  payments and the state of the sale in one statement, since a check of
  the table ties the state of a payment to the amount given back), and
  `paySale` answers the ID of the payment it made, for the address of its
  refund.
- **What only a role is refused is asserted at the address as well**: the
  address of a refund, opened by a member of the staff, says who may.
- **The focus after a voiding is asserted on the heading of the part that
  stays**: 「売上」 when the sale was voided, 「取り消し」 when the voiding
  was refused because it was paid meanwhile.
- **A record and what was given back are read by the sale**
  (`storedRecordOf`: the member, the time on the clock of the salon, the
  day, the note, the voiding; `storedRefundsOf`).

The ledger of the customers
(`frontend/apps/admin-app/src/customers/customers.integration.test.tsx`)
adds:

- **Rows written at one moment come in no order of their own.** The seed
  data registers its customers at once, so the names of a list are
  compared sorted (`namesIn`); an order is asserted where the test gave
  the rows moments of their own (`registeredDaysAgo` of
  `customers/__tests__/arrangements.ts`: noon in Tokyo, so many days ago),
  the latest first.
- **A range of days is asserted at both ends**: the rows of its first and
  of its last day are both found (the end of a day is the millisecond
  before the next one begins).
- **A value that another record holds is a statement** (`giveReferralCode`),
  and an address of mail of the seed data written in capitals is the same
  address: the screen meets the real 409 and says it at its control.
- **What another salon wrote meanwhile is a statement between the read
  and the send** (`writeNoteMeanwhile`), and the stored row keeps it after
  the change (`storedCustomerOf`); nothing changed leaves `updatedAt` as it
  was.
- **What another feature writes is a statement** (`arrangePreferences`:
  the preferences of a customer with members of the staff, one of them
  removed since), so that the names and 「一覧にないスタッフ」 are asserted.
- **What is counted is asserted from the seed data**: the bookings of a
  seeded customer at the salon over the year up to today (a visit and a
  no-show), and another period from the address.
- **A page of parts that read on their own is waited for part by part**
  (`theCustomer`: the heading, the record, then a term of each part).
- **A list the API orders by a moment the seed data gave several rows**
  is in the order of their IDs, which differ from one seeding to the
  next: the order a test expects is read from the database as the API
  orders it (`staffShownAt`: the staff of a salon, by `createdAt` and
  `id`), never written out.
- **A choice made in a dialog is searched and pressed inside the dialog**
  (`chooseReferrer` of `customers.integration.test.tsx`), and what the
  API refuses of it is made between the choice and the send
  (`removeMeanwhile` of the customer who was chosen).
- **A write that the API keeps a version of is arranged with its
  version.** What another account wrote meanwhile is a row written by SQL
  and a version as the API keeps one: the next number, the values the row
  has then, the account that wrote it, the moment it was written
  (`recordVersion` of `customers/__tests__/arrangements.ts`). A screen
  that reads the history to tell what became of a record (a removed
  customer) is told nothing by a removal without its version. A history
  of more versions than a page is arranged the same way, a minute apart.
- **A screen that swaps what it shows at one address** (a customer
  removed, then brought back) is asserted on both sides: the heading has
  the focus, the notification is there, and the row is asserted in the
  database (`isInLedger`). What a list showed at first sight after the
  swap (`firstSight`) is asserted without the notification, which names
  the record too.
- **A ledger that keeps a running balance is arranged with its balance.**
  Each transaction written by SQL has the balance after it, the opening
  balance of the seed comes first (`openedLongAgo`), and the balance the
  ledger keeps is the last one (`arrangePoints` and `arrangeVisitPoints` of
  `customers/__tests__/arrangements.ts`): a screen that reads the balance
  from one place and the history from another shows the same numbers. A
  write is asserted by its row and by the balance (`storedPointsOf`,
  `storedBalanceOf`).
- **A refusal the screen explains by reading again is brought about for
  each reason** (a sale with its points already, a sale voided between
  the opening of the form and the send, a balance too small), and a value
  the form refuses is asserted unsent by the requests of the `fetch` that
  was spied on.
- **A file is written by the test, as a spreadsheet saves it** (the mark
  of the byte order, CRLF: `fileOf` of `customer-bulk.integration.test.tsx`)
  and chosen with `user.upload` in jsdom, `setInputFiles` with a buffer in a
  browser. A file read in the browser is waited for until the screen stops
  saying it reads it; a file that is refused is asserted unsent by the
  number of rows of the table (`storedCustomerCount`).
- **A write of many is asserted on those it left alone too**: their row
  equals the row read before the test acted, `updatedAt` included
  (`storedCustomerOf`), which shows they were not sent.
- **The text of a row holds the hidden label of its checkbox.** A row of
  a table read by `textContent` (`rowsOf`) has 「山田 花子 様を選ぶ」 in the
  cell of the choice: write it out in the expected row.
- **What the API refuses is arranged as the API would have kept it**
  (`askedForErasure`, `arrangeChart`, `keepBalance` of
  `customers/__tests__/arrangements.ts`), so the screen says why before
  anything is sent; the same row arranged after the screen read the two
  (`customer-merge.integration.test.tsx`) is the 409 of the API, which
  the screen answers by reading again.


`App.test.tsx` of an application keeps what needs no API: what somebody who
is not signed in sees. Everything behind the sign-in is in
`App.integration.test.tsx`, and so is a route whose screen reads from the
API as soon as it opens (the root of the portal).

The test server needs a PostgreSQL: the one at `TEST_DATABASE_URL` when it is
set (its user creates databases), otherwise a container. It always starts a
SeaweedFS container for the files of its APIs, and so needs a running Docker
daemon. When it cannot start, the run fails before the first test and
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
  what gives the API a fresh database after every test, and it keeps the
  browser from reaching anything outside this machine (the seed data has
  photos at addresses of example.com): the applications and the API, on
  127.0.0.1, and the storage of the test server, at `localhost`. A test
  chooses a file with the keyboard by pressing Space on the control and
  answering `page.waitForEvent('filechooser')`
  (`src/admin-attachments.e2e.test.ts`). A test that needs an image at an
  address of the web answers it in the browser
  (`page.route(address, (route) => route.fulfill(…))`,
  `src/admin-treatment-photos.e2e.test.ts`): the API takes addresses of
  domain names only, so an address of the application under test will
  not do.
- The fixture `api` is what `testApi()` is in an integration test: `origin`,
  `seedPassword`, `query`, `authenticatorCode`, `mails` and `mailedLink`.
  `await page.goto(await api.mailedLink(email))` is the person pressing the
  link of a mail (`src/account.e2e.test.ts`).
- Elements are found as a user finds them: `getByRole`, `getByLabel`,
  `getByText`. No class name, no test ID. The locators and the steps that
  tests share are in `src/sign-in.ts` (`heading`, `enterCredentials`,
  `signOutButton`, and `registerNewcomer` for an account the seed data
  does not have: registered and confirmed through the API, without a
  profile); the applications, their origins and their titles in
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
- **A dialog is worked with the keyboard**: Enter on the button that opens
  it, the first control focused, Escape, the focus back on the button,
  and Tab through its actions in their order
  (`src/own-bookings.e2e.test.ts`). The page is checked with
  `expectSoundPage` while the dialog is open, too.
- **A dialog that has nothing to type** has the focus on its first button
  when it opens, and Tab goes on to the one that does what was asked
  (`src/reviews.e2e.test.ts`).
- **A name that is part of another name is asked for whole.** `getByRole`
  with a `name` finds every element whose name holds it: the link of a
  salon and, in the same row, the link whose `aria-label` begins with the
  name of the salon. `{ name, exact: true }` finds the one.
- **What a stylesheet draws on the parts of an element** is asserted where
  it is drawn: `toHaveCSS('text-decoration-line', 'underline')` on the
  part of a link that is a box of its own, found by its text inside the
  link.
- **What several files arrange** is a module beside them
  (`src/bookings.ts`: the day, a booking made through the API with the
  `request` fixture, the locators of the booking screens; `src/mypage.ts`:
  the locators of the page of a customer and of its forms). What one file
  alone arranges stays in it (`src/reviews.e2e.test.ts`: the visits of two
  customers, what a customer and the owner of a salon ask of the API).
- **A form is taken through with the keyboard**
  (`src/mypage.e2e.test.ts`): Tab from control to control in the order
  they are read, Space on a box, and Enter in a control that holds text
  sends the form.
- **Controls that share a row where there is room** are asserted by where
  they are (`boundingBox()`): the same `y` at the width of a desk, the
  same `x` and one below the other at 390px.
- **A control beside one that says an error** is asserted the same way,
  in the state with the error: the same `y` and the same `height`
  (`expectRowOnOneLine` in `src/preferences.e2e.test.ts`). A field that
  is drawn out to the height of its neighbour passes every other check.
- **Rows that are added and taken away** are worked with the keyboard
  (`src/preferences.e2e.test.ts`): Enter on the button that adds a row and
  the focus on the first control of the new row, Enter on the button of a
  row and the focus on the button that adds one, and the values of the
  rows that stay. A time is entered with `fill('18:00')`: the keys a time
  control takes depend on the language of the browser.
- **Enter in a `textarea` begins a line**, and in a control of one line
  sends the form: a form with both is tested for both.
- **A value no line can be broken in** is written with a statement before
  the page is opened: a browser breaks a line at a space and after a
  hyphen, not at an underscore. `expectSoundPage` then says whether it
  sticks out.
- A radio button among many is found by its whole name
  (`getByRole('radio', { name: '10:30', exact: true })`), and the keyboard
  is taken through the group as a person takes it: Tab to the group, Space
  for the first, the arrow keys for the next. From the first button, the
  arrow up is the last.
- **A form in a dialog is worked with the keyboard from where the browser
  puts the focus**: the first control when the dialog opens, then Tab
  through the controls to the buttons, each stop asserted
  (`tabToTheSendButton` in `review-readers.e2e.test.ts`). After the
  dialog closed, the focus is on the button that opened it; after a
  second attempt that left one button, on that button; after the row
  went, and the dialog with it, on the heading of the part, and the next
  press of Tab is asserted too: it shows that the page behind the dialog
  is in use again.
- **How a state looks is asserted against the same control before it had
  the state**: the surface of a button that is pressed is not the surface
  it had (`surfaceOf` in `review-readers.e2e.test.ts`). A colour is never
  written into a test, and it is read when the control has stopped
  changing: the answer has arrived (`aria-busy` is gone: a button that
  waits has a colour of its own) and the transitions have ended
  (`element.getAnimations()`, each `finished`). `not.toHaveCSS` is the
  wrong tool: an assertion that something is not so passes at the first
  look, on a colour on the way. The pointer is moved out of the way
  first (`page.mouse.move(0, 0)`): it stays where the last click left
  it, a notification moves the page under it, and the control that lands
  there has the colour of one that is pointed at.
- **Another device is another browser**: `browser.newPage()` opens one
  that shares nothing with `page` (`src/security.e2e.test.ts`). When its
  session was ended elsewhere, a reload shows the sign-in screen.
- **A password that was changed is asserted at the next sign-in**: out in
  the header, the old password refused, the new one taken. So is a second
  factor that was set up: out, and in with the code of the next 30
  seconds.
- **A dialog with a form opens at its first control**, which the browser
  gives the focus (`src/two-factor.e2e.test.ts`); one without a form at
  its first button. Closed, it gives the focus back to the button that
  opened it.
- **The browser may be in another time zone than the salon.** A test
  that says so has `test.use({ timezoneId: 'Pacific/Honolulu' })`
  (nineteen hours behind Tokyo, most of the time another day), and asserts
  the day of the salon, its times and the moments the API stored
  (`src/admin-bookings.e2e.test.ts`).
- **The first screen of the admin application is the bookings of a salon**
  (`ADMIN_START` of `src/sign-in.ts`): a test that only signs in waits for
  that heading.
- **What is printed is looked at as a printer gets it**:
  `page.emulateMedia({ media: 'print' })`, then the document is visible and
  the frame, the notifications and the controls are hidden
  (`src/admin-checkout.e2e.test.ts`). A heading that took the focus while
  the document was read keeps it once the document is shown: asserted
  with `toBeFocused()` after the document is there.
- **A way of several steps is walked in one test, in order**
  (`src/admin-sale-changes.e2e.test.ts`): the payment given back whole,
  the sale voided, the booking billed again, each asserted on the screen
  it leads to, and the database read once at the end.
- **A record the test makes is found by a value the test chose**
  (`src/admin-customers.e2e.test.ts`: the customer by the address of mail),
  and read after each write, also when the way crosses the screens of two
  ledgers (a booking search that found nobody, the registration, the
  booking of the customer, the ledger and the change).
- **A radio button is chosen with the keyboard**: the focus on it and
  Space, as a person does who goes through the group with Tab.
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
