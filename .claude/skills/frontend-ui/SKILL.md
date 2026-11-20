---
name: frontend-ui
description: "How the frontend of this repository is styled and how its components are built: design tokens, CSS Modules, layout with CSS Grid (never flex), the shared component package @beauty-salon-frontend/ui with its form components (label, description, error), the frame of a screen (app shell, navigation, table, dialog, notifications), how a form calls the API, how a screen reads from the API (a search kept in the address, a list that goes on, the parts of a page), how a screen writes what it read (a choice kept in the address, what is offered read anew, a refusal), the screens that need a session (sign-in, roles), the screens of a salon (the salon of the address, the clock of the salon, the operations a state allows, a bill the API works out, payments in parts, a receipt on paper), the screens that a mailed link opens and the Storybook. Use it before adding or changing a component, a form, a stylesheet, a token, a story or the markup of a screen under frontend/."
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
| The screens of the security of an account (the password, the devices that are signed in, the second factor), which every application puts at an address of its own, and the rule of a password that is chosen | `frontend/packages/session/src/security/` |
| Where the portal puts them: below the page of the customer | `frontend/apps/portal-app/src/security/` |
| The screens of an account in the portal: registering, a new password, and the screens that a mailed link opens | `frontend/apps/portal-app/src/account/` |
| The screens of the salons in the portal: the search and the page of a salon, and the components they show | `frontend/apps/portal-app/src/salons/` |
| The screens of a booking in the portal: choosing the member of the staff, the day and the time, the page of a booking, the bookings of a customer, and cancelling and moving one | `frontend/apps/portal-app/src/bookings/` |
| The page of a customer in the portal, and the form of their profile | `frontend/apps/portal-app/src/profile/` |
| What a customer wishes for in the portal: the part of their page, and the form with the rows of time slots | `frontend/apps/portal-app/src/preferences/` |
| The reviews of a customer in the portal: the part of the page of a visit, the form that writes a review and changes one, and the list with the dialog that removes one; what a reader of the page of a salon does with the reviews of others (`reader-flow.ts`, the dialog that reports one) | `frontend/apps/portal-app/src/reviews/` |
| Where a visitor signs in, and where they go on to from there | `frontend/apps/portal-app/src/sign-in-path.ts` |
| The links of the header of the portal, by who is signed in | `frontend/apps/portal-app/src/navigation.ts` |
| The salon of who is signed in (`useOwnSalon`), and what an account that belongs to none is told | `frontend/packages/session/src/salon/`, `src/components/no-salon-notice/` |
| The screens of a salon in the admin application: the choice of a salon, and the salon of an address around the screens below it | `frontend/apps/admin-app/src/salons/` |
| The bookings of a salon in the admin application: the list of a day, a booking and the operations of its state, a booking put in for a customer who was searched for, the change of its notes and its removal | `frontend/apps/admin-app/src/bookings/` |
| The sales of a salon in the admin application: the checkout of a booking, the ledger of the sales, a sale with its payments, the form that records a payment, the receipt to print, the change of a sale, the refund of a payment and the voiding of a sale | `frontend/apps/admin-app/src/sales/` |
| A form of the admin application that searches by a keyword kept in the address (salons, customers) | `frontend/apps/admin-app/src/components/keyword-search/`, `src/keyword.ts` |
| The clock of a salon in the admin application: its day, its times of day, a moment that is typed on it | `frontend/apps/admin-app/src/salon-time.ts` |
| The links of the header of the admin application, by the role and the salon of the address | `frontend/apps/admin-app/src/navigation.ts` |
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
  when a second application needs it. What a second area of the same
  application shows stays in the area it began in and is imported from
  there: the list of what a customer wrote and the page of a booking show
  a review with `ReviewContent` of `salons/components/`.
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
| `RadioGroup` | One of a few choices that should all be in sight. `layout='columns'` for many short ones (the times of a day): as many columns as fit, and the arrow keys go through them in the order they are read. Choices with long labels (the payment methods with what they take) stay one below the other: a label does not fit a column at 390px |
| `Checkbox` | One thing that is so or not so |
| `CheckboxGroup` | Several of a few choices. The chosen values are sent under one name (`formData.getAll(name)`). `layout='columns'` for many short ones |
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
  row are columns of it. A field keeps its label, its control and its
  messages as high as they are (`align-content: start` in
  `field.module.css`), so a field beside one that says an error is not
  drawn out to its height: the two controls stay on one line, and the row
  needs no `align-items` of its own.

A new kind of field is built from the parts in `components/field/`: `Field`
(the label, the mark and the messages; the control is its child function and
is handed `id`, `aria-describedby` and `aria-invalid`), `control.module.css`
(the look of a control that holds text) and `choice.module.css` (a checkbox or
a radio button with its label). A group of controls uses `messageAttributes`
and `FieldMessages` directly, as `radio-group.tsx` and `checkbox-group.tsx`
do: the group is a `fieldset`, its label the `legend`, and the messages
belong to the group.

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
  that has an error. A group of radio buttons cannot take the focus itself:
  it goes to the button that is chosen, or to the first (`Form` of `ui`
  does both). A message about the whole attempt is an `Alert` of the tone
  `danger` at the top of the form, which is read at once.
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
  query of the profile (`OWN_PROFILE` of `profile/profile-api.ts`, the key
  every screen reads the profile under), and the screen goes on to the
  times of the address.
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

