---
name: frontend-ui
description: "How the frontend of this repository is styled and how its components are built: design tokens, CSS Modules, layout with CSS Grid (never flex), the shared component package @beauty-salon-frontend/ui with its form components (label, description, error), the frame of a screen (app shell, navigation, table, dialog, notifications), how a form calls the API, how a screen reads from the API (a search kept in the address, a list that goes on, the parts of a page), how a screen writes what it read (a choice kept in the address, what is offered read anew, a refusal), the screens that need a session (sign-in, roles), the screens that a mailed link opens and the Storybook. Use it before adding or changing a component, a form, a stylesheet, a token, a story or the markup of a screen under frontend/."
---

# Frontend UI

Styles are CSS Modules over design tokens, layout is CSS Grid, and components
that more than one application uses live in one package. A check enforces the
rules that can be checked, so a mistake fails a test instead of passing review.

Tests are the subject of the skill `frontend-testing`. Read it together with
this one: a component is not done without its stories and its test.

## Where things are

| What | Where |
|------|-------|
| Tokens (custom properties) | `frontend/packages/theme/src/tokens.css` |
| Reset and the styles of bare elements (body, headings, links, the focus ring) | `frontend/packages/theme/src/reset.css`, `global.css` |
| The check of the style rules | `frontend/packages/theme/src/style-rules.ts`, run by `style-rules.test.ts` over every package and app |
| The contrast of the colour tokens | `frontend/packages/theme/src/tokens.test.ts` |
| Shared components | `frontend/packages/ui/src/components/<name>/` |
| The screens of the session: sign-in, the guard of the screens that need one, the account in the header | `frontend/packages/session/src/` |
| The screens of an account in the portal: registering, a new password, and the screens that a mailed link opens | `frontend/apps/portal-app/src/account/` |
| The screens of the salons in the portal: the search and the page of a salon, and the components they show | `frontend/apps/portal-app/src/salons/` |
| The screens of a booking in the portal: choosing the member of the staff, the day and the time, the page of a booking, the bookings of a customer, and cancelling and moving one | `frontend/apps/portal-app/src/bookings/` |
| The links of the header of the portal, by who is signed in | `frontend/apps/portal-app/src/navigation.ts` |
| The catalogue (Storybook), of the components of `ui`, of `session` and of the applications | `frontend/packages/ui/.storybook/`, `pnpm --filter @beauty-salon-frontend/ui run storybook` (port 6006) |
| The routes of an application, inside the shared frame `AppShell`, and the roles it is for | `frontend/apps/<app>/src/App.tsx` |

An application imports one stylesheet, in `src/main.tsx`:
`@beauty-salon-frontend/theme/styles.css` (tokens, reset, bare elements). A
component brings its own styles, so importing `Button` is all it takes.

## Styling rules

The name in brackets is the rule of `style-rules.ts` that fails when the rule
is broken.

1. **CSS Modules only.** A component has its styles in `<name>.module.css`
   beside it. No Tailwind, no utility classes, no CSS-in-JS, no class name
   written as a string in the markup (`no-tailwind`, `no-literal-class-name`).
2. **Layout is Grid.** `display: grid` or `inline-grid`; no `flex`, no
   `inline-flex`, no `flex-*` property, in a stylesheet or in a `style`
   attribute (`no-flex`). The usual shapes:

   | Shape | Grid |
   |-------|------|
   | Stack with even gaps | `display: grid; gap: var(--space-4)` |
   | Items in a row | `display: grid; grid-auto-flow: column; justify-content: start; gap: …` |
   | Content, then something pushed to the end | `grid-template-columns: minmax(0, 1fr) auto` |
   | Side panel and content | `grid-template-columns: auto minmax(0, 1fr)` |
   | Header, content that takes the rest | `grid-template-rows: auto minmax(0, 1fr)` |
   | Centred | `display: grid; place-items: center` |
   | Cards that wrap | `grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr))` |
   | Label and value pairs | `grid-template-columns: max-content minmax(0, 1fr)` |
   | Rows that share their columns | The list is the grid; a row is `display: grid; grid-template-columns: subgrid; grid-column: 1 / -1` |

   Write `minmax(0, 1fr)`, not `1fr`, for a track whose content may be long:
   a bare `1fr` grows with its content and overflows. A grid does not wrap
   items of different widths: a row that may not fit scrolls sideways
   (`navigation.module.css`), or becomes a column below a width. What
   follows each other like words (the tags of a salon, a rating with its
   date and a badge) is no layout: it stays in the flow of the text,
   `display: inline-block` with a margin, and goes on in the next line where
   the line ends (`tag-list.module.css`). The underline of a link does not
   reach into such a box: inside a link it gets `text-decoration: inherit`,
   and draws the one the link has (`booking-list.module.css`).
3. **A colour is a token.** No colour is written out outside `tokens.css`:
   no hex value, no `rgb()`, no `color-mix()` (`no-raw-color`). `transparent`
   and `currentColor` are allowed.
4. **Components read purpose tokens.** `--color-*`, `--space-*`, `--size-*`,
   `--radius-*`, `--shadow-*`, `--font-*`, `--line-height-*`, `--duration-*`.
   The raw scales `--palette-*` are read by `tokens.css` alone
   (`no-palette-token`). Spacing, radius and font size come from tokens too;
   `0`, `1px` for a hairline and percentages are written out.
5. **A custom property exists.** `var(--x)` names a token, or a property that
   the same stylesheet declares, or one that the component sets in a `style`
   attribute (`unknown-token`). A variant is a set of local properties that the
   base class reads, as in `button.module.css`:

   ```css
   .button {
     background-color: var(--button-surface);
     color: var(--button-text);
   }

   .primary {
     --button-surface: var(--color-accent);
     --button-text: var(--color-on-accent);
   }
   ```
6. **Classes and markup agree.** Every class a component reads is defined in
   its module, and every class a module defines is read (`unknown-class`,
   `unused-class`). The TypeScript configuration requires bracket access, and
   several classes are joined with `classNames`:

   ```tsx
   import { classNames } from '../../class-names'
   import styles from './button.module.css'

   <button className={classNames(styles['button'], variantClass[variant], className)} />
   ```
7. **Class names** are camelCase and say what the element is (`.label`,
   `.errorMessage`), or name the value of a prop (`.primary`, `.small`). A
   state is not a class: select the attribute that already says it
   (`:disabled`, `[aria-busy="true"]`, `[aria-current="page"]`,
   `[data-environment="staging"]`).
8. **Logical properties and relative units.** `inline-size`, `block-size`,
   `margin-inline`, `padding-block`, `inset-inline-start`; `rem` for sizes.
   Hover styles sit inside `@media (hover: hover)`. A stylesheet is written
   for a narrow screen first and widened with `@media (min-width: 40rem)` or
   `60rem`; a media query cannot read a token, so these two are written out.
9. **The focus ring is global.** `global.css` draws it for `:focus-visible`.
   A component does not remove an outline; it may move the ring with
   `outline-offset`.
10. **Only the theme uses cascade layers.** The reset is in the layer `reset`
    and the styles of bare elements in `base`. The stylesheet of a component
    is in no layer, so it wins over both in whatever order the stylesheets
    load, and it needs no extra specificity and no `!important` to do so.

### Adding a token

Add the purpose token to `tokens.css`, pointing at a palette value. For a
colour, add the pairs it is used in to `tokens.test.ts`: text on its
background needs 4.5:1, a border of a control or a focus ring 3:1. A token
nobody reads is removed.

## Components

- One directory per component: `<name>.tsx`, `<name>.module.css`,
  `<name>.stories.tsx`, `<name>.test.tsx`. File names are kebab-case.
- `export const Name = (props: NameProps) => …`, with `NameProps` exported.
  A component that wraps a native element extends `ComponentProps<'element'>`,
  passes the remaining props on and keeps a `className` it is given.
- The element comes before ARIA: `button`, `a`, `label` with `input`, `table`,
  `dialog`, `nav`. A control has an accessible name. What a sighted user sees
  as a state is also an attribute (`aria-busy`, `aria-invalid`,
  `aria-current`), and the stylesheet selects that attribute.
- A button has `type='button'` unless it is given another type.
- Variants are union types. Map them with a `Record<Variant, string | undefined>`
  or match them with ts-pattern and `.exhaustive()`.
- The rules of `CLAUDE.md` hold: no `any`, no type assertion, no type guard,
  no `throw`; `pnpm lint` fails on them. The meta of a story is annotated
  (`const meta: Meta<typeof Button> = { … }`), because `satisfies` is kept for
  Zod schemas.
- `@beauty-salon-frontend/ui` knows React and nothing else of the system: no
  API client, no router, no query library, no text of a business domain. Text
  comes in through props. The text of the interface is Japanese; the few
  words that belong to a component itself are in it (必須, 閉じる,
  本文へ移動, 読み込み中).
- A component that one application uses stays in that application, with the
  same four files, in `src/<area>/components/<name>/`
  (`frontend/apps/portal-app/src/salons/components/`). It only shows: what
  it shows comes in as props, and the screen around it reads it. The
  catalogue of `ui` shows its stories under the name of the application
  (`title: 'Portal/Salons/SalonHours'`), and the models its stories show
  are in one file beside the components (`examples.ts`). It moves to `ui`
  when a second application needs it.
- What several applications share and `ui` may not know has a package of its
  own. `@beauty-salon-frontend/session` is the one there is: it knows the API
  client and the query library, and builds its screens from `ui`. Its
  components are split in two. Those that only show (`SignInForm`,
  `SessionGate`, `AccountMenu`, in `src/components/`) take what they show as
  props, have the four files and are in the catalogue; those that know the
  session and the API (`SignInScreen`, `RequireSession`, `SessionAccount`)
  hand them their props and are tested against the real API.