### A record is changed in a form

The profile of a customer is the example to read
(`frontend/apps/portal-app/src/profile/`: `my-page-screen.tsx` shows it,
`profile-screen.tsx` changes it, and makes it for an account that has
none).

- **A change sends what was changed, and nothing else.** `PATCH` leaves a
  property alone that the request does not name. A pure function compares
  what the form was sent with to the record it was opened with
  (`readProfileChange(values, shown, today)` in `profile-flow.ts`) and
  gives the request of the properties that differ: what somebody else
  wrote in the meantime stays, unless the user changed the same value.
  Values are compared as they are sent (without the spaces around them,
  nothing as `null`), so a record that is stored with a space is no
  change. A form that is sent as it was opened asks the API for nothing:
  the screen says so (`notify`, the tone `info`) and goes back.
- **The form opens with what the API says now.** Its controls keep their
  values (`defaultValue`), so what they open with is what they compare
  to, and it does not change when a later answer arrives. The screen
  therefore shows the form for the answer that came after it was mounted
  (`read.isFetchedAfterMount ? read.data : undefined`), never for what
  another screen read a while ago.
- **Nothing is read behind an open form.** The query of the screen has
  `refetchOnWindowFocus: false` and `refetchOnReconnect: false`: a read
  that failed behind the form would put the notice in its place, and what
  was typed would be gone.
- **One form for a new record and for one that is changed**, here too:
  `ProfileForm` takes the record or `null`, the `submitLabel` and the
  properties of `Form`. Which of the two the screen shows is known when
  the record is read, so **the screen has one title for every state**. A
  title that changed after the read would be another screen to the frame,
  which would move the focus to the heading, also on a page that was
  just loaded.
- **The parts of a long form are `fieldset`s with a `legend`** (a `div`
  with `role='group'` does not pass the lint). Controls that share a row
  do so from the width at which two of them fit (`min-width: 40rem`).
- **A property inside another is named by its path** (`preferences.notes`),
  as the API names it in `errors[].field`. What the API says about one
  value of a list (`preferences.preferredServices.0`) is said at the group
  that holds them all. What it says about a value the form has no control
  for is a message about the attempt.
- **A record that is gone when the change arrives** (404) is no failure
  to try again. The screen writes into the query that there is none,
  shows the form for a new record in the place of the other, says why in
  an `Alert` of the tone `warning`, and moves the focus to the heading
  (`useScreenHeadingFocus()`): the form that had the focus is gone.
- **What a value may be is what the API takes**, read from its schema
  and counted the same way: the lengths of the columns, the form of a
  phone number, a day of birth from 1900 until today. Today is the day
  it is where the browser is (`localDateOf`); it is the `max` of the date
  control as well.
- **A value nobody gave is said in words** on the page that shows the
  record (「未登録」, 「未発行」, 「なし」): a name without a value looks
  like a fault.
- **What the user cannot change is said where it would be asked for.**
  The address of a customer is that of the account, and then what the
  salons keep. The form has no control for it: a sentence among the
  controls of the contact says so, and whom to ask.

### A form with rows, with lists, and with choices that are read

What a customer wishes for is the example to read
(`frontend/apps/portal-app/src/preferences/`: `own-preferences.tsx` is the
part of the page, `preferences-screen.tsx` the form). It is changed as the
profile is, above, and adds what the profile does not have.

- **Rows that are added and taken away** are a component that keeps which
  rows there are (`components/time-slot-fields/`); the browser keeps what
  was typed, as in every control. A row has a `key` that stays with it (a
  counter, never its index), so a row that is taken away takes its values
  with it and the others keep theirs. The controls are named by the number
  the row has now, counted from 0 (`preferredTimeSlots.1.startTime`), and
  labelled by it as it is read (「時間帯 2 の開始」): no two controls of
  the form have one name. The buttons are `type='button'`.
- **The focus follows the press**, in a layout effect: to the first control
  of the row that was added; to the button that adds a row after one was
  taken away, for its own button went with it.
- **An error names a row by its number**, and taking a row away renumbers
  the rows after it. The errors of an attempt are shown until a row is
  taken away, and again after the next attempt (a new `errors` object).
- **A row that was left empty is not sent, and one that is half filled is
  an error** at the time that is missing. The rows of the request are then
  not the rows of the form, so what the API says of a row all the same is
  said about the attempt, not at a control.
- **A list is written a line each** in a `TextArea` whose description says
  so. A pure function reads it (`linesOf` in `src/lines.ts`, which the
  forms of two areas share): without the spaces around a line, without the
  empty lines, each value once. An error names the line as the control
  shows it (「2 行目を確かめてください。…」, `pictureAddressesError` for
  a list of addresses).
- **What the form offers is read with the record, as one answer.** The
  query of the form has one function (`readOwnPreferencesToChange`): the
  record, then what its choices come from (the salons the customer has a
  booking at, the staff each of them shows, a stored member that is not
  among them, the names of the salons). One of them unread is the form
  unread: it never opens with half of its choices, and a choice that came
  later would not be compared with what the form opened with.
- **A choice that belongs to something is offered with its name**
  (`田中 美咲（Beauty Salon Tokyo）`), in an order that does not change
  between two reads (`staffChoicesOf`).
- **A stored value the form cannot offer** (a member of the staff their
  salon no longer shows) is neither shown nor sent. It stays stored until
  the customer changes that control, and the page that shows the record
  leaves it out.