- Export a new component and its props from `frontend/packages/ui/src/index.ts`.

## Form components

| Component | Use it for |
|-----------|------------|
| `TextField` | One line. `type` is `text` (the default), `email`, `password`, `tel`, `url`, `search`, `number`, `date`, `time` or `datetime-local` |
| `PasswordField` | A password that a person chooses. Its owner may look at it (「パスワードを表示する」) |
| `TextArea` | Several lines |
| `Select` | One of a list. `placeholder` adds a first option without a value |
| `RadioGroup` | One of a few choices that should all be in sight. `layout='columns'` for many short ones (the times of a day): as many columns as fit, and the arrow keys go through them in the order they are read |
| `Checkbox` | One thing that is so or not so |
| `Alert` | A message about the form or the page: `info`, `success`, `warning`, `danger` |
| `Form` | The form itself: its controls in one column, the message about the whole attempt, the button that sends it |

```tsx
<TextField
  label='メールアドレス'
  name='email'
  type='email'
  autoComplete='email'
  required
  description='予約の確認をお送りします'
  error={emailError}
/>
```

- **Every control has a `label`.** It is the accessible name of the control
  and the only text of the `label` element. The mark 必須 stands beside the
  label and is hidden from assistive technology, which hears `required` from
  the control itself. A placeholder is not a label.
- **`description` and `error`** are shown below the control and tied to it
  with `aria-describedby`; an `error` also sets `aria-invalid`. An error says
  what to do (「メールアドレスの形式で入力してください」) and is text, never
  colour alone. Pass `undefined` when there is nothing to say.
- **Everything else goes to the native control**: `name`, `value` or
  `defaultValue`, `onChange`, `autoComplete`, `required`, `disabled`,
  `readOnly`, `min`, `maxLength`. A component works with a value its caller
  keeps and with one the browser keeps, as the element does. `className` goes
  to the root of the field, for the container to place it.
- **The controls of the browser are used**: `select`, `input type='date'`,
  radio buttons. They bring the keyboard, the screen reader and the pickers of
  a phone. No dropdown or date picker is built by hand.
- **`autoComplete`** is given for what a browser can fill in: `name`, `email`,
  `tel`, `current-password`, `new-password`, `one-time-code`. The address a
  person signs in with is `username`, so that a password manager finds the
  pair.
- **A password that is chosen** is a `PasswordField` with
  `autoComplete='new-password'`. It can be shown, so it is asked for once:
  there is no second control to type it again. Its `description` says the
  rule of the API. What is typed is kept as it is: nothing is trimmed,
  capitalised or spell-checked. The password of a sign-in stays a `TextField`
  of the type `password`.
- **`Alert`**: `danger` interrupts (`role="alert"`), the other tones wait
  their turn (`role="status"`). Render it when there is something to say, not
  empty in advance.
- What is typed into keeps `--font-size-control` (16px): below that, iOS zooms
  the page when the control takes focus.
- A form is a grid: `display: grid; gap: var(--space-4)`. Fields that share a
  row are columns of it.

A new kind of field is built from the parts in `components/field/`: `Field`
(the label, the mark and the messages; the control is its child function and
is handed `id`, `aria-describedby` and `aria-invalid`), `control.module.css`
(the look of a control that holds text) and `choice.module.css` (a checkbox or
a radio button with its label). A group of controls uses `messageAttributes`
and `FieldMessages` directly, as `radio-group.tsx` does: the messages belong
to the group.

## A form that calls the API

The screens of an account in the portal are the example to read:
`frontend/apps/portal-app/src/account/` (`register-screen.tsx` is the
shortest).

```tsx
<Form
  submitLabel='登録する'
  message={says.message}
  errors={says.errors}
  pending={registration.isPending}
  onSubmit={submit}
>
  <TextField
    label='メールアドレス'
    name='email'
    type='email'
    autoComplete='username'
    required
    error={says.errors['email']}
  />
  <PasswordField
    label='パスワード'
    name='password'
    autoComplete='new-password'
    required
    description={PASSWORD_RULE}
    error={says.errors['password']}
  />
</Form>
```

- **The form shows, the screen decides.** `Form` of `ui` takes the controls
  as its children, `errors` (a message under the name of each control), a
  `message` about the whole attempt, `pending`, the `submitLabel` and
  `onSubmit`, and its stories are those states. The screen around it calls
  the API and decides what the form says. A form with steps or a layout of
  its own is a component of its own that takes the same properties and has
  its own stories: the sign-in form
  (`frontend/packages/session/src/components/sign-in-form/`, with
  `sign-in-screen/` around it).
- **The browser keeps the values.** The controls have a `name` and no
  `value`; the form hands over `new FormData(form)` when it is sent. Nothing
  is rendered again while a person types, and what the browser or a password
  manager fills in is read like what was typed.