- **Without anything to offer, there is no control**: a sentence stands in
  its place and says how to get one (「…サロンを予約すると選べるようにな
  ります。」). The request then names none of those properties.
- **A part of a page with a query of its own** (`OwnPreferences` on the
  page of the customer) is read again whenever it is shown
  (`staleTime: 0`), says in its own place that it could not be read, and
  is written by the form (`setQueryData` with what the API answered), so
  the page shows the change at once.
- **A value nobody gave** is one word everywhere on the part
  (「指定なし」, `UNSET`). An address somebody else wrote is a link that
  is not loaded as a picture (`rel='noreferrer'`).

### What was written is rated, listed, changed and removed

The reviews of a customer are the example to read
(`frontend/apps/portal-app/src/reviews/`: `booking-review.tsx` is the part
of the page of a visit, `review-write-screen.tsx` the form of a new review,
`own-reviews-screen.tsx` the list with the dialog that removes one,
`review-change-screen.tsx` the form that changes one). They are written as
the bookings and the profile are, above, and add what those do not have.

- **What stands in the way of a form is told apart by the read.** The
  function that reads what the form opens with answers with a sum type of
  it (`VisitRead` in `reviews-api.ts`: the visit, or `notVisited`,
  `reviewed`, `salonGone`, `notFound`), and the screen says each in an
  `EmptyState` with the way on from there: to the form that changes the
  review a visit has, to the booking that is no visit yet. The title of
  the screen is the same for all of them.
- **A choice that decides which controls there are is state of the form**
  (`components/review-form/`): the member of the staff a review rates is
  a `Select` with a value the form keeps, and the rating of the staff is
  there while somebody is chosen. A `select` is always sent with a value,
  so having no control is the way to send none; the function that reads
  the `FormData` takes a missing control for nothing (`readNewReview`).
  The other controls stay the browser's.
- **What cannot be changed later is a sentence in the place of its
  control.** The form takes what it is to do with the choice as a sum type
  (`RatedStaff`: `choice` with its options, `fixed` with a name, `nobody`),
  not as flags: whom a review rates is chosen when it is written, and the
  form that changes it says who that is, and that it stays so.
- **One of five is a `RadioGroup` with nothing chosen**, and the options
  say what a number means (「5（とても満足）」). What may be left out is a
  `Select` whose `placeholder` says so (「評価しない」).
- **A refusal that is about the record the form is for** is no value to
  correct (`isOfTheVisit` in `review-flow.ts`: a 409, or a 400 that names
  a property the form has no control for). The screen reads the record
  again and shows what it is now; when the form is gone with that, an
  `Alert` of the tone `warning` says that nothing was written, and the
  focus goes to the heading. A refusal of a value the form does have a
  control for is said there, and what was typed stays (a member of the
  staff who was removed while the form was open).
- **Who may change a record is asked of the read where the API reads it
  to everybody.** A review is public, and its writer alone changes it:
  `readOwnReviewToChange` compares the customer of the review with the
  customer of the account, and somebody else's review is not found, as an
  address that names nothing is.
- **A row that carries actions names them by the row.** Every review of
  the list has 「変更する」 and 「削除する」; the `aria-label` of each
  says of which review (`subjectOf` in `review-format.ts`: the salon and
  the day it was posted), and ends with the text that is seen. The dialog
  that asks names the review with the same words.
- **A removal is asked in a dialog that has nothing to type**
  (`components/review-removal/`): the `Dialog` of `ui` with a
  `description` that names the record, says what goes with it and what
  cannot be taken back, and the two buttons among its `actions`. The
  screen keeps which record was asked about (so that the dialog names it
  while it closes), whether the dialog is open, and what was said about
  the attempt. What can be tried again is said in the dialog; a record
  that was gone already is removed, for that is what was asked.
- **The dialog is drawn where the list is drawn.** It goes with the list
  when the list is read anew, and its button with it: the focus then goes
  to the heading of the screen, in the layout effect of the commit that
  shows the screen without the list, and only after an answer to what the
  user did here (a ref).
- **One function says what a write leaves of what was read**
  (`afterReviewWrite` in `review-cache.ts`), and every write of the area
  calls it. The record a page shows is written (`setQueryData`; after a
  removal, that there is none). The lists of the writer are reset
  (`resetQueries`): what was read of them is gone, and a list that is on
  the screen while the write happens is told so and read anew.
  `removeQueries` tells a list on the screen nothing; it is for what no
  screen shows at the moment. What other screens read of what the write
  counts anew is taken
  away (`removeQueries`): the page of the salon, the summary of its
  ratings, its reviews, the ratings of its staff, and the results of a
  search, which show the rating of a salon.
- **A row that names other records reads them with the page**
  (`readOwnReviews`): a page of the list is its reviews with the salon of
  each and the name of the member each rates, read once per salon. One
  of them unread is the page unread. A page is ten rows, and a record
  with its names is one item of the cache: nothing arrives later.
- **An address somebody wrote** (the pictures of a review) is shown as a
  link that the page does not load, with `rel='noreferrer nofollow ugc'`,
  each on a line of its own, in a list with a name (「写真」). A value
  that is no address of the web is shown as text (`webAddressOf`). A test
  that counts the rows of the outer list counts its own items alone.

### A public page offers more to who is signed in

The reviews on the page of a salon are the example to read
(`ReviewsSection` and `StaffSection` in `salons/salon-screen.tsx`, with
`reviews/reader-flow.ts`, `reviews/review-cache.ts` and
`reviews/components/review-report/`). Everybody reads the page; a customer
also says that a review of somebody else was helpful, and reports one.

- **Who reads is a sum type, worked out by a pure function** (`readerOf`:
  `visitor`, `customer` with the ID of the profile, `other`), from the
  session and from what was read of the profile. The page offers by that
  type and by nothing else. A visitor gets one sentence above the list
  with the way in, not a button at every row that cannot be pressed. A
  customer gets the buttons. Everybody else (an account of a salon, an
  administrator, an account without a profile, a profile that could not
  be read, a session that is still asked for) gets nothing more, and reads
  all the same.
- **The way in from a public page names the page to come back to**
  (`signInHrefFrom(pathname)`: `/sign-in?from=…`), and the sign-in screen
  goes on to it (`pathAfterSignIn`). An address is typed by hand and
  passed on by others: what it names is followed only when it is a path
  of the application (segments of letters, digits, `-` and `_`), and
  anything else is the start. The address of another site is none the
  router shows: when the browser refuses it, a push leaves the
  application for it, and a replace fails.
- **A button that is on or off says so with `aria-pressed`**, and `Button`
  shows a pressed button in the colours of the accent. A mark for the eye
  (`✓`) is `aria-hidden`. A pressed button that cannot be taken back stays
  a button that can be pressed and sends nothing: a disabled button would
  lose the focus that was on it. While its request is on its way, the
  button of that row alone is `pending`.
- **What the API answers to a press is written where it was read**
  (`afterHelpfulCounted`): the count of the row is replaced in the order
  that is on the screen, and the row stays where it is, for nothing moves
  under somebody who reads. That list is no longer what the API would
  answer, so it is marked to be read the next time it is asked for
  (`invalidateQueries` with `refetchType: 'none'`), and what was read in
  the other orders is taken away (`removeQueries`).
- **What a customer did before is shown only when the API says it.** The
  API does not say who found a review helpful, so the button is not
  pressed on a page that is opened anew; pressing it again counts nobody
  twice, and the page says what the API answered.
- **A form in a dialog** (`components/review-report/`) is a child of the
  `Dialog`, and its button among the `actions` sends it by the `form`
  attribute. It takes `message`, `errors` and `pending` as `Form` does,
  and moves the focus to the first control with an error with the hook
  `Form` uses (`useErrorFocus` of `ui`). Every time the dialog is opened
  it is a new form (a `key` that counts the openings): nothing that was
  typed or said the time before is there.
- **Where nothing can be sent any more, the form gives way to a
  sentence** (the account reported the review before: an `Alert` of the
  tone `info`, and one button that closes). The button that sent the form
  went with it, so the one that is left takes the focus, in the layout
  effect of the commit that shows it.
- **A record that is gone while its row is on the page** (a 404 to a
  press) is taken out of what was read, in every order (`afterReviewGone`:
  `setQueriesData`), and what counts it is read again behind what the
  page shows (`invalidateQueries`). `resetQueries` is not the tool where
  a query keeps what it had as a placeholder (`keepPreviousData`): the
  list would go on showing the row. The focus goes to the heading of the
  part (`headingRef` of `Card`), in the layout effect of that commit. A
  dialog that was open about the row is unmounted, not closed: a dialog
  that closes gives the focus back to the button that opened it, and
  keeps the page inert until it has closed.
- **A row with actions is named by what a reader knows it by**
  (`postedOf` in `salon-format.ts`: the title and the day,
  「「Great experience」（2026年11月19日 投稿）」, or the day alone), in the
  `aria-label` of each button and in the description of the dialog.
- **Numbers the API counts one record at a time are read together**
  (`readStaffRatings`): a request for each member of the staff, one value
  for all of them, and one sentence when a request got no answer, with
  the people shown all the same. The query is keyed by when the list it
  belongs to was read (`dataUpdatedAt`), so the two are never of
  different moments. This costs a request a row: it is for the staff of
  one salon, not for a list that goes on.

## Screens and the session

| Component (`@beauty-salon-frontend/session`) | Use it for |
|-----------|------------|
| `RequireSession` | Screens for signed-in users of the `roles` it is given. Everybody else is told what stands in the way |
| `SessionAccount` | The `account` of `AppShell`: who is signed in, and the way out. With `signInHref`, the way in for a visitor; with `securityHref`, the way to the security of the account, in an application that has no page of its own for the account |
| `useSession` | Who is signed in, for a screen that shows different things to different people |
| `AccountSecurityScreen`, `PasswordChangeScreen`, `TwoFactorSetupScreen` | The security of the account of the session, the change of its password and the set-up of its second factor: screens that every application puts behind the guard, at an address of its own |
| `PASSWORD_RULE`, `newPasswordError`, `refusedPasswordMessage` | The rule of the API for a password that is chosen, as a person is told it: for every form that chooses one |
| `useOwnSalon`, `NoSalonNotice` | The salon of who is signed in: `platform` for `admin`, the salon of a member of the staff, or none. And what an account of a salon role that belongs to no salon is told |

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
  has the search, their bookings and their page; a visitor and an account
  of another role have none, and `AppShell` is then given no `navigation`
  (a landmark without a link says nothing). The admin application gives
  them for the salon of the address (`frontend/apps/admin-app/src/navigation.ts`). A link is the current one on
  every screen below it: the page of a salon belongs to the search, the
  page of a booking to the bookings, the form of the profile to the page
  of the customer (`isAtOrBelow`: an address that only begins with the
  same letters is not below).