- **Pure functions decide.** One reads the `FormData` into the request, or
  into the errors of the controls (`readRegistration` in `account-flow.ts`);
  one turns the outcome of the API into what the form says next
  (`afterRefusal`). They are tested without a screen. The function that
  calls the API (`account-api.ts`) never rejects: it answers with a sum type
  of the outcomes a screen tells apart, matched with `.exhaustive()`, so a
  new status of the contract is a type error, not a blank screen.
- **A status outside the contract is a failure, not an exception.** The
  fetch function resolves with every status, and a gateway in front of the
  API answers 502, 503 or 504 when the API does not: statuses no operation
  of the contract names. `.exhaustive()` throws on a value none of its
  patterns takes, so the function would reject, the form would say nothing
  and a screen that reads would wait for ever. Every match on the answer of
  an operation therefore ends with `.exhaustive(outsideTheContract)`
  (`frontend/apps/portal-app/src/outside-the-contract.ts`): the check of
  the types stays, and such an answer is `failed`. A match on a value of
  the application's own (an outcome, a variant) keeps the bare
  `.exhaustive()`: the code makes those values.
- **A control is named as the property of the request is.** What the API
  says about a value (`errors[].field` of the problem details) is then said
  at its control without a table of names.
- **Nothing is sent that cannot be right.** A missing value and a value of
  the wrong form are said at the control, with a message that says what to
  do. The form is `noValidate`: the bubbles of the browser show one message
  at a time and are not read to everyone. The server validates again, and
  the fields it names (`errors[].field` of the problem details) get their
  message the same way.
- **Where to go on.** After an attempt the focus goes to the first control
  that has an error. A message about the whole attempt is an `Alert` of the
  tone `danger` at the top of the form, which is read at once.
- **Sending** is a mutation of TanStack Query (`useMutation`). While it is on
  its way the button is `pending` (`aria-busy`), and a second press does
  nothing. What must happen after a success although the screen is gone by
  then (a notification) is in `onSuccess` of the hook, not of the call.
- **A message does not say more than the API does.** Signing in answers a
  wrong address and a wrong password alike, and so does the form.
  Registering and asking for a mail are answered alike for an address with
  an account and for one without, and the screen that follows says the same
  to both.
- **Only what cannot be right is checked before the API is asked**: a
  missing value, an address that is none, a password outside the lengths the
  API takes (counted as the API counts them). Whether a password is easy to
  guess is the API's to say; the form says it at the control.
- A form that stands alone on a screen is one column,
  `max-inline-size: var(--size-form-column)`.

## A screen that reads from the API

The screens of the salons in the portal are the example to read:
`frontend/apps/portal-app/src/salons/` (`salon-search-screen.tsx` for a
list, `salon-screen.tsx` for a record with its parts).