- **What the sign-in screen says besides the form** is the application's:
  `signInNotice` of `RequireSession` is why an account is asked for (above
  the form, where it is read first), `signInHelp` the ways on for somebody
  who cannot sign in (links, under the form). The portal offers a new
  password and a new account; the admin and the dashboard application lead
  to the portal for a new password.

### The security of an account, in every application

Every role has a password and devices that are signed in, so the screens
are in the session package (`frontend/packages/session/src/security/`), and
each application puts them at an address of its own: the portal below the
page of the customer (`/mypage/security`, for customers), the admin and the
dashboard application at `/account/security`, which the header leads to
(`<SessionAccount securityHref='/account/security' />`).

- **A screen of a package knows no router.** It takes the addresses it
  leads to (`passwordHref`, `securityHref`) and what it cannot do itself as
  a callback: `PasswordChangeScreen` calls `onChanged` after the change,
  and the application goes back with `navigate`. `actions` is what the
  application puts beside the heading (「マイページへ戻る」).
- **The rule of a chosen password is said in one place.** The forms that
  register, set a new password, accept an invitation and change the
  password take it from the session package (`password-rule.ts`): the text
  under the control, what is wrong before the API is asked (nothing, too
  short, too long, counted as the API counts), and the words for a rule the
  API named.
- **The change asks for the current password and the new one once.** Both
  are taken as they were typed. A new password that is the current one
  (compared as the API compares them, both composed: `NFC`) is said at the
  new password and not sent. A current password the API refuses is said at
  its control, with the lock that five of them in a row bring; what was
  typed stays.
- **After the change the screen it goes back to reads anew.** The account
  and its devices are taken away (`removeQueries` of `OWN_ACCOUNT_PARTS`)
  before `onChanged`: the screen of the security shows when the password
  was changed, and that the other devices are gone, without showing what
  it had first.
- **What the screen shows is read whenever it opens** (`staleTime: 0`): the
  password is changed, and devices sign in and out, elsewhere. A moment is
  said in the time zone of the browser (an account belongs to no salon),
  and the browser of a device is its User-Agent as the API kept it.
- **A device is signed out without a dialog.** Its device signs in again to
  go on. Its row leaves the list at once (`withoutSession`, the count with
  it), the focus goes to the heading of the part (`headingRef` of `Card`)
  in the commit with the fewer rows, and the pages are read again behind
  the list: the row named where the next page begins. A device that had
  signed out in the meantime (404) is what was asked for. This device has
  no button: it signs out in the header.
- **A page whose cursor is gone reads the list from its start.** The list
  goes on in pages of 20 with 「さらに表示」. When the device that ended a
  page has signed out since, the API refuses the cursor (400 at
  `cursor`), and the list is read again (`refetch`), as many pages as
  there were.
- **Signing out everywhere is asked first,** in a `Dialog` that says that
  this device goes too. Then the session of the browser is gone, the guard
  shows the sign-in screen in place of the screen, and a notification says
  what happened; what went wrong is said in the dialog.
- **The second factor offers what its state allows.** Off, and half way:
  a link to the screen that sets it up (`twoFactorHref`). On: a dialog
  that issues new backup codes, and one that turns it off, which are on
  the screen only while it is on.
- **What is in one answer alone is held by the screen, not the address.**
  The secret and the backup codes are in the answer of `enable` and never
  again, so the set-up is three steps of one address (the password, the
  app with its code, the backup codes), held in state: a reload begins
  anew, and the API issues new ones. The new backup codes take the place
  of the form in the same dialog, and the focus goes to what is said of
  them.
- **The focus follows a step that takes the place of another.** When what
  shows another step (or another state of the account, read anew) took
  away what had the focus, the focus goes to the heading of what is shown
  now (`headingRef` of `Card`), in the commit that shows it
  (`useLayoutEffect`, `document.activeElement` back at `body`). A form in
  a `Dialog` gets the focus at its first control from the browser.
- **A code is read as a person types it.** Spaces go and digits of full
  width become those of half width (`normalize('NFKC')`). A form that
  takes the code of the app alone sends six digits and nothing else, and
  says that a backup code does not do; one that takes a backup code too
  sends up to the 64 characters the API reads. A wrong code, as a wrong
  password, is said with the lock it counts towards.
- **A QR code is drawn in the browser** (`QrCode` of the ui package): the
  `otpauth://` address holds the secret, and no service outside is given
  it. Under it, the secret in groups of four, for an app that cannot read
  the code.
- **A state changed elsewhere (409) is read anew.** A notification says
  so, the dialog closes (the set-up goes back to its first step), and the
  account is read again.
- **What the API changed is shown at once, and read anew behind it.**
  After the second factor is turned on or off, the account that was read
  is given the state the API left it in (`withTwoFactorStatus` with
  `setQueryData`), and then invalidated, not removed: a removed query
  takes the screen that reads it back to its loading indicator, and the
  step it showed with it.

## The screens of a salon

The bookings of the admin application are the example to read:
`frontend/apps/admin-app/src/bookings/` (`day-bookings-screen.tsx` for the
list of a day, `booking-screen.tsx` for a booking and the operations of its
state, `booking-entry-screen.tsx` for a booking the salon puts in,
`booking-notes-screen.tsx` for the change of what it wrote down,
`booking-move-screen.tsx`, `booking-line-entry-screen.tsx` and
`booking-line-screen.tsx` for a move, a line added and a line taken away)
and `src/salons/` (the choice of a salon, the salon of an address).
Everything of "A screen that reads from the API" and of "A screen that
writes what it read" holds; this is what comes on top.

- **The salon is in the address** (`/salons/:salonId/…`), so that a screen
  can be passed on. A member of the staff belongs to one salon:
  `useOwnSalon` of the session package reads it (`GET /staff-profiles/me`)
  for `owner`, `manager` and `staff`, and says `platform` for `admin`
  without asking. `/` replaces its entry with the bookings of the own salon
  (`<Navigate replace>`) for a member, and is the choice of a salon for
  `admin` (a keyword, which the API matches in the name and the
  description). An account of a salon role that belongs to no salon (403)
  is told so (`NoSalonNotice`), and that the invitation of an owner brings
  it in.
- **The salon of the address is read once, around the screens below it**
  (`WithSalon` of `salons/with-salon.tsx`): its name is the description of
  the `PageHeader`, and its time zone and currency go to what is shown.
  While it is read there is the `LoadingIndicator` alone, as on a screen
  named after what it reads: the screen inside draws its own `PageHeader`,
  and a heading of the same title drawn anew in place of one that had the
  focus does not take it (`useScreen` moves the focus when the title
  changes), so the focus would be left at the top of the document. A
  salon that is not there has a heading that says so. The API refuses a
  member the bookings of another salon (403): the screen says that they are
  not theirs to see and links to their own (`OtherSalonNotice`). A booking
  of another salon under the address of this one is not found, for `admin`
  too.
- **The clock is the salon's.** Today is `dayAt(new Date(), salon.timezone)`,
  and a time is the time of day there (`salon-time.ts`, with
  `hourCycle: 'h23'`: midnight is 00:00). A `datetime-local` control is read
  on the clock of the salon and sent in UTC (`momentOf`); a time that the
  clock skips there is an error at the control, not a guess.
- **A list of a day asks for that day** (`bookingDateFrom` and
  `bookingDateTo` the same). Its conditions (`date`, `status`, `staffId`)
  are the query of the address and replace its entry (`booking-day.ts`); a
  day that is no day (2026-02-30, after 2999) is today. 前の日, 今日 and
  次の日 are links of a `nav` with a name of its own.
- **A row names what its record holds as IDs, read in bulk.** The customers
  of a page are read in one request (`POST /customers/batch/get`,
  `customers/customers-api.ts`). The API refuses the whole batch when one of
  them was removed (404), and they are then read one by one. The staff and
  the services come from the lists of the salon, read to their end. What is
  not there is named as such (「削除された顧客」, 「一覧にないスタッフ」,
  「削除されたメニュー」), and the row stays: its booking can still be
  moved on.
- **A table that goes on is `PagedTable`** (`src/components/paged-table/`):
  how many there are and how many are shown above the table, 50 rows at a
  time, 「さらに表示」 below it, and the focus on the link of the first row
  that was added.
- **What a state allows is a button of the part 「状態」**
  (`booking-actions.ts`: `actionsOf(booking, now)`). What leaves the
  booking open is done at once (確定, 施術の開始); what closes it for good
  is asked first, in a `Dialog` (完了 with the times it actually took,
  キャンセル with a reason, 無断キャンセル). What the API would refuse is
  not offered: 無断キャンセル only once the booking has begun. A form in a
  dialog says what is wrong before anything is sent (an end before the
  beginning, also the one that was recorded).
- **After an operation the answer is the booking.** It is written into the
  query of the booking (`setQueryData`), the lists of the salon are removed
  (`removeQueries`: no list shows the state before), a notification says
  what was done, and the focus goes to the heading 「状態」 (`headingRef`),
  because the button that was pressed may be gone. What can be sent again
  is said where it was sent: on the page for 確定 and 開始, in the dialog
  for the rest.
- **A state changed elsewhere (409)** is said on the page, in one sentence
  (`CHANGED_ELSEWHERE`), the dialog closes, the lists are removed and the
  booking is read again; the focus goes to the heading 「状態」.
- **A search by a keyword is `KeywordSearch`** (`src/components/keyword-search/`):
  a `search` landmark named after what it finds, the keyword (`keywordIn`
  of `src/keyword.ts`: trimmed, at most 100 characters, none when blank) in
  a parameter of the address, and a link that clears it. Nothing is asked
  of the API without a keyword where the list would be the whole ledger
  (the customers).
- **A screen of steps keeps its steps in the address**
  (`booking-entry.ts`: `date`, `search`, `customerId`). Each search and the
  choice are entries of their own (a `Link`, `setQuery` without `replace`),
  so 戻る of the browser goes back a step; 「お客様を選び直す」 is a link to
  the address without the choice. The step that follows a choice is keyed
  by it, and the heading takes the focus when the choice changes. What was
  chosen is read again (`GET /customers/{id}`): one that is gone is said,
  with the way back.