- **The functions that read never reject** (`salons-api.ts`). Each answers
  with a sum type of what a screen tells apart: what was `found`, `notFound`
  where the address may name nothing, and why nothing was read
  (`tooManyRequests`, `failed`). The statuses of the contract are matched
  with `.exhaustive(outsideTheContract)`, as those of a form are ("A form
  that calls the API"). A query of TanStack Query over such a function
  always ends with data, and the screen matches on it: `undefined` is
  "still reading", and the rest are the states it shows. Nothing reads
  `isError`, and nothing is retried behind the back of the user. This
  holds only while the function never rejects: a query that ended without
  data would be "still reading" for good.
- **Four states.** `LoadingIndicator` with a label that says what is read
  (「サロンを探しています」), `EmptyState`, the content, and for what could
  not be read `UnreadNotice`: an `Alert` of the tone `danger` that names
  what is missing, and the button 「もう一度読み込む」, which reads again
  (`refetch`). An empty list says that nothing meets the conditions when
  the user narrowed it, and that there is nothing when they did not.
- **The conditions of a search are in the address** (`useSearchParams`): a
  reload, the way back from a record and an address that is passed on show
  the same search. Pure functions read and write them (`salon-search.ts`):
  `conditionsIn(query)` keeps what the API takes and drops the rest without
  a word (an address is also typed by hand), `conditionsOf(formData)` reads
  the form, and `queryOf(conditions)` writes them in one order, so that its
  text is the key of the query as well. Sending the form sets the query of
  the address; sending the same search again reads again.
- **The form of a search keeps its values itself.** It is the one form with
  `value` and `onChange`: it shows the conditions of the address, also
  after the address changed without it (back, forward, 「条件をなくす」),
  and adopts them while it renders when they are others than the last time
  (`components/salon-search-form/`). It is given no `key`: a form that is
  built anew takes the focus from whoever sent it. It stands in a `search`
  element that has the name (`<search aria-label='サロンを探す'>`); the
  `form` inside has none.
- **A list goes on with 「さらに表示」** (`useInfiniteQuery`, with the
  cursor of the API as the parameter of a page; the pure functions are in
  `pages.ts`). The next items are added below those that are there, and the
  focus moves to the first of them, in `useLayoutEffect`: the button that
  was pressed is gone, or further down. It moves once, and after a press:
  the button sets a ref, and the effect that sees more items moves the
  focus when the ref is set. Items that no press asked for (the list was
  read again, the rest of a page came later) leave the focus where it is.
  A page that could not be read is a
  page of the query like the others: the items stay, an `Alert` below them
  says so, and the button reads again. How many there are, and how many of
  them are shown, is a paragraph with `role='status'` above the list. The
  list of another search is another list and gets the search as its `key`.
- **Another order keeps the list** until the list in that order is there
  (`placeholderData: keepPreviousData`): nothing blinks, and the control
  that was changed keeps the focus.
- **Every part of a page reads for itself.** The page of a salon is the
  salon and, below it, the menu, the people and the reviews: each a `Card`
  with a query of its own and its own four states. A part that cannot be
  read says so in its place, and the rest of the page is there. A list that
  a part shows whole is read to its end, in the largest pages the API gives
  and in no more than ten of them (`toTheEnd`).
- **A screen that is named after what it reads** shows the
  `LoadingIndicator` alone while it reads, and its `PageHeader` with the
  name when it knows it; the heading then takes the focus from the screen
  before. When the record cannot be read or does not exist, the heading
  says that. An ID of the address that is no ID is not asked for.
- **What is shown is worked out by pure functions** (`salon-format.ts`,
  `salon-menu.ts`): amounts and dates with `Intl`, in the currency and the
  time zone of the salon and not of the browser; what a visitor is not
  offered is left out; an address of the web becomes a link when it is
  `http` or `https`. They are tested without a screen.
- **What a salon wrote may be long, and in any language.** It wraps
  (`overflow-wrap: anywhere`), and a pair of a name and a long value keeps
  its two columns at every width (`salon-hours.module.css`) where a table
  would scroll.
- **The components of a screen only show** (`components/`): they take the
  models of the API as props, have the four files and a story for every
  state, and know neither the router nor the query. A link gets its
  address from a function the screen hands over (`salonHref`).

## A screen that writes what it read

The booking screens of the portal are the example to read:
`frontend/apps/portal-app/src/bookings/` (`booking-screen.tsx`). A customer
chooses a member of the staff and a day, the screen reads the times that are
free then, and one of them is booked. Everything of "A form that calls the
API" and of "A screen that reads from the API" holds; this is what comes on
top.

- **What decides what is read is in the address, and replaces its entry.**
  The member of the staff and the day are the query of the address
  (`booking-choice.ts`: `choiceIn(query, today, staff)` drops what cannot
  be, `queryOf(choice)` writes it in one order), so a reload shows the times
  of the same day. A choice is set with `{ replace: true }`: the way back
  leads out of the screen, not through every day that was looked at. (A
  search adds an entry: each search is a place to come back to.)
- **What is offered is read whenever it is shown.** A time is free until
  somebody books it. The query of the times has `staleTime: 0` and
  `gcTime: 0`: a day that is shown again is read again, and never shown
  from memory first.
- **The form has two kinds of values.** Those that decide what it offers
  belong to the screen and are controlled (`value`, `onChange`, handed up
  with `onChoose`); what is sent with them (the time, the request) is kept
  by the browser and read as `FormData`, as in every form. Such a form is a
  component of its own (`components/booking-form/`): it takes the
  properties of `Form` (`message`, `errors`, `pending`, `onSubmit`), moves
  the focus to the first control with an error in the same way, and gets
  what was read as a sum type of its own (`loading`, `listed`, `unread`),
  with a story for each.
- **Where nothing can be sent there is no button.** A day without a time
  shows an `EmptyState` that says what to change, and the button that
  sends is not rendered. What was typed stays.
- **A refusal of what was offered reads it again.** The API answers 409
  when the time was taken in the meantime, and does not say why. The form
  says that the time could not be booked and that the times were read
  again (`refetch`); the choice of the address stays.
- **What a write made is what the next screen shows.** The outcome is
  written into the query of the screen it leads to
  (`queryClient.setQueryData(['own', 'bookings', id], …)`), the result is
  said with `notify`, and the screen changes (`navigate`): the page of the
  booking shows it at once, without a state of loading. It reads the
  booking again behind what it shows (`staleTime: 0`): a salon confirms a
  booking, and may change it.
- **A step that stands in the way is part of the screen, not an address.**
  An account that was just registered has no profile, and the API books
  for a customer. The screen reads the profile first and shows the form
  for it in place of the times (`ProfileStep`); creating it writes the
  query of the profile, and the screen goes on to the times of the address.
- **A part that needs several reads says one thing.** The page of a
  booking (`booking-detail-screen.tsx`) reads the salon, the service and
  the staff the booking names. While one of them is on its way the part is
  loading; when one failed, one `UnreadNotice` says so, for the reason
  `whyUnread(reads)` gives (too many requests when one of them was
  refused for that), and its button reads them all again. What the salon
  no longer shows is no failure: the name is replaced by words that say so.
- **A day is a day at the salon.** Today is
  `dateAt(new Date(), salon.timezone)`, it is the `min` of the date
  control, and the label of a time is the time of day there
  (`timeOfDayAt`). The date control is a `TextField` of the type `date`
  with buttons for the day before and after; no calendar is built by hand.
- **A screen for customers alone wraps itself**:
  `<RequireSession roles={CUSTOMERS} signInNotice='…' signInHelp={…}>`
  around the page. A link on a public page leads straight to its address;
  whoever is not signed in signs in there and goes on with what they
  chose. Behind the guard, 401 and 403 need no outcome of their own in the
  functions that call the API: they are `failed`.

### What was written is listed, changed and taken back

The bookings of a customer are the example to read
(`own-bookings-screen.tsx`, `booking-detail-screen.tsx`,
`booking-move-screen.tsx`): the list of what the customer booked, and on the
page of a booking the ways to move it and to cancel it.

- **A list of records that somebody else changes is read whenever it is
  shown** (`staleTime: 0`), and a write of the screen takes away what was
  read of it: `queryClient.removeQueries({ queryKey: OWN_BOOKING_LISTS })`,
  after a new booking, a cancellation and a move. A list that is only made
  stale is shown from memory first, and says for a moment what the write
  just changed. The key of the lists is no beginning of the key of a
  record (`['own', 'booking-lists', …]` beside `['own', 'bookings', id]`):
  what takes the lists away leaves the record that was just written.
- **Which of two lists is shown is in the address** (`whenIn`,
  `listHrefOf` in `own-bookings.ts`): the list somebody comes for is the
  one without a query. The way from one to the other is two links, a
  `Navigation` with a name of its own (「予約の時期」) whose current link
  is `aria-current`; the heading of the list says which one it is. The
  other list is another list, and gets `key`.
- **A row that names other records reads each of them once.** A booking
  names its salon and its service by their IDs. `namedBy` gives each of
  them once, `useQueries` reads them under the keys the page of a record
  reads them with, and `rowsOf` makes the rows: a booking is shown whole
  or not yet, so the rows end at the first whose names are not there.
  Names on their way are rows on their way (`moreOfRows`: the button is
  busy); names that could not be read are rows that did not come (the
  `Alert` below the rows, and the button reads the names again). What is
  no longer there is read, has no name, and is said in words (「サロン
  （掲載を終えています）」).
- **What a record offers is decided by pure functions of the record**
  (`isChangeable`, `isMovable`). They say what the API will allow; the API
  decides again when it is asked. What the user cannot do themselves is
  said in the place of its link, with whom to ask. A screen that an
  address opens for a record it cannot change says so in place of its
  form.
- **What cannot be taken back is asked first**, in a `Dialog` that holds
  the form (`components/booking-changes/`): the `form` is the content of
  the dialog, and its button stands among the `actions`, tied to it with
  `form={id}`. The dialog names what it is about (the day and the hours
  of the booking). The component takes `open`, `onOpen`, `onClose`,
  `message` and `pending`, and hands the `FormData` up; the screen
  decides.
- **Where a failure is said depends on what can be done about it**
  (`afterCancellation` in `booking-flow.ts`). What can be tried again (no
  answer, too many requests) is said in the dialog, which stays open with
  what was typed. A refusal closes the dialog and is said on the page, in
  an `Alert` above the record, and the record is read again: it may no
  longer be one that can be changed. A record that is gone is read again,
  and the screen says that there is none. Opening the dialog again takes
  away what was said about the attempt before.
- **Buttons that go with what they did leave the focus nowhere.** After a
  cancellation the page is the same screen without its buttons: the focus
  goes to the heading of the screen (`useScreenHeadingFocus()` of `ui`),
  in the `useLayoutEffect` of the commit that shows the record as it is
  now, and only after an answer to what the user did here (a ref). A
  record that was read again behind the screen moves no focus. The same
  holds for a step that the next one replaced (the profile, before the
  times).
- **One form for a new record and for one that is changed.** `BookingForm`
  has no word of its own for what it does: `submitLabel` says it, and
  what only one of the two sends (the request of a new booking) is its
  `children`. The screen that moves a booking opens with what the booking
  has (`moveHrefOf`: its member of the staff and its day, in the query),
  and reads what is free for a visit as long as the booking.
- **What a change undoes is said before it is made.** A confirmed booking
  that is moved waits for the salon again: an `Alert` of the tone `info`
  above the form says so. What the screen cannot show is said in a
  sentence, too: the list of free times leaves out those that the
  booking itself takes.

## Screens and the session

| Component (`@beauty-salon-frontend/session`) | Use it for |
|-----------|------------|
| `RequireSession` | Screens for signed-in users of the `roles` it is given. Everybody else is told what stands in the way |
| `SessionAccount` | The `account` of `AppShell`: who is signed in, and the way out. With `signInHref`, the way in for a visitor |
| `useSession` | Who is signed in, for a screen that shows different things to different people |

```tsx
<NotificationProvider>
  <AppShell title={title} account={<SessionAccount />}>
    <RequireSession roles={ROLES}>
      <Routes>…</Routes>
    </RequireSession>
  </AppShell>
</NotificationProvider>
```

- **Nobody is sent to a sign-in page.** `RequireSession` shows the sign-in
  screen in place of its content, at the address that was asked for; after
  signing in, the screen of that address is there. The admin and the
  dashboard application wrap all their routes. The portal is for everybody:
  it has the sign-in screen at `/sign-in` and the screens of an account
  beside it, and a screen for customers alone wraps itself
  (`<RequireSession roles={CUSTOMERS}>`, with the constant of `roles.ts`;
  `bookings/booking-screen.tsx`).
- **The roles of an application** are a constant in its `App.tsx`: admin is
  for `owner`, `manager`, `staff` and `admin`, the dashboard for `owner`,
  `manager` and `admin`. An account of another role is told so and offered
  the way out. This decides what is shown. What is allowed is decided by the
  API, on every request.
- A screen inside `RequireSession` reads the user with `useSession()` and
  matches all four states; it is rendered for `signedIn` only.
- Signing out is `SessionAccount`'s business. The screens disappear with the
  session, in every tab.
- **The links of the header depend on who is signed in.** A pure function
  gives them for the role and the path (`navigationFor` in
  `frontend/apps/portal-app/src/navigation.ts`): a customer of the portal
  has the search and their bookings; a visitor and an account of another
  role have none, and `AppShell` is then given no `navigation` (a landmark
  without a link says nothing). A link is the current one on every screen
  below it: the page of a salon belongs to the search, the page of a
  booking to the bookings.
- **What the sign-in screen says besides the form** is the application's:
  `signInNotice` of `RequireSession` is why an account is asked for (above
  the form, where it is read first), `signInHelp` the ways on for somebody
  who cannot sign in (links, under the form). The portal offers a new
  password and a new account; the admin and the dashboard application lead
  to the portal for a new password.

## Screens that a mailed link opens

The API mails links to the portal (`PUBLIC_APP_URL`): `/verify-email`,
`/reset-password` and `/accept-staff-invitation`, each with `#token=…`
behind it. Their screens are in `frontend/apps/portal-app/src/account/`.

- **The token is read once and taken out of the address**
  (`useMailedToken`): it stays neither in the address bar nor in the
  history. A page that is loaded again has none, and says that the link of
  the mail opens it.
- **Opening a link changes nothing.** Software opens the links of a mail
  ahead of its reader. A request that uses the token up is sent when a
  button is pressed. A check that uses nothing up may run when the screen
  opens (`/reset-password/verify`, `/staff-invitation/verify`): a query
  whose key has the token, with `staleTime: Number.POSITIVE_INFINITY` and
  `gcTime: 0`.
- **A token the API refuses is no value to correct.** The screen says that
  the link cannot be used and shows the way to a new one (`mailed-link.tsx`).
  It does not say why: the API does not tell an unknown token from a used or
  an expired one.
- **The address of another application** is a variable of the build:
  `VITE_ADMIN_APP_URL` in the portal, `VITE_PORTAL_APP_URL` in the admin and
  the dashboard application, in every `.env.<mode>` and in `vite-env.d.ts`.
  A link to it is an `a` with the whole address, not a link of the router.

## The frame of a screen

| Component | Use it for |
|-----------|------------|
| `AppShell` | The frame of an application: the link that skips to the content, the header (title, `account`), the `navigation` (under the header, or beside the content with `navigationPlacement='side'`), the main content with the notification at its top |
| `Navigation` | The links to the screens. The application says which one is `current` |
| `LinkProvider`, `Link`, `ButtonLink` | Links that move within the application: `Link` in a text or a list, `ButtonLink` for one that looks like a button |
| `PageHeader` | The top of a screen: its one `h1`, a description, the actions on the whole screen |
| `Card` | A part of a screen under its own heading (`h2`, or `h3` with `headingLevel={3}`) |
| `DescriptionList` | The names and values of one record |
| `Badge` | The state of a record, in a word |
| `TagList` | A few words about a record, as a list with a name: the features of a salon, what a member of the staff is good at |
| `Rating` | A rating out of five: the stars, the number, and how many gave it |
| `Table` | A list of records |
| `EmptyState` | What is shown where content would be, while there is none |
| `LoadingIndicator` | What is shown where content will be, while it loads |
| `Dialog` | A question or a small form that has to be dealt with first |
| `NotificationProvider`, `useNotifications` | The result of what the user just did |

- **A screen** is a `PageHeader`, then its content; the frame gives them their
  width and the gaps between them. One `h1` per screen, and headings go down
  one level at a time.
- **The title of the document and the focus follow the screen.** Inside
  `AppShell`, `PageHeader` sets `document.title` to the title of the screen
  and that of the application (「顧客台帳 | Beauty Salon Admin」; the title of
  the application alone on the screen that carries it). When another screen
  takes the place of one, the focus moves to its `h1`: a screen reader says
  where the user is now, and the keyboard goes on from the top. The first
  screen of a page load leaves the focus where the browser put it. A screen
  needs nothing for this but its `PageHeader`, which it shows in every
  state: while its content loads, when there is none, when it failed. The
  one exception is a screen that is named after what it reads (the page of
  a salon): while it reads it has no name, and shows the `LoadingIndicator`
  alone until it has one.
- **The focus moves in the commit that shows where it goes.** A component
  that moves the focus when what it shows changes (the heading of another
  screen, the first control with an error, the code of the second step) does
  so in `useLayoutEffect`, not in `useEffect`. React may run a `useEffect` a
  task after the commit: the router changes the screen inside a transition,
  and an answer of the API is no event of the user. The screen would then be
  painted, and found by whoever waited for it, with the focus still where
  the screen before it left it. `useScreen`
  (`ui/src/components/app-shell/screens.tsx`) is the example to read. A
  screen that stays, and takes away what had the focus, moves it to its
  heading with `useScreenHeadingFocus()` of the same file ("What was
  written is listed, changed and taken back").
- **What goes somewhere is a link, what does something is a button.**
  `ButtonLink` for 「新しい予約」 that opens another screen, `Button` for
  「予約を確定する」. This package does not know the router: an application
  gives its link once, at its root (`LinkProvider` in `App.tsx`), and the
  components draw their links with it.
- **One of several links with the same text has a name of its own.** Every
  service of a menu has the link 「予約する」; its `aria-label` says which
  (「レディースカットを予約する」), and holds the text that is seen, so
  that somebody who speaks to the browser can say what they read. The name
  is not made with text that is hidden by a stylesheet: a browser and
  jsdom spell such a name differently.
- **A list has three states**, and a screen shows each: `LoadingIndicator`
  while it loads, `EmptyState` (or the `emptyMessage` of the table) when there
  is nothing, the rows when there are some.
- **`Table`**: `caption` is its name (`captionHidden` when a heading above
  says the same). The first column names the record; its cells are the headers
  of their rows. `align: 'end'` for numbers and amounts. Cells stay on one
  line, so a table that is wider than the screen scrolls inside its frame,
  and that frame takes the focus of the keyboard: this is the one lint rule
  the package switches off, in place, with the reason.
- **`Dialog`** is the `dialog` element opened with `showModal()`: the browser
  keeps the focus inside, makes the page behind inert, closes on Escape and
  gives the focus back. Give the actions in the order they are read, the one
  that changes nothing first (「戻る」, then 「予約を取り消す」): the focus
  goes to the first. In a dialog with a form, the first control of the form
  stands before the actions and takes the focus. `onClose` is called whenever
  it has closed; set `open` to false there.
- **Notifications** say what was done: `notify({ tone: 'success', message:
  '予約を確定しました。' })`. The notification stays, also after the screen
  has changed, until the user closes it or the next one takes its place;
  nothing disappears by itself. `NotificationProvider` stands at the root of
  an application that notifies, above its routes, and `AppShell` shows the
  notification at the top of the content. What went wrong with a form is said
  in the form, with an `Alert`.
- **A state is said in words.** A `Badge` holds the word (「確定」); its tone
  only groups. The current link of a `Navigation` is `aria-current="page"`.

## Adding a component

1. Create the four files in `frontend/packages/ui/src/components/<name>/`.
2. Write a story for every state worth seeing: each variant, disabled,
   pending, empty, with an error, with long text.
3. Write the test from the stories (`frontend-testing`).
4. Export it from `src/index.ts`.
5. Run the checks below and look at the stories in the catalogue.

## How the package is built

`pnpm --filter @beauty-salon-frontend/ui run build:prod` (rslib) writes one
file per source file into `dist/`, with the type declarations. The stylesheet
of a component is written beside its script, which imports it, so an
application gets the styles of the components it uses and of no other.

The build of an application reads `dist/`. Its dev server and the tests read
the source, through the export condition `@beauty-salon-frontend/source`: a
change of a component shows at once, and neither waits for a build.

## Checks

```bash
pnpm --filter @beauty-salon-frontend/theme test   # style rules of every package and app, contrast of the tokens
pnpm --filter @beauty-salon-frontend/ui test      # components, from their stories
pnpm --filter @beauty-salon-frontend/session test # the same for the screens of the session
pnpm test:frontend                                # every frontend test
pnpm lint && pnpm format:check                    # Biome, including the stylesheets
pnpm build:prod && pnpm typecheck && pnpm knip
```