- **The rows of a booking are `BookingLines`**, built as the rows of time
  slots of the portal (the component keeps the keys, the browser the
  values, the focus follows a press, removing a row renumbers the rest and
  hides the errors that named them). A row is named by its number
  (「明細 2 のメニュー」); the control names are those of the request
  (`services.1.serviceId`), so a refusal of the API lands at its control.
  What does not change from row to row (the member of the booking, the day
  of the visit) is asked once, above the rows; a row takes 「予約の担当と同じ」
  or 「決めない」 beside the members.
- **What can be found out before sending is a button of the form**, not a
  submit: it hands `new FormData(event.currentTarget.form)` to the screen,
  which reads what it needs (`readLines`), says what is missing at the
  controls as a submit does, and asks the API (`checkLine` per row). What
  was found out is shown at each row and in one sentence (`role="status"`)
  until a control it depends on changes (`onChange` of the `fieldset`).
  When the API refuses the booking for the same reason (409), the screen
  says so and runs the check itself.
- **A change of a record is a screen of its own** (`…/edit`,
  `…/reschedule`, `…/services/new`), opened with the record read anew:
  `WithBooking` of `bookings/with-booking.tsx` (`staleTime: 0`, shown once
  `isFetchedAfterMount`, nothing read behind the form), which names the
  booking below the heading. A change of some properties sends what
  differs from what it was opened with and nothing else
  (`readNotesChange`), so a property somebody else changed meanwhile
  stays; when nothing differs it asks nothing, says so and goes back.
- **A change is offered in the states the API takes it in.** The links of
  the page of a booking follow the same rules as the API (`isMovable`,
  `mayAddLine`, `mayRemoveLine` of `booking-moves.ts`); a screen opened
  at its address for a booking that does not take the change says why,
  in a sentence of the state, and leads back (`Unchangeable`).
- **What a change will do is shown while the values change.** The form of
  a move hands its values over at every change (`onChange` of the
  `fieldset`, `new FormData(event.currentTarget.form)`), and the screen
  shows the lines where the API would put them (`movedLines`, the rule of
  the API: every line as far as the first, the lines of the member of the
  booking to the new member). Values that are no move show a sentence in
  place of the lines.
- **A 409 the API does not explain is explained after it.** A move or a
  line is not checked before it is sent: the check of a member counts the
  booking itself, and a member who takes more than one at once may be
  found taken by it. After the refusal the booking is read again; in a
  state that no longer takes the change, it is written into its query
  (`setQueryData`) and the screen says why. Otherwise each line is checked
  where it would be, the booking left out (`checkLine(…, excluding)`):
  a member found taken is said under the line; a check that could not be
  made is said as such (`whyUnread`), never as taken; with every member
  free the refusal had another reason, and says that one. What was found
  out goes when a value changes.
- **A part of a record that the API does not change is added and taken
  away.** The page of a line reads it on its own
  (`GET /bookings/{bookingId}/services/{id}`) and says that another is
  added and this one taken away; its removal is asked in a `Dialog`.
  The API answers an addition with the line and a removal with nothing,
  and sums the booking up again, so the booking is removed from the cache
  (`removeQueries` with `exact: true`) and the page of the booking reads
  it. A line that stays (the last one, a finished booking) says why in
  place of the button; one that became the last meanwhile closes the
  dialog and says it from the booking read again.
- **A removal is offered to the roles the API lets remove** (owner, manager,
  admin: a constant of the screen; the role of `useSession`), asked in a
  `Dialog` that says what it is for and what to do instead (cancel a
  booking that will not take place). A refusal for good (409: a sale, a
  treatment record or a review refers to it) closes the dialog and is said
  on the page; what can be sent again is said in the dialog. After it the
  record is gone (`setQueryData` with `NOT_FOUND`), the lists are removed,
  and the screen leads to the list of its day.

### Money: a bill the API works out, payments in parts, a receipt on paper

The sales of the admin application are the example to read:
`frontend/apps/admin-app/src/sales/` (`checkout-screen.tsx` for the sale of
a booking, `sales-ledger-screen.tsx` for the ledger, `sale-screen.tsx` for
a sale, `payment-entry-screen.tsx` for a payment, `receipt-screen.tsx` for
the receipt, `sale-change-screen.tsx` for the change of a sale,
`refund-screen.tsx` for a refund, and the part 「取り消し」 of
`sale-screen.tsx` for the voiding), and the part 「会計」 of the page of a
booking (`components/booking-sale/`).

- **What belongs to a record is found from the record.** A booking has at
  most one sale that is not voided; the part 「会計」 of its page reads the
  sales of the booking (`GET /sales?bookingId=`, `staleTime: 0`) and shows
  that sale, or the way to enter one in the states that take it
  (`whyNoCheckout`), or why not. The checkout starts from the booking, at
  an address below it (`…/bookings/:bookingId/checkout`), and the address
  of a booking that has its sale leads to the sale.
- **The amounts are the API's.** The screen lists what is billed (the lines
  of the booking at the prices they copied, the services added at the
  prices of the menu) and asks `POST /sales/calculate` whenever it
  changes: the services added are state of the screen and part of the key
  of the query. What the API answers is shown only when it agrees with the
  lines on the screen (`agreesWith`: the sum of their prices and their
  discounts); a menu that changed after it was read is said, with
  「計算し直す」, which reads the menu again. What the request needs per
  line and the calculation gives for the whole (the tax) is shared out by
  the screen (`taxSharesOf` of `checkout.ts`: by the price of each line
  that leaves the tax out, what is less than a yen dropped, the yen left
  over one at a time from the first line), so the lines add up to the
  total that was shown.
- **A record a 409 may have made meanwhile is looked for.** When the API
  refuses a sale because the booking was billed meanwhile, the screen reads
  the sales of the booking, shows the one it finds, and says so in a
  `warning` notification. When it refuses a payment, the sale is read
  again and the screen says why from it (`whyNoPayment`: voided, given
  back, paid).
- **A choice says what it takes.** The payment methods are those the salon
  uses (`isActive`), in its order, each labelled with what it takes at once
  (「Credit Card（￥1,000から）」), in a `RadioGroup` one below the other. The
  amount starts at what is left to pay; more than that, or what the chosen
  method does not take, is said at the control before anything is sent. The
  fields of a card are there only for a method of cards.
- **What follows from a write is said where it leads.** After the payment
  that makes the total, the notification says that the receipt can be
  printed now, and the page of the sale offers it.
- **A document that is printed** is a screen of its own, read whenever it
  opens (the API keeps no receipt), with 「印刷する」 (`window.print()`).
  On paper there is the document alone: `AppShell` drops its header, its
  navigation and the link that skips to the content, the notifications
  are not printed, and what the screen shows besides the document is in a
  wrapper that `@media print` hides (`OnScreen` of `receipt-screen.tsx`).
  The `PageHeader` is inside that wrapper in every state of the screen, so
  that it stays one element and keeps the focus it took.
- **What a record bills is not changed in place.** The change of a sale
  sends what it records beside the bill (who took it, when, the note),
  and the screen says how a wrong bill is put right: every payment given
  back whole, the sale voided, the booking billed again.
- **An operation that is not for every role** is offered by the role
  (`mayUndoSales` of `sale-changes.ts`), and where it would be, the
  screen says who may (`UNDONE_BY_OTHERS`). Its address, opened by
  another role, says the same before it reads anything more.
- **A way of several steps says the next one after each.** The refund
  that gives back the last payment whole says that the sale can be
  voided now (`voidableAfter` of `refunds.ts`); the voiding of the sale of
  a booking says that the booking can be billed again.
- **When the part that was used is gone**, the focus goes to the heading
  of the part that stays: after a voiding, to 「売上」 (`headingRef` of
  `SaleRecord`). It moves in the commit that shows the sale the API
  answered: a ref keeps the sale the screen showed, and a layout effect
  on the sale moves the focus once it is another object.
- **A sentence is not put in a cell.** The cells of a table keep to one
  line, so the reasons the payments were given back follow the table, in
  a `DescriptionList` by the number of the payment, and the cell says how
  much and when.

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
| `Card` | A part of a screen under its own heading (`h2`, or `h3` with `headingLevel={3}`). With `headingRef`, the heading takes the focus from the screen (and never from the Tab key): for a part whose content went with what had the focus |
| `DescriptionList` | The names and values of one record |
| `Badge` | The state of a record, in a word |
| `TagList` | A few words about a record, as a list with a name: the features of a salon, what a member of the staff is good at |
| `Rating` | A rating out of five: the stars, the number, and how many gave it |
| `QrCode` | A QR code drawn from its text, as an image with a name: what an authenticator app reads. The text stays in the browser |
| `Table` | A list of records |
| `EmptyState` | What is shown where content would be, while there is none |
| `LoadingIndicator` | What is shown where content will be, while it loads |
| `UnreadNotice` | What is shown where content could not be read: the message the application words (`unreadMessageOf(what, reason)`), and the button that reads again |
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
  jsdom spell such a name differently. `Link` and `ButtonLink` take
  `aria-label`, as `Button` does.
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
  stands before the actions and takes the focus. The description breaks
  a word that is longer than the dialog: it may name what somebody else
  wrote. `onClose` is called once whenever
  it has closed; set `open` to false there. The Escape key is heard at
  `cancel`, at once: the browser fires `close` a task later, after which a
  press of the same button would find the dialog still open for the
  screen, and open nothing. It opens and closes in the
  commit that changes `open` (`useLayoutEffect`), before the layout effects
  of the components around it: the page behind it is inert while it is
  open, and a screen that closes it because its answer changed what it
  asked about moves the focus to the heading of what changed in its own
  layout effect (the story `ClosedByItsAnswer`). When the actions change (the
  form's 「戻る」 and 「発行し直す」, then 「閉じる」 beside the new backup
  codes), each button has a `key` of its own: without one, React turns
  the button that was first into the one that is first now, and the
  browser draws its colours changing from the one look into the other
  (`transition`), with too little contrast on the way.
- **Notifications** say what was done: `notify({ tone: 'success', message:
  '予約を確定しました。' })`. The notification stays, also after the screen
  has changed, until the user closes it or the next one takes its place;
  nothing disappears by itself. `NotificationProvider` stands at the root of
  an application that notifies, above its routes, and `AppShell` shows the
  notification at the top of the content. What went wrong with a form is said
  in the form, with an `Alert`.
- **A state is said in words.** A `Badge` holds the word (「確定」); its tone
  only groups. The current link of a `Navigation` is `aria-current="page"`.
- **Paper is a medium of its own.** `AppShell` and the notifications have
  rules for `@media print`; a screen that is meant to be printed hides
  what is for the screen alone, and the browser test looks at it with
  `page.emulateMedia({ media: 'print' })`.

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
