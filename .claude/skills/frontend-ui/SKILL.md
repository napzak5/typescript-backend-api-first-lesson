---
name: frontend-ui
description: "How the frontend of this repository is styled and how its components are built: design tokens, CSS Modules, layout with CSS Grid (never flex), the shared component package @beauty-salon-frontend/ui with its form components (label, description, error), the frame of a screen (app shell, navigation, table, dialog, notifications), how a form calls the API, how a screen reads from the API (a search kept in the address, a list that goes on, the parts of a page), how a screen writes what it read (a choice kept in the address, what is offered read anew, a refusal), the screens that need a session (sign-in, roles), the screens of a salon (the salon of the address, the clock of the salon, the operations a state allows, a bill the API works out, payments in parts, a receipt on paper, a ledger of the platform shown below a salon), the screens that a mailed link opens and the Storybook. Use it before adding or changing a component, a form, a stylesheet, a token, a story or the markup of a screen under frontend/."
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
| Typefaces (Inter, Noto Sans JP), and the test that they are loaded and named | `frontend/packages/theme/src/styles.css`, `typefaces.test.ts` |
| Reset and the styles of bare elements (body, headings, links, the focus ring) | `frontend/packages/theme/src/reset.css`, `global.css` |
| The check of the style rules | `frontend/packages/theme/src/style-rules.ts`, run by `style-rules.test.ts` over every package and app |
| The contrast of the colour tokens | `frontend/packages/theme/src/tokens.test.ts` |
| Shared components | `frontend/packages/ui/src/components/<name>/` |
| What a form was sent with and what it says, in every application and package: the value to send or the errors (`FormRead`), what is said of the attempt and at the controls (`FormSays`, `NOTHING_TO_SAY`, `aboutTheAttempt`), the text of a control and a text or nothing (`textOf`, `textOrNull`), the error of a control (`errorAt`), whether a form is sent as it opened (`same`, `NO_CHANGE_MESSAGE`) | `frontend/packages/ui/src/components/form/form-values.ts` |
| The screens of the session: sign-in, the guard of the screens that need one, the account in the header | `frontend/packages/session/src/` |
| The screens of the security of an account (the password, the devices that are signed in, the second factor), which every application puts at an address of its own, and the rule of a password that is chosen | `frontend/packages/session/src/security/` |
| Where the portal puts them: below the page of the customer | `frontend/apps/portal-app/src/security/` |
| The screens of an account in the portal: registering, a new password, and the screens that a mailed link opens | `frontend/apps/portal-app/src/account/` |
| The screens of the salons in the portal: the search and the page of a salon, and the components they show | `frontend/apps/portal-app/src/salons/` |
| The screens of a booking in the portal: choosing the member of the staff, the day and the time, the page of a booking, the bookings of a customer, and cancelling and moving one | `frontend/apps/portal-app/src/bookings/` |
| The page of a customer in the portal, and the form of their profile | `frontend/apps/portal-app/src/profile/` |
| What a customer wishes for in the portal: the part of their page, and the screen of the form | `frontend/apps/portal-app/src/preferences/` |
| The form of what a customer wishes for, which the portal and the admin application share: the form with the rows of time slots, how it is read and what a refusal says, the staff it offers, a list written a line each | `frontend/packages/preferences/src/` |
| The reviews of a customer in the portal: the part of the page of a visit, the form that writes a review and changes one, and the list with the dialog that removes one; what a reader of the page of a salon does with the reviews of others (`reader-flow.ts`, the dialog that reports one) | `frontend/apps/portal-app/src/reviews/` |
| Where a visitor signs in, and where they go on to from there | `frontend/apps/portal-app/src/sign-in-path.ts` |
| The links of the header of the portal, by who is signed in | `frontend/apps/portal-app/src/navigation.ts` |
| The salon of who is signed in (`useOwnSalon`), and what an account that belongs to none is told | `frontend/packages/session/src/salon/`, `src/components/no-salon-notice/` |
| How an answer of the API is read, in every application and package: why nothing came of a request (`Unread`, `Unsent`, `unreadOf`, `whyUnread`), the values it refused (`refusedValuesOf`), the parts of the patterns of the answers (`UNANSWERED_PARTS`, `REFUSED_PARTS`, their `PUBLIC_` forms for an operation that needs no session, `UNREAD_TYPES`), an answer the contract does not name (`outsideTheContract`), a page and a list read to its end (`pageOf`, `from`, `toTheEnd`), a list that goes on (`listingOf`, `cursorAfter`, `firstCursor`), whether a read came to nothing (`isUnread`), the sentences of too many requests and of what was not read or not sent (`unreadMessageOf`, `unsentMessageOf`), and of the values it refused (`CHECK_THE_VALUES_MESSAGE` for the attempt, `REFUSED_VALUE_MESSAGE` at a control) | `frontend/packages/answers/src/` (`@beauty-salon-frontend/answers`) |
| What the screens of a salon share, in the admin and the dashboard applications: a table that goes on (`PagedTable`), the search by a keyword (`keyword.ts`, `KeywordSearch`), the clock of a salon (`salon-time.ts`), the salons searched for and read (`salons-api.ts`), the start of an application, which leads a member to the first screen of their salon and lets `admin` choose a salon (`StartScreen`, `SalonChoiceScreen`, `SalonChoices`), the salon of an address around the screens below it (`WithSalon`), the period of a count with its form, and the days of a search (`period.ts`: `daysErrorsOf`; `StatisticsPeriod`), an amount and the names of the kinds of payment and of service (`format.ts`) | `frontend/packages/salon-screens/src/` (`@beauty-salon-frontend/salon-screens`) |
| The staff and the services of a salon that a booking names, in the admin application | `frontend/apps/admin-app/src/salons/` |
| The bookings of a salon in the admin application: the list of a day, a booking and the operations of its state, a booking put in for a customer who was searched for, the change of its notes and its removal | `frontend/apps/admin-app/src/bookings/` |
| The sales of a salon in the admin application: the checkout of a booking, the ledger of the sales, a sale with its payments, the form that records a payment, the receipt to print, the change of a sale, the refund of a payment and the voiding of a sale | `frontend/apps/admin-app/src/sales/` |
| The ledger of the customers in the admin application: the ledger, a customer registered, shown and changed, the choice of the customer who referred another, the change of the preferences, the removal and the way back, the history and its versions, the points and their recording, the customers of a file, the merge, the exports, the requests to have the data erased | `frontend/apps/admin-app/src/customers/` |
| The charts of the customers in the admin application: the chart, the form with the rows of the treatments had before, the search of the charts, the allergies of a customer with their form and their removal | `frontend/apps/admin-app/src/charts/` |
| The treatment records in the admin application: the list, a record with its removal, the form with the rows of the products used, the part of the page of a booking, the photos of a record with their form and their removal, the statistics over a period; the products of a salon, read to the end | `frontend/apps/admin-app/src/treatments/`, `src/products/products-api.ts` |
| A file the API answers with, saved by the browser: its name, the file of an answer, and the saving | `frontend/packages/io/src/libs/file/save-file.ts` (`fileNameOf`, `fileOfAnswer`, `saveFile`) |
| The links of the header of the admin application, by the role and the salon of the address | `frontend/apps/admin-app/src/navigation.ts` |
| The sales report of a salon in the dashboard: the screen with its period and its export as a CSV file, the four parts of a report, the words of its counts; the trends of the sales with their chart, the sales of one day, and the sales of every member of the staff and of every kind of service with a bar under an amount | `frontend/apps/dashboard-app/src/reports/` |
| The links of the header of the dashboard, by the role and the salon of the address | `frontend/apps/dashboard-app/src/navigation.ts` |
| The catalogue (Storybook), of the components of `ui`, of `session` and of the applications | `frontend/packages/ui/.storybook/`, `pnpm --filter @beauty-salon-frontend/ui run storybook` (port 6006) |
| The routes of an application, inside the shared frame `AppShell`, and the roles it is for | `frontend/apps/<app>/src/App.tsx` |
| The brand: the name of the product and of each application, the icons and the image of a shared link (`public/`) with the drawings they are drawn from (`sources/`, `pnpm --filter @beauty-salon-frontend/brand render`), and the Vite plugin that each application runs (`brand('admin')` in its `vite.config.ts`) | `frontend/packages/brand/` (`@beauty-salon-frontend/brand`, `@beauty-salon-frontend/brand/vite`) |

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
   | Label and value pairs | `grid-template-columns: fit-content(40%) minmax(0, 1fr)`: a long label goes on in a second line instead of taking the row |
   | Rows that share their columns | The list is the grid; a row is `display: grid; grid-template-columns: subgrid; grid-column: 1 / -1` |

   Write `minmax(0, 1fr)`, not `1fr`, for a track whose content may be long:
   a bare `1fr` grows with its content and overflows. A grid does not wrap
   items of different widths: a row that may not fit scrolls sideways
   (`navigation.module.css`), or becomes a column below a width (the
   buttons of a `Form`, an `Actions` of the layout `row`, and the actions of
   a `Dialog`, below 40rem). A row
   of links that scrolls is scrolled, by itself and alone, to put its
   current link in its middle whenever its links or the current one
   change, and not when it is drawn again (`navigation.tsx`). What
   follows each other like words (the tags of a salon, a rating with its
   date and a badge, the buttons of an `Actions`) is no layout: it stays in
   the flow of the text,
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
   `60rem`; a media query cannot read a token, so these two are written out,
   and no other width is, nor a `max-width` (`unknown-breakpoint`).
9. **The focus ring is global.** `global.css` draws it for `:focus-visible`.
   A component does not remove an outline; it may move the ring with
   `outline-offset`.
10. **Only the theme uses cascade layers.** The reset is in the layer `reset`
    and the styles of bare elements in `base`. The stylesheet of a component
    is in no layer, so it wins over both in whatever order the stylesheets
    load, and it needs no extra specificity and no `!important` to do so.
    The reset takes the margin of every element and the bullets of every
    list: a CSS Module does not say `margin: 0` or `list-style: none` again
    (`repeats-the-reset`), and a list that shows its bullets is a
    `BulletList`.
11. **A screen fits a window 320 pixels wide** (WCAG 2.2, 1.4.10): the page
    is no wider than the window, and nothing sticks out of what it is in.
    The browser of a phone shows a page that is wider shrunk, and then
    nothing that is fixed to the window, the overlay of a dialog as well,
    covers what is seen. A row of buttons is a row only where there is
    room. A `Button` puts a label that is longer than the line it stands
    in on a second line, between its words (a label may hold a name
    somebody chose), so a button is never wider than what it is in; it is
    not given `white-space: nowrap`. `narrow-screens.e2e.test.ts` opens
    every screen at that width: a new screen is added to its list.
12. **Type and density are the theme's.** The page is drawn in Inter (Latin
    letters and figures) and Noto Sans JP. `styles.css` of the theme loads
    both from the packages `@fontsource-variable/*`, so they are served
    with the application and no other site is asked; a browser fetches
    only the files of the characters a page shows. `typefaces.test.ts`
    checks that the packages, the imports and `--font-family` agree: a
    family that is misspelled is no error, the page is then drawn in the
    typeface of the system. The screens show much at once: text is 14px
    (`--font-size-body`) with 1.6 between its lines, small text 12px, the
    heading of a card 16px, of a section 20px and of a screen 24px. A
    control is 40px high for a finger and 36px where the pointer is a fine
    one (`--size-control`, which `tokens.css` sets in a media query): do
    not write the height of a control. Four gaps have a name, because
    many stylesheets have to agree on them:

    | Token | What it is | Value |
    |-------|------------|-------|
    | `--space-frame` | The room inside a frame: a `Card`, the conditions of a search, a `Dialog`, any box with a border of its own | 16px, 20px from 40rem |
    | `--space-parts` | The gap between the parts of a screen: its cards, a list of cards, the sections of a page | 16px |
    | `--space-content` | The gap between what a part holds one below the other: its heading, its sentences, its table, its buttons (`Card`, the content of a `Dialog`) | 12px |
    | `--space-fields` | The gap between the fields of a form or of a search | 12px |

    A frame, a stack of parts, a stack inside a part and a form use these
    names, not a step of the scale; a step is for what stands closer (a
    name and what it says, the lines of one entry). A part of a form (`FormPart`: a `fieldset` under its
    `legend`) is further from what stands before it than its fields are
    from each other, and that room is a margin of the fieldset, not a
    padding: the legend stands on the upper edge of the fieldset, so a
    padding ends up below the name (`.part:not(:first-child)` in
    `form-part.module.css`).

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
  passes the remaining props on and keeps a `className` it is given. A
  component with props of its own takes no `className`: what holds it
  places it, and its props are its looks.
- An optional prop is `?: T | undefined`, so a caller hands on a value that
  may be missing as it is (`exactOptionalPropertyTypes`). The same thing
  has the same name in every component: `label` names a control or a group
  of them, `description` says more of it, `pending` is an attempt on its
  way, `actions` what can be done from there, `tone` the state something
  says (a `Tone`: `info`, `success`, `warning`, `danger`, one stylesheet
  of colours in `tone.module.css`), `variant` the look of a button.
- A default is what most callers want, and a value equal to it is not
  written (`variant='secondary'`). What every caller gives is required (the
  `label` of `LoadingIndicator`). An option that no caller uses is removed
  with its story and its test.
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
  words that belong to a component itself are in it (必須, 閉じる, 戻る,
  本文へ移動, メインメニュー, ほかの操作).
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
| `TextField` | One line. `type` is `text` (the default), `email`, `password`, `tel`, `url`, `search`, `number`, `date`, `time` or `datetime-local`. `autoComplete` is required: the name HTML gives the value (`email`, `tel`, `family-name`, `bday`), or `off` for a value the browser knows nothing of (a tag, a note, the day of a booking). `width='short'` for a short value that stands alone in the column of a form (a date, a number, a code): the control is as wide as such a value, and its label and messages keep the width of the column. A control of a `FieldRow`, a `FormRow` or a `FilterForm` stands in a narrow column already, and keeps the default |
| `PasswordField` | A password that a person chooses. Its owner may look at it (「パスワードを表示する」). `autoComplete` is required: `new-password`, `current-password`, or `off` for one that belongs to no account |
| `TextArea` | Several lines: three in sight, `rows` for more |
| `Select` | One of a list. `placeholder` adds a first option without a value. `width='short'` as for `TextField` |
| `RadioGroup` | One of a few choices that should all be in sight. `layout='columns'` for many short ones (the times of a day): as many columns as fit, and the arrow keys go through them in the order they are read. Choices with long labels (the payment methods with what they take) stay one below the other: a label does not fit a column at 390px |
| `Checkbox` | One thing that is so or not so. `labelHidden` keeps the label for a screen reader alone: the checkbox of a row of a table, whose row says what it is about (「山田 花子 様を選ぶ」) |
| `CheckboxGroup` | Several of a few choices. The chosen values are sent under one name (`formData.getAll(name)`). `layout='columns'` for many short ones. It is a `fieldset`, where `RadioGroup` is a `radiogroup`: a group of checkboxes is never required as a whole, and one of radio buttons says so (`aria-required`) |
| `FileField` | A file to choose (`accept` names its kinds). The screen reads the chosen file itself (`onChange`, `event.currentTarget.files`); it is not sent with the form. Its button looks like a secondary button |
| `Alert` | A message about the form or the page: `info`, `success`, `warning`, `danger` |
| `Form` | The form itself: its controls in one column, the message about the whole attempt, the button that sends it and what else can be done (`actions`): one below the other and as wide as the form below 40rem, in a row from there (an `Actions` of the layout `row`) |
| `FormPart` | A part of a long form under its name (`label`: a `fieldset` and its `legend`), with what it says of all its controls (`description`, which the `fieldset` is described by) before them, in the look of a description. What else a `fieldset` takes (`disabled`, `onChange`) is handed to it |
| `FormRow` | One of the rows a form repeats (a past treatment of a chart, an option of a service, a line of an order, a day of the opening hours, a photo, a product of a treatment): a frame with its name on its upper edge (`label`: a `fieldset` and its `legend`), and its controls one below the other. `ref` reaches the `fieldset`, for the form that moves the focus into a row it added. The rows that are added and taken away are kept by `useRepeatedRows` |
| `FieldRow` | Two controls that are read together (a name and its kana, the start and the end), or three (`columns={3}`: the prices of a product), side by side from 40rem and one below the other below it. Each keeps its height, so their upper edges stay in line when one has a description |
| `FormDialog` | A question answered with a form (a cancellation and its reason, a tag for the chosen customers): a `Dialog` whose content is the form, with 「戻る」 and the button that sends it (`submitLabel`, `submitVariant='danger'` for what cannot be undone) among its actions. Enter in a control sends it, nothing is sent again while `pending`, and the focus goes to the first control with an error. `answer` is what the form brought when it is to be read before the dialog closes (the codes issued, the report made before): it takes the place of the form, with 「閉じる」 alone, and takes the focus |

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
- **The choices of `Select`, `RadioGroup` and `CheckboxGroup`** are
  `ChoiceOption`s (`{ value, label }`), and the two groups are laid out by
  a `ChoiceLayout` (`stack` or `columns`). A choice that may not be made
  is not offered, rather than offered and disabled.
- **`autoComplete`** is given for what a browser can fill in: `name`, `email`,
  `tel`, `current-password`, `new-password`, `one-time-code`. The address a
  person signs in with is `username`, so that a password manager finds the
  pair. Every other control of one line says `off`: the type of `TextField`
  and `PasswordField` requires the property, so none is left to the browser
  to guess from the name of the control.
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
- A form is a grid: `display: grid; gap: var(--space-fields)`. Fields that share a
  row are in a `FieldRow`. A field keeps its label, its control and its
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
  the API and decides what the form says. A form with steps is a component
  of its own around a `Form`, with its own stories: the sign-in form
  (`frontend/packages/session/src/components/sign-in-form/`, with
  `sign-in-screen/` around it), which moves the focus to the code when the
  second step begins.
- **Every form is a `Form`, a `FilterForm` or a `FormDialog`**, so that
  Enter sends it, the first control with an error takes the focus and its
  buttons stand alike. The conditions of a list, the days of a count and
  the day of a report are a `FilterForm`, also in a dialog (the search of
  the customer who referred another). Two are neither, and say why in
  their description: the booking form of the portal (choosing the staff
  or the day reads other times at once, and its button is there only
  while the day has a free time) and the file of customers to register
  (its button comes after the table of the file). They send and move the
  focus as `Form` does.
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
  (`answers`): the check of the types stays, and such an answer is
  `failed`. A match on a value of the application's own (an outcome, a
  variant) keeps the bare `.exhaustive()`: the code makes those values.
- **A pattern of the answers is put together where it matches**, from the
  parts of `answers`: `.with(P.union(...UNANSWERED_PARTS), unreadOf)`, and
  `P.union(...UNANSWERED_PARTS, { status: 403 })` for one more. The type of
  a pattern cannot be named outside `ts-pattern`, so no module exports one;
  and one kept in a constant is not checked against the answer it meets.
  Written at the match, a part that the operation cannot answer is a type
  error, and an answer that no part takes is one for `.exhaustive()`. An
  operation that needs no session answers no 401: its parts are
  `PUBLIC_UNANSWERED_PARTS` and `PUBLIC_REFUSED_PARTS`. A 400 that a form
  reads as the values it refused is matched before the parts, which then
  hold none. A module whose operations answer more (a body the API did not
  read: 413, 415) keeps parts of its own, typed as a tuple, and spreads
  them the same way.
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
- **The form of a search is a `FilterForm`, and keeps its values itself.**
  It is the one form with `value` and `onChange`: it shows the conditions
  of the address, also after the address changed without it (back,
  forward, 「条件を外す」), and adopts them while it renders when they are
  others than the last time (`useFilterValues(query, () => valuesOf(conditions))`
  of `ui`, `components/salon-search-form/`). It is given no `key`: a form
  that is built anew takes the focus from whoever sent it. `FilterForm`
  stands in a `search` element that has the name (`label`, 「サロンを探す」);
  the `form` inside has none. Its frame, the columns of its controls and
  its buttons are the same in every list, and the filter of a list gives
  it the controls only:
  - `children` are the controls in sight on every screen: the keyword, the
    day or the period a list is of, the customer a list was opened for.
    `conditions` are the others: in a row below on a wide screen, in a
    sheet on the bottom edge of a narrow one, which the button 「条件」
    opens. The button counts the conditions of the sheet that narrow the
    list (`conditionCount`, `countNarrowing(valuesOf(conditions), COUNTED)`):
    「条件（2）」. A search of one control has no `conditions`, and no sheet.
  - The controls in sight are one row of columns, as many as there is room
    for and each 12rem wide at least: a date or a choice is as wide as its
    column, never stretched along the row, and the filters of every list
    line up. The controls that stay in sight come first; a keyword, which
    has a description, and a pair of dates take two columns when the row has
    room for two (a container query, so that a narrow row keeps one).
  - The button that sends it says what it does: 「探す」 for a search of what
    was typed (`purpose='search'`, the default), 「表示する」 for a list that
    the chosen conditions narrow (`purpose='view'`). The link that takes the
    conditions away is 「条件を外す」 in every list, given as `clearHref`
    while they narrow it.
  - The sheet is part of the form. Closed, it still holds what was chosen,
    and the button in sight sends that too; sending the form closes it. An
    error of a control in it opens it again, with the focus on the control.
    A press beside it does not close it.
  - The names of the controls are the names of the conditions, and the
    form sends them as `FormData` (`noValidate`: a control says its own
    error).
- **A list goes on with 「さらに表示」** (`useInfiniteQuery`, with the
  cursor of the API as the parameter of a page; the pages are put together
  by `listingOf` and `cursorAfter` of `answers`, and what the button does
  and how many are shown by `moreOf` and `countOf` of `ui`). A list of cards is a `PagedList` of `ui`, a table a
  `PagedTable` of `salon-screens`; both are built on `LoadMore` and
  `useFocusOnMore`, so a screen writes none of what follows. The next
  items are added below those that are there, and the focus moves to the
  first of them, in a layout effect: the button that was pressed is gone,
  or further down. It moves once, and after a press: the button sets a
  ref, and the effect that sees more items moves the focus when the ref
  is set. Items that no press asked for (the list was read again, the rest
  of a page came later) leave the focus where it is. The focus goes to the
  first link of the item, or to the item itself (`focus='item'`) when it
  is to be read from its beginning: a review whose buttons come after its
  text, a device whose name is no link.
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
- **What somebody wrote may be long, and in any language.** A word
  longer than the line breaks where the line ends, in every component and
  on every screen: the page says so once (`overflow-wrap: anywhere` on
  `body`, in `global.css` of the theme), and no stylesheet says it again.
  A pair of a name and a long value keeps its two columns at every width
  (`salon-hours.module.css`) where a table would scroll. The browser test
  of narrow screens gives a salon a name of one long word, and opens the
  screens that show it.
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
  Names on their way are rows on their way (`moreOfRows` of `ui`: the button is
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
- **What cannot be taken back is asked first**, in a `FormDialog`
  (`components/booking-changes/`): the form is the content of the
  dialog, and its button stands among the actions, tied to it with
  `form`. The dialog names what it is about (the day and the hours of
  the booking). The component takes `open`, `onOpen`, `onClose`,
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
- **The parts of a long form are `FormPart`s**, a `fieldset` with a
  `legend` (a `div` with `role='group'` does not pass the lint). What a
  part says of all its controls is its `description`. Controls that share a row
  are a `FieldRow`, side by side from the width at which two of them fit
  (`min-width: 40rem`).
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
- **A value the record does not hold is `null`, and is given as it is**:
  a `DescriptionList` and a `Table` say 「記録なし」 for it, quietly
  (`NotRecorded`), and a sentence that needs the words takes
  `NOT_RECORDED` of `ui`. A function that names a value returns `null`
  when there is none, and the screen writes no words of its own: a text of
  several lines is given to `WrittenText` as it is, `null` and all. 「なし」
  (`NONE` of `ui`) is for what is none as a fact: an empty list, which a
  `TagList` says itself, zero, no booking, no refund, no visit. A `null` the contract names as a state is said as that
  state: the referral code that is 「未発行」, and 「なし」 for the referrer
  of a customer who came without a referral. A name without a value looks
  like a fault.
- **What the user cannot change is said where it would be asked for.**
  The address of a customer is that of the account, and then what the
  salons keep. The form has no control for it: a sentence among the
  controls of the contact says so, and whom to ask.

### A form with rows, with lists, and with choices that are read

What a customer wishes for is the example to read: the form is the
package `frontend/packages/preferences/`, and in the portal
(`frontend/apps/portal-app/src/preferences/`) `own-preferences.tsx` is the
part of the page and `preferences-screen.tsx` the screen of the form. It
is changed as the profile is, above, and adds what the profile does not
have.

- **A form that two applications write with is a package**
  (`@beauty-salon-frontend/preferences`): the customer writes the same
  record in the portal as the salon does in its ledger, under the same
  rules. The package has the component, how the form is read
  (`readPreferencesChange`), what a refusal says
  (`afterPreferencesChange`) and the choices it offers
  (`staffChoicesOf`). What an application reads, and the part of a page
  that shows the record, stay in the application: their readers differ
  (the customer is not shown a member nobody can read; the salon is told
  「一覧にないスタッフ」). The package is built as `ui` is (rslib, the
  condition `@beauty-salon-frontend/source`), its stories are listed in
  the catalogue of `ui`, and `Dockerfile.frontend` copies its manifest.

- **Rows that are added and taken away** are kept by `useRepeatedRows`
  of `ui` (`components/form-row/repeated-rows.ts`), in every form that has
  them: `components/time-slot-fields/` of the package, and in the admin
  application the treatments of `ChartForm`, whose rows are groups of four
  controls, the options and the services of a package, the dates of the
  opening hours and of a schedule, the photos and the products of a
  treatment, and the lines of a booking. A row holds what the form opened
  it with and what changes the controls it shows (a day the salon opens
  shows its times: `change`); rows that a choice brings along (the box
  that makes a package) are `addAlong`, and keep the focus where it is. A
  row that is a group of controls under its name is a `FormRow`; the times of the package and the lines of a booking
  are numbered rows of two columns, whose labels carry the number, and
  draw their own rows. The browser keeps what
  was typed, as in every control. A row has a `key` that stays with it (a
  counter, never its index), so a row that is taken away takes its values
  with it and the others keep theirs. The controls are named by the number
  the row has now, counted from 0 (`preferredTimeSlots.1.startTime`), and
  labelled by it as it is read (「時間帯 2 の開始」): no two controls of
  the form have one name. The buttons are `type='button'`.
- **The focus follows the press**, in a layout effect: to the first control
  of the row that was added (`rowRef` gives the hook the element of a row);
  to the button that adds a row after one was taken away (`addRef`), for
  its own button went with it.
- **An error names a row by its number**, and taking a row away renumbers
  the rows after it. The errors of an attempt are shown until a row is
  taken away, and again after the next attempt (a new `errors` object):
  the controls of the rows take the `errors` of the hook. A form with two
  lists has a hook for each, and taking a row away hides the errors of its
  own list.
- **A row that was left empty is not sent, and one that is half filled is
  an error** at the time that is missing. The rows of the request are then
  not the rows of the form, so what the API says of a row all the same is
  said about the attempt, not at a control.
- **A list is written a line each** in a `TextArea` whose description says
  so. A pure function reads it (`linesOf` of the package, which the
  forms of the preferences and of the reviews share): without the spaces around a line, without the
  empty lines, each value once. An error names the line as the control
  shows it (「2 行目を確かめてください。…」, `pictureAddressesError` for
  a list of addresses).
- **What the form offers is read with the record, as one answer.** The
  query of the form has one function (`readOwnPreferencesToChange`): the
  record, then what its choices come from (the salons the customer has a
  booking at, the staff each of them shows, a stored member that is not
  among them, the names of the salons). The salon's screen reads the
  same way what it offers (`readPreferencesToChange` of
  `admin-app/src/customers/customers-api.ts`): the staff of the salon of
  the address, and the members of other salons the record names. One of them unread is the form
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
- **A form in a dialog** (`components/review-report/`) is a
  `FormDialog`: it takes `message`, `errors` and `pending` as `Form`
  does, and its button among the actions sends it by the `form`
  attribute. Every time the dialog is opened it is a new form (a `key`
  that counts the openings): nothing that was typed or said the time
  before is there.
- **Where nothing can be sent any more, the form gives way to a
  sentence** (the account reported the review before: an `Alert` of the
  tone `info`), the `answer` of the `FormDialog`. The button that sent
  the form went with it: the answer takes the focus, in the layout
  effect of the commit that shows it, and 「閉じる」 is the one button.
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
  <AppShell title={title} navigation={items} account={<SessionAccount />}>
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
  of another role have none, and `AppShell`, given no links, draws no
  navigation (a landmark without a link says nothing) and no menu. The admin application gives
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
and `SalonChoiceScreen` and `WithSalon` of `salon-screens` (the choice of a salon, the salon of an address).
Everything of "A screen that reads from the API" and of "A screen that
writes what it read" holds; this is what comes on top.

- **The salon is in the address** (`/salons/:salonId/…`), so that a screen
  can be passed on. A member of the staff belongs to one salon:
  `useOwnSalon` of the session package reads it (`GET /staff-profiles/me`)
  for `owner`, `manager` and `staff`, and says `platform` for `admin`
  without asking. `/` (`StartScreen` of `salon-screens`) replaces its
  entry with the first screen of the own salon (`<Navigate replace>`) for
  a member, the bookings in the admin application and the sales report in
  the dashboard, and is the choice of a salon for `admin` (a keyword, which the API matches in the name and the
  description). An account of a salon role that belongs to no salon (403)
  is told so (`NoSalonNotice`), and that the invitation of an owner brings
  it in.
- **The salon of the address is read once, around the screens below it**
  (`WithSalon` of `salon-screens`): its name is the description of
  the `PageHeader`, and its time zone and currency go to what is shown.
  While it is read there is the `LoadingIndicator` alone, as on a screen
  named after what it reads: the screen inside draws its own `PageHeader`,
  and a heading of the same title drawn anew in place of one that had the
  focus does not take it (`useScreen` moves the focus when the title
  changes), so the focus would be left at the top of the document. A
  salon that is not there has a heading that says so. The API refuses a
  member the bookings of another salon (403): the screen says that they are
  not theirs to see and links to their own (`OtherSalonNotice`, told
  what the screen shows, who may see it and where their own begins). A booking
  of another salon under the address of this one is not found, for `admin`
  too.
- **The clock is the salon's.** Today is `dayAt(new Date(), salon.timezone)`,
  and a time is the time of day there (`salon-time.ts` of `salon-screens`, with
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
- **A table that goes on is `PagedTable`** (`salon-screens`):
  how many there are and how many are shown above the table, 50 rows at a
  time, 「さらに表示」 below it, and the focus on the link of the first row
  that was added, or on its header when the row has no link (the header
  takes the focus with `tabIndex` -1: a row of the history of the points
  made for no record). It is built on `LoadMore` and `useFocusOnMore`, as
  a `PagedList` is.
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
- **A search by a keyword is `KeywordSearch`** (`salon-screens`), a
  `FilterForm` with one control: a `search` landmark named after what it finds, the keyword (`keywordIn`
  of `keyword.ts` there: trimmed, at most 100 characters, none when blank) in
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

### A ledger of the platform: found, registered, shown, changed, removed, merged, and its points

The customers of the admin application are the example to read:
`frontend/apps/admin-app/src/customers/` (`customer-ledger-screen.tsx` for
the ledger, `customer-entry-screen.tsx` for a customer registered,
`customer-screen.tsx` for the page of a customer, `customer-change-screen.tsx`
for the change, `customer-preferences-screen.tsx` for the preferences a
salon changes, `with-customer.tsx` for the customer of the address,
`removed-customer.tsx` for one who left the ledger,
`customer-history-screen.tsx` and `customer-version-screen.tsx` for the
history and a version, `customer-points-screen.tsx` and
`point-entry-screen.tsx` for the points and their recording,
`customer-import-screen.tsx` for the customers of a file, the choice
of `customer-ledger-screen.tsx` for customers written at once, and
`customer-merge-screen.tsx` for two records of one customer made one,
and `customer-export.ts` for the ledger and a customer saved as files).

- **A ledger that belongs to no salon is still shown below one.** The
  customers are one ledger for the platform, and every address of the
  salon shows the same one: the salon of the address gives the clock (the
  days of a registration, of a visit) and the part that counts what a
  customer did there. A member of another salon reads the ledger, and the
  part that counts is refused alone (403, `OtherSalonNotice` in the part).
- **The conditions of a ledger are the query of the address**
  (`customer-ledger.ts`: `customerConditionsIn`, `customerQueryOf`). A
  search replaces the entry; 「条件を外す」 is a link to the address without
  a query. What the address holds that the API does not take (a day that
  is none, an end before the start, a state that is none) is no condition,
  so an address changed by hand shows what is left of it; the same in the
  form is said at the control and nothing is asked. Days of the salon are
  sent as the moments they begin and end (`startOfDayAt` of
  `salon-time.ts`; the end a millisecond before the next day begins). An
  empty ledger and an empty search are two sentences, and both offer to
  register one.
- **Values of a list are written in one control** (the tags: commas of
  either width or 「、」, `tagsIn`): what is between two of them is one
  value, nothing is none, a value written twice is one. They are shown
  joined by 「、」 in the form and as a `TagList` on the page.
- **A form of many properties is in fieldsets by subject**, each control
  named as the property of the request (`preferences.preferredServices`),
  so that a refusal of the API lands at its control. Every control has
  `autoComplete="off"`: the person who fills it in is the salon, not the
  customer, and the browser would offer the salon's own address. A new
  record starts at the values a new one has in the ledger (the rank, the
  state, active).
- **A value that names another record is chosen, not typed** (who
  referred the customer: `components/referrer-field/`,
  `components/referrer-dialog/`, `referrer-choice.tsx`). The form shows
  the name in a `TextField` that is `readOnly`, which says a refusal of
  the API and takes the focus as every control does, and sends the ID in
  a hidden control. 「紹介元を選ぶ」 opens a `Dialog` that searches the
  ledger by a keyword with a form of its own, and a name pressed there is
  chosen (`FoundCustomers` of `found-customers.tsx`: `CustomerChoices`
  with `choose: { type: 'button' }`, the table the booking search and the
  merge show with links). The dialog is `wide`, so that the
  columns that tell two customers of one name apart are seen on a wide
  screen without scrolling, and the names are bordered buttons, as a
  button in a row of a table is; 「紹介元を外す」 takes it away
  and puts the focus on the button that chooses. The dialog is rendered
  after the form, through a render prop (`chooseReferrer`): a form inside
  a form is no HTML. The record the form is about is found too, named
  「（このお客様）」 without a button, as the API refuses it. The name of
  the stored value is read before the form opens; one that is gone is
  named as such (「台帳にいないお客様」) and is not sent unless changed.
- **A conflict that does not say which value is found out.** The API
  answers 409 for an address of mail or a referral code that another
  customer has, and does not say which. A request that named one says it
  at that control; one that named both searches the ledger for the
  address (`duplicateIn` of `customers-api.ts`) and says it at the address
  when another customer has it, at the code when not. The rules differ
  (the code of a removed customer stays taken), so the sentence of each
  control says its own.
- **The page of a record is a record and parts that read on their own.**
  The record shows what was read before and what is read anew when it
  comes (`WithCustomer` with `fresh={false}`); the form that writes it
  waits for the read anew (`fresh`). The record names another record it
  points to once it was read, and leads to it all the same until then
  (the referrer: 「紹介したお客様」). Each part (好み設定, このサロンでの利用)
  is a query of its own, `staleTime: 0`, keyed by the customer, and says
  its own loading, failure and refusal in its `Card`, so one part that
  fails leaves the rest of the page.
- **What a part names by ID is read one by one** when there are a few
  (the members of the staff a customer wishes for or avoids:
  `GET /staff-profiles/{id}` each), and one that is not found is named as
  such (「一覧にないスタッフ」); a failure of one is a failure of the part.
- **A period is in the address too** (`from` and `to`, both counted,
  `period.ts` of `salon-screens`), at most the days the API counts over (366),
  the year up to today when the address has none it takes. The form of the
  period is a `form` with a name of its own, beside the part it counts.
- **Ledgers lead to each other.** The name of the customer of a booking is
  a link to the customer; the page of a customer enters a booking of
  theirs (`/bookings/new?customerId=`, the step after the choice); a
  booking search that found nobody leads to the registration, whose
  customer is booked from their page.
- **A record that leaves the ledger stays at its address** (the removal
  of a customer: `components/customer-keeping/`, `removed-customer.tsx`,
  `components/removed-record/`). A `Dialog` asks first and says what
  follows, the way back too. The API answers 404 alike for a removed
  customer and for none, and keeps the history of both: the screen of a
  keeper of the ledger reads the latest version (`readRemoved`), and its
  operation tells a removal that can be undone (`delete`) from one that
  cannot (`merge`, `erase`), which is said instead of the button. Who may
  not read the history is told that nobody is there, as before. A removal
  or a way back keeps the address and swaps what it shows: the query of
  the record is set to what the API answered (404, or the customer that
  came back), and the lists and the queries below the record are removed
  (`forgetCustomer` of `customer-screen.tsx`). The query of the record
  itself is set, not removed: the screen observes it, and a query removed
  under an observer leaves the screen on what it showed. The button went
  with what it did, so the heading takes the focus in the commit that
  shows the other side: a ref flag set by the mutation, read by a
  component on either side (`HeadingAfterMove`). A removal by another
  account meanwhile (404) shows the same side without the notification.
- **A way back that changes little needs no dialog** (台帳に戻す: another
  removal undoes it). A refusal that is about another record leads to it:
  an address of mail taken meanwhile is said with a link to the ledger
  searched by that address. A refusal because the record changed
  meanwhile reads it again.
- **Who changed a record is named as the screen can tell.** The API names
  an account by its ID, and a salon cannot read names of accounts: the
  account signed in is 「あなた」, the account of the customer 「お客様ご本人」,
  any other 「ほかのアカウント」, and the values the history began with have
  nobody (`changerNameOf` of `customer-history.ts`).
- **A version is shown as the record is, beside the one before it.** The
  items of the record (their words, their order, how each writes its
  values) are one list that the page of a customer, a removed customer and
  a version share (`components/customer-record/ledger-items.tsx`). What a
  version changed is the items that show something else than in the
  version before (`changedItemsOf`, each item compared by what it shows,
  so one value shown in two items is two comparisons), in a `Table` of the
  item, the version before and this one; the history names the items the
  API says were changed (`changedTermsOf`), and a value no item shows by
  the name the API gives it.
- **The parts of a page that the whole platform writes are read each on
  its own** (the balance, the points that expire soon and the history of
  the points: `customer-points-screen.tsx`). Points are a customer's, at
  every salon: each part is read whenever it is shown (`staleTime` 0) and
  says its own failure where it would be. A row that names a record of a
  salon reads that record (`SaleName`, `BookingName`, with the queries of
  the screens of the sales and the bookings): a record that is found is a
  link by its number to its page at its own salon, one the account may not
  read (404) is named as of another salon, and one being read is named by
  its kind.
- **What a form records is chosen, and the count is always positive**
  (`components/point-entry-form/`, `points.ts`). A `RadioGroup` says which
  way the balance moves (付与, 利用, 調整で増やす, 調整で減らす), and the
  request carries the sign: nobody types a minus and moves the balance the
  wrong way. What the role may not do is not offered (`pointKindsFor`). A
  control that belongs to one choice only (the day the points given
  expire) is there while that choice is made.
- **A record that another page offers comes in the address, and is read
  before it is offered** (`?saleId=&kind=` from the part 「ポイント」 of a
  sale). The form offers it as a checked `Checkbox` named by its number,
  its time and its total; unchecking it records for no record. One the
  operation would refuse (void, of another customer, of nobody, not found)
  is said in a warning `Alert` and not offered (`offeredSaleOf`).
- **A refusal the API does not explain is explained by reading again**
  (`whyRefused`): after a 409 the screen reads the balance and the record
  of the request, and tells a void sale, a balance too small (said at the
  count, with the balance), a balance above the largest, and a record that
  has its points already. Only what none of these explains is said as a
  failure.
- **A file is read in the browser, by the rules of the form**
  (`customer-file.ts`, `customer-import-screen.tsx`). Each row of a CSV
  file goes through the reading of one customer typed in the form
  (`readCustomerEntry`), so the file and the form never disagree on what is
  right. Everything that is wrong is said at once, by row and by the word
  of the item (「3 行目 メールアドレス: …」), in a danger `Alert` with a list,
  and nothing is sent until a file without a fault is chosen. The columns
  are the names of the API, as the export of the ledger writes them, so an
  export comes back as it is, and what only the export has is passed over.
  The text is UTF-8, or Shift_JIS when UTF-8 cannot read it (what a
  spreadsheet in Japan saves). A file without a fault is shown as the
  customers it holds before it is sent (`CustomerImportForm`): the control
  and what is wrong stand in the column of a form, the table takes the
  width of the page, which its columns need, and the button that sends
  comes after the table, tied to the form with `form={id}`. The form is
  built as `Form` builds its own (`useErrorFocus`).
- **A write of many is one request, and its refusal is said at the row**
  (`afterRegistration`). The API writes all or none: a value it refuses is
  named by the place of the customer in the request (`items.<n>.<item>`),
  which is a row of the file; a value another customer has is in the
  `detail`, and is found among the values of the file as a whole word.
- **Rows are chosen for a write in the table that lists them**
  (`CustomerTable` with `choice`, `ChosenCustomers`). A `Checkbox` with a
  hidden label in a first column, the name heading the row (`rowHeader`).
  The part above the table says how many are chosen and holds the
  buttons; before anybody is chosen it says what choosing is for, so the
  table does not move when the first is chosen. A choice belongs to the
  conditions it was made under: other conditions choose nobody, and
  taking them back does not bring the choice back. More than the API
  takes at once is said, and the buttons wait.
- **A write of the chosen reads them first, and sends only what changes**
  (`retagCustomers`). The tags of each are read anew and changed from
  there, so a tag given meanwhile stays; who would not change is not
  sent, and when nobody would, nothing is. Who left meanwhile (not read
  anew, or after a 404 that names the first alone) is let go of and
  nobody is written: the screen says who, and reads the ledger again.
- **When the last of the chosen goes with what was pressed, the focus
  goes to the heading of the part** (`ChosenCustomers`): the buttons went
  with them, and the browser would leave the focus at the start of the
  page. A choice let go of in the table keeps the focus there; a dialog
  whose opener is still there gives the focus back to it (the browser).
- **What cannot be undone shows what it makes before it is asked for**
  (`customer-merge.ts`, `CustomerMerge`, `customer-merge-screen.tsx`).
  The other record is found by a search in the page, and the keyword
  and the one chosen are the query of the address (`keyword`, `with`),
  so a page opened again shows the same two. The items the two differ in
  are a table of the item, both values and the value after the merge,
  which the screen works out by the rules of the API (`mergedLedgerOf`),
  and the items of the ledger share their words with the page of the
  customer (`comparedItemsOf` of `ledger-items.tsx`). Its values are
  columns of text that keep their lines (`wrap: 'lines'`): notes and
  addresses are long, and the value after the merge is the column to be
  seen. What the API
  refuses a merge for is read with the other (a pending request of
  erasure, the charts) and said in full instead of the button. Two
  customers of one name are told apart by their address of mail
  (`whoIs`) wherever the screen names one of the two.
- **A file the API makes is saved by the browser, under the name the
  API gives** (`customer-export-api.ts`, `customer-export.ts`; `saveFile`
  and `fileNameOf` of `io`). The API answers with the file as its body
  and keeps nothing: the screen reads the name from
  `Content-Disposition` (which the API exposes to the pages of the
  applications through CORS) and presses a link to the file in memory.
  The rules of the name are not copied into the screen; an answer
  without one saves nothing. What the fetch function changed is undone:
  a CSV file gets its mark of the byte order back, a JSON file is
  written as the API indents it. The button that exports stays where it
  was and keeps the focus; what was saved is a notification, with the
  name of the file and what it holds (「2 人のお客様を、…csv に出力しました。」),
  and why nothing was saved is an `Alert` beside the button, as the
  conditions it was asked under have it: other conditions are another
  export. A file that would hold nothing (the names of the columns
  alone) is not saved, and that is said. The ledger is exported under
  the conditions of the address, which are those of the table shown.
- **What the salon answers when a customer asks for their data is a
  part of its own** (「ご本人からの請求」, `CustomerRequests`), before the part
  that keeps the ledger: it says what the file is for and that the salon
  makes sure who asks. A member of the staff is told who answers. It
  holds a card of its own for each request (`headingLevel={3}`): the
  data handed over, and the data erased (`CustomerErasure`). The latter
  shows the latest request of the customer and what became of it, the
  moments at the salon; a new request is taken in a dialog that asks
  for its reason, and a pending one is called off after a dialog asks.
  What was done, and what the API refused or changed meanwhile, closes
  the dialog and the heading of the card takes the focus; the refusal
  is said under it, and the customer is read again (an erasure that
  was run meanwhile shows them as removed). The page of a removed
  customer shows the request too, and calls a pending one off; it takes
  none, as the API takes a request of a customer in the ledger only.
- **A refusal that closes the dialog reads again and takes the focus
  to the heading of the part** (`MergeWith`). The 409 of a merge closes
  the dialog, says that the two were read again, and the reasons come
  from what was read, not from the `detail`. The dialog and maybe its
  opener are gone: a layout effect on the refusal moves the focus to
  the heading, after the dialog closed in its own layout effect.

### A record a customer has once: shown, made, changed, searched

The charts of the admin application are the example to read:
`frontend/apps/admin-app/src/charts/` (`chart-screen.tsx` for the chart,
`chart-entry-screen.tsx` and `chart-change-screen.tsx` for the form,
`with-chart.tsx` for the chart of the customer of the address,
`chart-search-screen.tsx` for the search).

- **A record a customer has at most once is below the customer**
  (`/customers/:customerId/chart`), not below a list of its own: it has
  no address of its own to the person who uses it. The page says what
  the record is for and offers to make it when there is none (the API
  answers 404 for none). Making it and changing it are two addresses
  (`/new`, `/edit`), as the two requests differ; each, opened for what
  is not so (a chart that is there, one that is not), says so and leads
  to the other instead of a form.
- **Made meanwhile by another account (409) is a refusal that keeps
  what was written**: the form stays as it is, says what happened and
  offers a link to the form that changes the record that is there, to
  add to it.
- **The rows of a list of several controls are the rows of the
  preferences** (above): `ChartForm` keeps groups of four controls, named
  by the number of the row, and its errors are hidden once a row is
  taken away. A list the API puts in place of the one it holds is sent
  whole when it was changed, and left out when it was not.
- **A long text in a cell is a column of text** (`wrap` of the column
  of `Table`: `words` for the products of `ChartTable`, `lines` for the
  notes of `ChartRecord`), as the values of the merge are. A table of
  seven columns (`AllergyList`) has the actions of a row one below the
  other, and scrolls on a screen narrower than a laptop.
- **A list of records that name their customer by ID reads the customers
  of the page at once** (`readCustomers` of `customers-api.ts`), and a
  customer who left the ledger between the two reads is said to have
  left, without a link.
- **A record of which the API reads none by itself is found in its
  list** (`findAllergy` of `allergies-api.ts`): the list is read to its
  end in its largest pages (`toTheEnd`), and an ID that is none, or of
  the record of another customer, is not found and says so, with the way
  back. Its form opens once it was read anew, as any form that changes.
- **A 404 that may name two things is read again, not guessed**: the API
  answers 404 to a change of an allergy both when its customer left the
  ledger and when the allergy was removed. The screen reads the customer
  and the allergy again (the key of the customer, below which both are),
  and shows what it finds: the customer not found, or the allergy not
  there.
- **A row a list removes after a dialog gives the focus to the heading
  of its part** (`AllergyList`): the button of the row goes with it. The
  dialog names the row (「強い香料の記録を削除しますか？」), the buttons of
  the rows say which row they are for to assistive technology, and what
  changed meanwhile closes the dialog and is said under the heading. The
  roles that may not remove see no button, and are told who does it.
- **A state that a colour sets apart is said in a word first**
  (`severityToneOf`): the two heaviest severities are a badge of a tone
  of their own, every severity is its word.

### A record of a visit: written from its booking, found, changed, removed

The treatment records of the admin application are the example to read:
`frontend/apps/admin-app/src/treatments/` (`treatments-screen.tsx` for
the list, `treatment-screen.tsx` for a record and its removal,
`treatment-entry-screen.tsx` and `treatment-change-screen.tsx` for the
form, `with-treatment.tsx` for the record of the address with what it
names, `components/booking-treatment/` for the part of the page of a
booking).

- **A record a booking has once is written from the booking**
  (`/bookings/:bookingId/treatment/new`) and has an address of its own
  (`/treatments/:treatmentId`), as the API reads it by its ID. The page
  of the booking has a part that says, by the state of the booking,
  whether its record is written, can be written, or is not written of
  (`BookingTreatment`, a match on the state): the operations a state
  allows are offered by the state, as the operations of a booking are.
- **The salon of a record is that of its booking**: the API serves the
  records at addresses that are not below a salon. The screen reads the
  booking, and a record whose booking is of another salon is not found,
  as a booking of another salon is not.
- **What a record names is read once the record was, in the component
  that reads the record** (`skipToken` of TanStack Query in
  `with-treatment.tsx`), and every state of the reads renders the heading
  in the same place. A heading rendered by another component once a read
  ended is another element: the focus the frame gave the heading of the
  screen is lost, and the keyboard goes on from the top of the document.
  Two screens one leads to have two titles (「施術記録」 for the list,
  「施術記録の内容」 for a record): the frame gives the heading the focus
  when the title changes.
- **Choices offered as checkboxes are read in the order they are
  offered**, which is the order of the menu, not of the record: a change
  compares them as sets (`sameServices` of `treatment-form.ts`), and a
  form opened and sent as it was asks the API for nothing.
- **A row of a product writes what the product decides**: choosing the
  product writes its unit into the row, and the control of the lot
  number is there only for a product kept by lots, as the API requires
  the lot of one and refuses it of another. The products offered are
  those the salon uses in treatments and still sells, and the one the
  row holds; a product that was removed is named as removed. The
  products are read to the end of their list once (`readProducts`), as
  the API has no search by name.
- **A 409 that may mean two things is read again, not guessed**: the
  API refuses to write a record both for a booking that has one and for
  one whose treatment has not begun. The screen reads the record of the
  booking again and says which it is: the record that is there, with a
  link to it, or the state of the booking, which is read again.
- **What a form records but does not do is said where it is recorded**:
  the products used move no stock, and the part of the form says that
  the stock is moved on the screens of the stock.

### What a record holds by address, and what a period counts

The photos of a treatment record and the statistics of the records are
the example to read: `treatment-photos-screen.tsx` with
`components/photo-form/` for the photos added, `components/treatment-photos/`
for the part of the page of a record, `treatment-photos.ts` for what the
form reads and what the answers say, and `treatment-statistics-screen.tsx`
with `components/treatment-statistics/`.

- **A file the API does not keep is an address**: the API keeps the
  address of a photo, not the photo. The form says where the photo is put
  first, and checks the address by the rule of the API (`z.httpUrl()`: a
  web address of a domain name, 500 characters at most), so that what the
  API refuses is said before it is sent. The image of a photo has an
  empty `alt`: its caption names it, says what it shows and how it may be
  used, and the link to the photo opens it in the same tab.
- **A limit of rows is the room left**: a record holds twenty photos. The
  form offers as many rows as there is room for, says how many are left
  when no more can be added, and a record that is full shows why instead
  of the form. The rows are added and taken away as the rows of a form
  are (focus on the first control of a row that was added, on the button
  that adds after one was taken away).
- **A rule of the API that ties two controls is checked on the row**: a
  photo shown outside the salon needs the consent of the customer. Both
  checkboxes are offered, and the one that breaks the rule is told so
  under it, as the API would.
- **A 409 of a list of rows says which row**: the API refuses photos at
  an address the record holds, or more than it has room for. The screen
  reads the record again, says under its control the row whose address
  is held now, or how many photos the record has room for now, and checks
  the next attempt against what it read.
- **A count over a period is read whenever it is shown**
  (`staleTime: 0`), its days are in the query of the address
  (`StatisticsPeriod` of `salon-screens`, shared with the statistics of a
  customer: a `FilterForm` whose button is 「集計する」), and a
  period in which nothing was written says so instead of a table of
  zeros. What a count counts twice (a record of two categories counts in
  both) is said under the table.

The sales report of the dashboard is the example of a report of the
salon: `reports/sales-report-screen.tsx` with `components/sales-report/`,
`sales-report.ts` for its words and for what an export says, and
`sales-report-api.ts`.

- **A report starts with the days its readers look at most**: the month
  up to today at the salon (`monthUntil`), or the days of the address
  (`periodIn`, which keeps the period it is given when the address holds
  none the API counts over). It is read whenever it is shown, and what an
  earlier screen read is not shown meanwhile (`isFetchedAfterMount`): a
  sale is entered at every checkout.
- **Each part says how it counts, under it**, where its sum is another
  than that of the sales: what was received leaves out what is not paid
  yet, a kind of service leaves out the products, the sales of a member of
  the staff hold the products and their counts do not.
- **An export is a button of the header, while there is something to
  export**: the file is the one the API makes, under its name; what was
  saved is a notification that names the days and the file, and the
  button keeps the focus. Why nothing was saved is an `Alert` under the
  header, for the days it was asked for: other days take it away.
- **What was wrong with a form is said for what the address showed when
  it was sent**: a link to another day, or the header, changes what is
  shown, and the error goes with it (`usePeriodCount` of the report, the
  staff and the kinds of service; `Refused` of the trends and the day).
- **A part of a report leads to the whole of it over the same days**:
  the five who sold the most link to every member of the staff, the kinds
  of service to their own screen, the period of the report in the query.
- **A bar under an amount of a table** (`ShareBar`) compares the rows at a
  glance: as long as its share of the most, or of the whole, in the one
  colour of the accent on a track of `--color-surface-sunken`. It holds no
  text; the amount above it is what is read.
- **Further choices of what is counted are children of
  `StatisticsPeriod`**, the other conditions of its `FilterForm`: after
  the days on a wide screen, in the sheet of a narrow one. The parts a
  trend is cut into are a `RadioGroup` whose value is in the address
  beside the days (`period`), sent with them.
- **The days before and after are a `PeriodSwitch`** of `ui`: the links
  to the period before, to the one that holds today and to the one after,
  in that order (「前の日」「今日」「次の日」, 「前の週」「今週」「次の週」).
  A period that cannot be shown (before the first day the API counts,
  after today for the sales) has no link.

A chart is a picture of a table (`components/trend-chart/` with
`components/sales-trend/`):

- **The table holds the numbers, the chart draws them**: the chart is
  `aria-hidden`, the table beside it is read, and both are on the screen.
- **A chart is a grid of columns**, one a part (`grid-template-columns:
  repeat(n, minmax(0, 1fr))` inline), each a block whose height is its
  share of the scale. Columns are no wider than `1.5rem`, rounded at the
  top by `--radius-small`, in the one colour `--color-accent`, and stand
  apart by a gap of 2px, none when there are more than 60.
- **One scale from 0 to a round amount** (`scaleTopOf`: 1, 2 or 5 times
  a power of ten), hairlines at its top, its half and its zero, and its
  amounts beside them (`axisAmountOf`: short from ￥10,000 on). The axis
  names the first and the last part alone; the amount of a part shows on
  a pointer over its whole height, a tip of CSS that opens towards the
  middle.

### A ledger that some roles keep: registered, changed, made inactive, removed

The staff ledger is the example to read: `staff-ledger-screen.tsx`,
`staff-entry-screen.tsx`, `staff-member-screen.tsx` and
`staff-change-screen.tsx`, `with-staff-member.tsx` for the frame they
share, `staff-api.ts`, `staff-form.ts` and `staff-format.ts`.

- **A role that may not keep the ledger is told so before anything is
  read**: the API refuses a manager and a member of the staff, so the
  screen tells them without a request (`useKeepsStaffLedger`), and the
  navigation has no link for them. A refusal that depends on the salon
  (the owner of another salon) is the 403 of the API, and is told in the
  same words.
- **A 409 that does not say which value**: the API refuses an address of
  mail or a staff code another member has, and does not say which. A
  removed member keeps their code but frees their address, so the screen
  reads the whole ledger for another member at the address (case left
  aside), and puts the refusal under the address if there is one and
  under the code if not; a change that sends only one of them needs no
  reading. Two refusals of the same status are told apart by the code
  of the problem (`3002` a value another member has, `3003` the
  member of the account itself), never by its text.
- **What the account may not do to itself is not offered**: the member
  the signed-in account is linked to has no 「削除」, says why, and its
  form refuses unchecking 「有効なスタッフ」 at that checkbox before
  anything is sent.
- **Two flags that sound alike say what each does**: taking bookings and
  being active are two checkboxes, each with a description of what it
  changes for the customers and for the account of the member, and of
  how it is undone.
- **A removal the API refuses for what is linked to the row** says what
  is linked and what to do first, above the record, and the dialog of a
  removal says what stays (the bookings and the records of the member,
  the code) and what to do instead for a member on leave.

### A plan that is replaced whole: the shifts of a week, the schedule of a member

The shifts are the example to read: `shifts-screen.tsx`,
`schedule-screen.tsx` and `schedule-change-screen.tsx`, `with-schedule.tsx`
for the frame the two screens of a member share, `schedules-api.ts`,
`shift-week.ts` and `schedule-form.ts`.

- **A week is in the address** (`week`, a day of it, shown from its
  Monday), so that the way back leads to the week seen before; without
  one it is the week of today at the salon. The links to the weeks next
  to it are a `nav` of their own, as the days of the bookings are.
- **What applies on a day is worked out once a week, not asked seven
  times**: the schedule of every member is read once, and the row of a
  date wins over the row of its day of the week, as the API decides. A
  role that sees only its own row (a member of the staff) is given the
  row of the session's member; the API refuses the others.
- **A cell of several lines may break between its words.** A table
  keeps its cells on one line; a cell that already has several lines
  lets its words wrap (`white-space: normal` on its own element) and
  keeps a time and a mark whole, so that a week fits a wide screen.
- **A write that replaces the whole is sent against what was opened**:
  the schedule is read again first, and one that another account changed
  meanwhile is not replaced; the form says so above its controls, keeps
  what was written, and the next press replaces what is there then. A
  form sent as it was opened asks for nothing.
- **What the form does not show is still sent**: the rows of the days
  before today are kept as they were, and only a checkbox that names how
  many there are lets them go. A refusal of a row the form does not show
  is said above the form.
- **A row that means nothing is not sent**: a day of the week without
  work and without a note is no row, as the API takes a day off and no
  row alike; a day off with a note is kept, for its note.
- **Two choices are stacked**: `layout='columns'` of `RadioGroup` is for
  many short options, and breaks a word of two choices on a phone.
- **A name that some roles read in the ledger**: an owner and an
  administrator read the member in the staff ledger (an inactive member
  as well, whose schedule is planned before they come back); the other
  roles read the profile the customers see.

### What a member signs in with: an invitation, a role, an unlinking

The accounts of the staff are the example to read:
`staff-account-screen.tsx`, `accounts-api.ts`, `account-format.ts` and
`account-form.ts`.

- **Two reads that decide one view are read side by side**, and what is
  shown is a pure function of both (`loginOf`): a refusal of either
  first, then the account as soon as it is found, then the invitation.
  What is taken outside the screen (an invitation accepted from the link
  of its mail) is read whenever the screen opens (`staleTime: 0`).
- **A 409 that names no reason is explained by reading again**, in the
  order the API checks: the account (the invitation was accepted
  meanwhile), then the member (made inactive meanwhile), and only then
  the reason no read can show (an invitation of a minute ago). What was
  read is shown, what happened meanwhile is said above the cards, and
  nothing is said to have been sent.
- **A choice that gives power starts unchosen**: the role of an
  invitation is chosen each time. A change of a role starts at the role
  the account has, and a role the signed-in account may not give is not
  offered; the description says who gives it.
- **What the account may not do to itself is not offered**, as in the
  ledger: no change of its own role, no unlinking of itself.
- **A write shows what it made at once**: its answer is put into the
  query of what it changed (the invitation mailed, the account with its
  new role, no account after an unlinking), and the heading of the first
  card takes the focus when what the screen shows changed. A 404 of a
  write reads both again and says that they changed meanwhile.

### What a member writes of themselves: a profile the customers read

The own profile is the example to read: `own-profile-screen.tsx`,
`profile-api.ts` and `profile-form.ts`, with the controls it shares with
the staff ledger (`staff/introduction.ts`,
`staff/components/introduction-fields/`).

- **Controls that two forms write are one part**, read by one pure
  function, as the API holds both requests to the same rules: the
  ledger writes the introduction of any member, the member their own.
- **A form keeps what it was opened with** (`Opened` in the screen), and
  sends what was changed against that alone: the profile is read again
  whenever the screen opens and when the window comes back, and what is
  being written stays, as does what the salon changed meanwhile and the
  form did not.
- **What the salon decides is shown and said to be the salon's**, beside
  what the member writes; where the customers read it is a link to the
  other application.
- **A screen of the account that belongs to a role is among the links of
  the header** (`navigationFor`), last, on every screen of that role, not
  beside the account: on a narrow screen the account has room for two
  buttons beside the title, and the links scroll.

### A menu that some roles keep: what is below what, and what a removal leaves

The menu is the example to read: `menu-screen.tsx`, `service-screen.tsx`,
the screens of a service and of a category, `menu-api.ts`,
`menu-format.ts`, `service-form.ts`, `category-form.ts` and
`services-change.ts`.

- **Two lists that make one screen are matched together**
  (`menuOf`): a refusal of either is said as soon as it comes, that of
  the categories first, and the menu waits until both are read. A row
  whose group was not read is not dropped: it goes with the rows of no
  group, last.
- **A tree is named by its path** (`categoryPathOf`, guarded against a
  loop), in the captions of the tables as in the choices of a form, and
  a node is never offered below itself (`parentChoicesOf`).
- **A refusal that names a choice reads the choices again**: when the API
  refuses the parent, the error is said at the control and the list it
  offers is fetched anew, so the next choice is among what there is now.
- **The dialog of a removal says what becomes of what hung on the
  record** (children to the top, services to none), and the removal drops
  every list the record was in.
- **A form compares against what it was opened with**: the record of a
  form that changes it is not read again when the window comes back.
- **A box that makes a record of other records opens their rows**
  (`ServiceForm`): checking it adds as many empty rows as the fewest the
  API takes, and the rows are read only while it is checked. Clearing it
  sends the empty list with it, so the API is asked for what is undone in
  one request. A record that cannot be one (a service in a package) is
  offered a sentence that says why, not a box.
- **A removal refused for what holds the record (409) names it**: the
  lists are read again and the refusal is said above the form with what
  holds the record now and what to do first (`inUseMessageOf`).
- **A change of several records at once opens at 「変えない」**
  (`ServicesChangeForm`): every value is a select whose first choice
  keeps it, only what was chosen is sent, and a form that keeps
  everything is refused before the API is called. The records are
  checkboxes named with their group. The API changes all of them or
  none: when one was removed meanwhile, the lists are read again, and
  the boxes of the records still there stay checked.

### The settings of a salon: what is shown and what is changed

The settings are the example to read: `settings-screen.tsx`,
`salon-change-screen.tsx`, `hours-change-screen.tsx`,
`salon-entry-screen.tsx`, `settings-format.ts`, `salon-form.ts`,
`hours-form.ts` and `salon-removal.ts`.

- **A value that would change how everything else is read is shown,
  not offered** (the time zone and the currency): the form says why it
  cannot be changed, beside what it can.
- **A record of many values is compared value by value as the form
  reads it** (`readSalonChange`): blanks, an empty control and `null`,
  and the separators of a list are no change, so only what was changed
  is sent, and what somebody else changed meanwhile stays.
- **A number is put into a control as it is typed**: digits, never an
  exponent (`coordinateTextOf`), so that a form sent as it was opened
  reads back the same.
- **Dates of a calendar are shown from today at the salon on**
  (`calendarFrom`): the past ones are history, and a table with none
  says which hours apply instead.
- **A list the API replaces whole is sent whole, and only when it was
  changed** (`readHoursChange`): the week and the calendar are compared
  apart, as the form reads them, and what the form does not show (the
  dates before today, the period of the hours of a day) is sent back
  as it was. Before it is sent, the record is read again
  (`attemptHoursChange`), as for the schedule of a member.
- **What the form cannot hold is said before it is lost**: a day with
  more hours than the form has controls for says that saving the week
  keeps the first of them.
- **A value that cannot be changed later is chosen when the record is
  made**: the form of a new salon (`SalonForm` with `subject` of type
  `new`) offers the time zone and the currency, from what the browser
  knows (`Intl.supportedValuesOf`), and the form that changes a salon
  shows them. What the record needs before it is used (the hours, the
  menu) is given afterwards, and the salon takes no bookings online
  until then.
- **A removal refused for what the record holds says so where it was
  asked, with the way out** (`afterSalonRemoval`): a salon with
  bookings that are not finished says so in its removal, with a link to
  the bookings; what another attempt may change (a failure, too many
  requests) is said in the dialog.
- **What a removal leaves behind is dropped before the next screen**:
  the choice of a salon and the salon of the account are read anew, and
  the salon is put as not found, so that the start shows the salons
  that are left, or tells a member that no salon is theirs.

The payment methods (`src/payment-methods/`) are kept from the settings:

- **A value the API never changes is chosen once** (the kind of a
  payment method): the form of a change shows it as text, with what to
  do when it was chosen wrong.
- **A list another area keeps for long is taken away by a write**: the
  screens of the sales read the payment methods with the default stale
  time, so every write of a method takes the list away
  (`removeQueries` of `paymentMethodsKeyOf`), and the next payment is
  offered the methods as they are now.
- **What the records hold is stopped, not removed**: the API keeps a
  method a payment was received by (409). The dialog closes, and the
  form says to clear 「この支払い方法を使う」 instead.

The product ledger (`src/products/`) is searched and kept from the
header:

- **A choice is offered from what the salon holds**: the categories of
  the ledger are those of all the products of the salon, read to the
  end apart from the pages, and the category chosen stays among them
  when no product has it any more.
- **A new row opens as the API would store it without the values**:
  the form of a new product starts from the defaults of the columns
  (used in treatments, carried, a minimum stock of 0), so a product
  added without touching them is the one the API would have made.
- **The pages of a ledger are read below the list they come from**:
  the pages are kept under the key of all the products, so a write
  takes away the pages, the choices of the ledger and the materials of
  a treatment record with one `removeQueries`.

The stock of a salon (`src/inventory/`) is seen in views and kept from
the header:

- **Views of one list are links**: every row, the low stock and the
  rows that expire soon are addresses of the same screen (`view` in the
  query), offered by the `Navigation` of `ui`, so a view is kept over a
  reload and the current one carries `aria-current`.
- **A row that names its parent by ID waits for the parent**: a stock
  row has the ID of its product alone, so the products of the salon are
  read beside the rows, and the rows are shown once their names are
  there; a product that is not among them is named as removed.
- **A control follows what is chosen**: the lot of a new row is asked
  for only when the product chosen is kept by lots. When the API says
  that the product was marked otherwise meanwhile, the products are
  read anew and the form follows them.

The movements of a stock row (`src/inventory/`) are recorded and read
by everybody who works at the salon:

- **A sign is chosen, not typed**: a quantity is typed as it is
  counted, and the kind gives it its sign; a kind that moves either way
  asks which way, in words ("the stock grows", "the stock shrinks").
  Nothing is chosen at first, so that no movement is recorded the wrong
  way by default.
- **What may be taken out is said before it is asked**: the form says
  the stock of the row and what of it is not reserved, and checks the
  quantity against them before sending. When the API says that the
  stock changed meanwhile (409), the row is read anew and the form says
  the stock it has now.
- **A history below its record**: the movements of a row are read under
  the key of the row, so that dropping the row once a movement is
  recorded drops its history as well.

The count of the stock and its value (`src/inventory/`) are for the
owner, a manager and an administrator:

- **A count is what was entered**: every row of the salon has a field,
  named by its product and its lot and described by what the books say,
  and only the rows that were filled in are counted. A salon counts
  shelf by shelf, in as many counts as it likes.
- **The result on the same screen**: once a count is recorded, the rows
  that differed from the books take the place of the form, which comes
  back, read anew and empty, to go on counting.
- **Refused as a whole**: a count records all its rows or none. When a
  row was removed meanwhile (400) or reserved below its count (409), the
  rows are read anew and the counts entered stay in their fields.
- **The value below the stock**: the value of the stock is read under
  the key of the stock, so that a movement or a count drops it with the
  rest.

The alerts of the stock (`src/inventory/`) are seen to by everybody who
works at the salon:

- **Worked out, never kept**: the API works the alerts out from the
  products and the rows whenever they are read, and an alert has no ID.
  The alerts and how many there are are read under the key of the stock,
  so a movement or a count drops them with the rest.
- **A table that fits a laptop**: four columns, of which what an alert
  is of and who saw to it break their lines; what a stock row expires on
  is said below its name, and what a product is held against below its
  stock.
- **Read before the dialog closes**: once an alert is acknowledged, or
  refused because it went (404) or somebody saw to it meanwhile (409),
  the alerts are read anew before the dialog closes, and the heading
  takes the focus. A refusal is said under the heading.

The purchase orders of a salon (`src/purchase-orders/`) are searched,
read, drafted, moved on and received by everybody who works at the
salon, and approved and cancelled by its owner, its managers and an
administrator:

- **Items as a count enters them**: every stock row of the salon has a
  quantity and a unit price, and only the rows given a quantity are
  ordered. A price starts as what the product is bought at; the tax is
  entered as the supplier bills it, and the form suggests it at the
  rate of the salon.
- **A subtotal as the API works it out**: each item is its quantity
  times its price, rounded half up to the yen in whole numbers
  (`BigInt`), and the form says the subtotal as the values are entered,
  from the values it last read over the rows there are now. What an
  amount of the API holds is checked before sending: the largest price
  an item may have is said at its price, a total too large above the
  form.
- **An order of the address**: the routes of the orders are not below
  the salon, and an administrator reads the orders of every salon, so
  an order of another salon is not found at the address of this one.
- **The steps an account may take**: what a status takes is a table of
  the status (`order-actions.ts`), filtered by whether the role of the
  account approves orders, as the API decides it; what is filtered out
  is said under the buttons, so that a stylist knows whom to ask. A
  step that only records what happened with the supplier is sent at
  once; a cancellation asks for its reason in a dialog. As with a
  booking, the order the API answered with is shown, the heading of the
  status takes the focus, and a 409 reads the order anew and says so
  there.
- **What is written down on an order as it goes on** (the day of the
  delivery, the notes) is changed on a screen of its own that sends
  what was changed; an order that does not change any more is offered
  no link to it, and its address says so.
- **The goods that came** are entered over what was ordered: each item
  whose stock row is still there starts at the quantity ordered, and an
  item left empty is not received. A value that the API keeps when it
  is not sent (the notes, for null) is sent only when it was changed,
  and what the API cannot clear is refused at its control. A receipt
  changes the stock, so the keys of the stock of the salon are dropped
  with those of the orders.
- **Suggestions that start a form**: the suggestions of a supplier
  lead to the form of a new order with the supplier in its address
  (`?suggested=`). The form reads them as well and starts with their
  quantities, each put on a row the form shows (a suggestion names a
  product, an item a stock row), says above itself how many rows it
  filled, and works its subtotal out from what it starts with.

The reviews of a salon (`src/reviews/`) are public, so everybody who
works at the salon reads them; what an account does to one is decided
by its role, as the API decides it:

- **What a role may not do is said where it would do it**: the owner
  and a manager write the answer of the salon and report a review, an
  administrator withdraws an answer and handles the reports, a stylist
  reads. The part of
  the answer says under its buttons who does what is not offered, and
  the address of the form of the answer says it in place of the form.
- **A refusal the API cannot be asked about first**: the API does not
  say who reported a review, so the report is offered every time, and
  a 409 replaces the form of the dialog with what it means and a
  single button that closes it, which takes the focus.
- **A withdrawal is a write of null**: it asks first in a dialog,
  shows the review the API answered with and moves the focus to the
  heading of the answer, as an operation of a booking does.

The reports of reviews (`src/review-reports/`) are handled by the
platform alone, below the salon of the reviews:

- **An operation of the platform is put where its record is shown**: an
  administrator dismisses the reports of a review, or removes the review,
  on the page of the review (`review-handling.tsx`), and the reports of
  the reviews of a salon are a list below its reviews
  (`/salons/:salonId/reviews/reports`), reached from their heading.
  Other roles are offered neither, and the address of the list tells
  them who handles the reports without asking the API.
- **A list that is worked down starts at what waits**: the reports that
  wait are the list without a query, the first received first, as the
  API gives them; the other states are a choice kept in the address
  (`reportsShownIn`).
- **A row names its record by reading it under the key of its page**:
  the review of a report is read with `useQueries` under `reviewKeyOf`,
  so the page of the review opens from what the list read; a review
  that went meanwhile is named so.
- **What another administrator did meanwhile is said in the part**: a
  report dismissed already (409) closes the dialog, is said above the
  reports, and the reports and the review are read anew. A review
  removed is put as not found, the lists of the salon are dropped, and
  the screen goes to the reviews.

The accounts users sign in with (`src/user-accounts/`) belong to no
salon, and an administrator looks after them at `/users/:userId`:

- **A record with no screen of its own is reached from those that hold
  its ID**: the API searches no users, so the customer page and the
  account of a member lead an administrator to the account, and offer
  other roles nothing. The address is not below a salon, so the header
  is that of the start, and the moments are those of the device, with
  its time zone said under them, as on the security of an account.
- **What the API takes is worked out as it decides it**: a lock is a
  state of `locked` or a lock that lasts beyond now (`lockOf`), and a
  second factor is reset when it is on; an operation is offered then
  alone, never on the account of the session, and the page says when
  there is nothing to do.
- **A write that only brings back what time would is done at once**: the
  lifting of a lock has no dialog; the reset of a second factor asks
  first, and says that the person who asks is made sure of by the
  support, since nothing else checks it. Either shows the account the
  API answered with and moves the focus to the heading of its record; a
  409 reads it anew and says above the record what changed meanwhile.
- **What another screen read of the same row is dropped**: a write on the
  account of a member drops what the account screen of the member read,
  so the way back shows it read anew.
- **Buttons that do not fit side by side stack**: the head of a card puts
  its buttons in a row, so two long ones are put in a grid of their own
  that stacks them on a narrow screen (`account-record.module.css`).

The operations of the platform (`src/operations/`) are run by an
administrator at `/operations`, led to from the header after the choice
of a salon:

- **Probes are read for a person as well as for a machine**: the three
  of them are asked at once, and one that does not answer is said to be
  silent while the others are shown as they answered, so that a process
  that runs and a database it does not reach tell where it stops. A 503
  of a probe is a state, not a failure.
- **An operation that is meant to run at intervals is run by hand after a
  dialog**: each says what it does, and the dialog what cannot be undone.
  One part (`OperationRun`) serves the three, with their words
  (`RunCopy`) and what each run did. The keys the API defaults are sent
  as null, as its documents use them.
- **What a run did is said where it was run, with its moment**: no
  record of the runs can be read again, so the part says it, with a
  table of what was carried out where there is one, until the screen is
  left. That there was nothing to do is said too.
- **A run that may have stopped halfway is said to be so**: the API does
  everything that was due up to a failure and never the same thing
  twice, so a failure says that what came before is done and that
  another run does the rest.

The files of a salon (`src/attachments/`) go between the browser and the
object storage, at URLs the API signs; the API keeps what is known of a
file:

- **A file is checked when the form is sent, as the API checks it**: the
  screen keeps the file the control tells as it is chosen (`onChoose`),
  and says at the control what the API would refuse (the kind by the
  ending of the name, the size, the name). The control offers only the
  kinds the API takes (`accept`), which a person can still overrule in
  the dialog of the browser.
- **An upload is three requests, one of them to the storage**: the URL is
  asked for, the file is sent to it with `fetch` and the headers the API
  answered with (and no token of the session: the storage is not the
  API), and the upload is finished. A file the storage did not take can
  be sent again; one that is not what its ending says is said at the
  control. After an upload the form is drawn anew, empty (a `key`), and
  its heading takes the focus for the next file.
- **A link to the storage is a plain `<a>`**: the `Link` of `ui` goes
  through the router. The URLs that open and save a file last five
  minutes: the screen reads both when it opens and every four minutes,
  and never shows one read on a screen before (`gcTime: 0`). A URL read
  when the link is pressed would open a tab that the browser blocks as a
  popup. The link that opens a file has `target='_blank'` and
  `rel='noopener noreferrer'`; an image is shown from the same URL.

The share links of a file (`src/share-links/`) are listed below it, and
issued and revoked on screens of their own:

- **What the API gives once is shown once, to be copied**: the token of
  a link is in the answer of the issue alone. The link that was issued
  takes the place of the form, held in state, and its heading takes the
  focus; the page says that it shows the address now alone. The address
  is in a field that is read only and chosen whole when it takes the
  focus, beside a button that writes it to the clipboard and says so in
  a status. Where the browser does not let the page write there, the page
  says to choose the field and copy it.
- **A moment worked out on the device depends on its clock**: the end of
  a link is the days chosen after now, cut to a whole minute. A refusal
  of it is said at the period, with the clock of the device as what to
  check.
- **A state is worked out when it is drawn**: whether a link still opens
  its file comes from its end and its count against the time of the
  screen. What the API does not say (a link locked after wrong
  passwords) is not shown.

## Screens that a mailed link opens

The API mails links to the portal (`PUBLIC_APP_URL`): `/verify-email`,
`/reset-password` and `/accept-staff-invitation`, each with `#token=…`
behind it. Their screens are in `frontend/apps/portal-app/src/account/`.
The share link that a salon gives has the same shape (`/share#token=…`,
`src/share/`).

- **The token is read once and taken out of the address**
  (`useMailedToken`): it stays neither in the address bar nor in the
  history. A page that is loaded again has none, and says that the link of
  the mail opens it. A link opened in the same tab while the screen is
  shown changes the fragment alone: its token takes the place of the one
  before, and the screen keys what it shows by the token
  (`<ResetWithToken key={token} token={token} />`), so that nothing of
  the link before stays.
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
  Every application knows its own address under the same name
  (`VITE_DASHBOARD_APP_URL` in the dashboard): the brand plugin makes the
  image of a shared link a whole address with it, and a build without it
  fails.

A share link opens a file for somebody who has no account
(`src/share/`):

- **What is counted is pressed for.** The link counts every download URL
  it issues, so the screen reads only what is known of the file when it
  opens, and a button loads the file: one URL, one `fetch` from the
  storage, and the page holds the file at an object URL
  (`URL.createObjectURL`, let go of when the screen closes). The image,
  the tab of its own and the saved file are made from what the page
  holds, and the button says that every load counts.
- **A password is asked for when the API refuses without one** (403). The
  screen keeps it while it is open, sends it again with the load, and
  asks for it again when the load is refused. The API does not tell a
  wrong password from a locked link, so neither does the screen; the
  control has `autoComplete='off'`.
- **A link that works no more** (404) is said once, with every reason it
  may have, as the API tells none.

## The frame of a screen

| Component | Use it for |
|-----------|------------|
| `AppShell` | The frame of an application: the link that skips to the content, the header (the mark and the `title`, a link to the first screen of the application, and the `account` at its end), the links of `navigation` in a row under the header, the main content with the notification at its top. Below 40rem the header is one row, and the links and the account are in its menu |
| `Navigation` | Links to screens or to views of one, under a name of their own. The application says which one is `current`; a row too long for the screen is scrolled to it, and `orientation='vertical'` puts them below each other, in as many columns as there is room for |
| `LinkProvider`, `Link`, `ButtonLink` | Links that move within the application: `Link` in a text or a list, `ButtonLink` for one that looks like a button |
| `PageHeader` | The top of a screen: its one `h1`, a description, the actions on the whole screen (`actions` always in sight, `otherActions` in the same row from 40rem and in a sheet behind 「ほかの操作」 below it) |
| `Card` | A part of a screen under its own heading (`h2`, or `h3` with `headingLevel={3}`). With `headingRef`, the heading takes the focus from the screen (and never from the Tab key): for a part whose content went with what had the focus. Its `actions` (an `Actions`) stand beside the heading from 40rem and below it on a narrower screen, so a heading keeps its width whatever the buttons are; below it they follow each other like words, and go on in the next line where the card ends: one or two short buttons (「施術記録を直す」 and 「削除」); links that need a sentence before them go in the body, below its text (`SalePoints`) |
| `Actions` | Buttons and links that stand together in the body of a part, in the order they are read. `flow` (the default) lets them follow each other like words and go on in the next line where the part ends: what can be done with a part, each on its own (「変更履歴」, 「ほかのお客様とまとめる」 and 「台帳から削除する」 of a customer); `row` puts them one below the other and as wide as the part below 40rem, and in a row from there, as a `Form` does: the button that sends what was entered and the way back from it, where they stand outside a `Form` (「登録する」 and 「やめる」 of a file of customers); `stack` puts them one below the other, each as wide as its label. A lone button needs none: it is as wide as its label wherever it stands |
| `Note` | A sentence said more quietly than the text around it: what a part, a list or a screen leaves out or adds (`size='medium'`, the default), or what goes with a control or a part of a form, as close to it as its description (`size='small'`). The descriptions of `Field`, `FormPart`, `Dialog`, `PageHeader` and `EmptyState` are `Note`s |
| `WrittenText` | What somebody wrote in several lines (a note, a request, a review), shown with its line breaks and its spaces: it is a paragraph, and a cell of a `Table` keeps its lines with `wrap: 'lines'`. Nothing written (`null`) is said as 「記録なし」, as a `DescriptionList` says it |
| `BulletList` | A short list of sentences with their bullets: what stands in the way of a merge, the rows of a file that were refused. A list of records is a `Table`, a list of cards a `CardList` |
| `CardList` | Records that are read one by one (bookings, reviews, salons, devices), each in the frame of a card: `--space-frame` inside the frame, `--space-content` between what an item holds, `--space-parts` between the items. `layout='tiles'` sets as many side by side as the width holds (the people of a salon) |
| `PagedList` | A `CardList` that is read a page at a time: how many there are (`count`, a status), the items, and `LoadMore`. The focus moves into the first item that 「さらに表示」 added: its first link, or the item (`focus='item'`) |
| `LoadMore`, `useFocusOnMore`, `More` | Below a list that is read a page at a time: 「さらに表示」, 「もう一度読み込む」 and why the page did not come (`More`: `none`, `available`, `loading`, `failed`); and the hook that moves the focus into the first item the button added, for a list that is no `PagedList` (`PagedTable`) |
| `PeriodSwitch` | The links from the period that is shown to the one before, to the one that holds today and to the one after, by the day or the week (`unit`): the words are its own. A link that `beforeHref` or `afterHref` does not give is left out |
| `NotRecorded`, `NOT_RECORDED`, `NONE` | 「記録なし」, quietly: what a `DescriptionList` and a `Table` show for a `null`, and the words for a sentence. 「なし」 (`NONE`) is what is none as a fact |
| `DescriptionList` | The names and values of one record, side by side on every screen, one line for a value. The names share a column as wide as the longest of them, and never more than two fifths of the list: a longer name goes on in a second line. A description that is `null` says 「記録なし」 |
| `Badge` | The state of a record, in a word, in the colours of a `Tone`, or `neutral` (`BadgeTone`) |
| `TagList` | A few words about a record, as a list with a name: the features of a salon, what a member of the staff is good at, the tags of a customer. A word longer than the line breaks where the line ends. No words are said as 「なし」 |
| `Rating` | A rating out of five: the stars, the number, and how many gave it |
| `QrCode` | A QR code drawn from its text, as an image with a name: what an authenticator app reads. The text stays in the browser |
| `Table` | A list of records. Its first column heads each row, or the one `rowHeader` names: the name of a customer, when a column of checkboxes comes first. A cell that is `null` says 「記録なし」 |
| `EmptyState` | What is shown where content would be, while there is none: a frame of its own in the place of the content of a page, and `kind='part'` quietly inside a card, with no frame (the photos of a treatment, the bill of a booking). `actions` lead on from there |
| `LoadingIndicator` | What is shown where content will be, while it loads. Its `label` says what is read |
| `UnreadNotice` | What is shown where content could not be read: the message the application words (`unreadMessageOf(what, reason)`), and the button that reads again (`pending` while it reads) |
| `VisuallyHidden` | Words that assistive technology reads and the eye does not see, where what is around them shows the same (the address of the account, in a narrow header). Its stylesheet holds the one rule of the frontend that hides from the eye; the components of `ui` use its class (the caption of a table, the label of a checkbox, the link that skips to the content) |
| `FilterForm`, `useFilterValues` | The conditions of a list, above it: the controls in sight, the other conditions (in a sheet on a narrow screen), the button that sends them (`purpose`: 「探す」, 「表示する」, 「集計する」) and the link that takes them away; and the values its controls show, which follow the address |
| `Dialog` | A question or a small form that has to be dealt with first: a sheet on the bottom edge of a narrow screen, a box in the middle of a wider one; `size='wide'` for a table to choose from; `kind='menu'` for links and buttons to choose from, which asks nothing |
| `NotificationProvider`, `useNotifications` | The result of what the user just did |

- **The name of an application** is that of `applications` in the brand
  package (`<AppShell title={applications.admin.name}>`): 「Kushi」, 「Kushi
  Admin」, 「Kushi Dashboard」. It is a name, so the screens in English carry
  it as it is, and it names no environment: the badge in the corner
  (`EnvironmentBanner`) does. A screen that does something is headed by
  what it does, the first screen of the portal too (「サロンを探す」); only
  the start of the admin and the dashboard application (`StartScreen`),
  which leads on to the screens of a salon, shows the name while it reads
  which salon that is.
- **The head of the page** is written by the brand plugin, not by
  `index.html`: the title, the description, the icons and what a shared
  link shows (Open Graph). `index.html` holds what every page has and
  nothing of the brand.
- **On a narrow screen the header is one row.** Below 40rem there is no
  room for the links of the navigation and the account beside the name:
  the header is the name and, at its end, the button 「メインメニュー」 (three
  lines, no word: 「メニュー」 is the menu of the services of a salon). It
  opens the menu, a `Dialog` of the kind `menu`: a sheet on the bottom
  edge with the links, two to a row, and the account below them, which
  shows the whole address there and buttons as high as the links
  (`useInMenu()`, which `AccountMenu` reads). A link or a button of the
  menu closes it once it is pressed, and so do the overlay, 「閉じる」 and
  the Escape key; the focus goes back to the button, and on to the heading
  of the screen a link opened. Without links (a visitor of the portal) the
  account stays in the header, beside the name: the way in.
- **What is drawn differently on a narrow screen is drawn once.**
  `AppShell`, `FilterForm` and `PageHeader` ask the browser whether the
  window is 40rem wide (`useWideScreen` of `ui/src/wide-screen.ts`,
  `matchMedia`, which hears when the window is turned) and draw either the
  row of links or the menu, either the conditions in a row or their sheet,
  either the other actions in the row or their sheet. They do not draw
  both and hide one with a stylesheet: a screen reader would find the same
  control twice, and so would a test. What only changes its look stays a
  media query of the stylesheet.
- **A screen** is a `PageHeader`, then its content; the frame gives them their
  width and the gaps between them. One `h1` per screen, and headings go down
  one level at a time.
- **The actions of a screen** are side by side on every width: below 40rem
  in columns 10rem wide at least (two on a phone, a button as wide as its
  column), from 40rem in the row of the heading. A screen with up to two
  actions gives them all as `actions`. One with more gives its main action
  as `actions` and the others as `otherActions`: in the row on a wide
  screen, and behind 「ほかの操作」 on a narrow one, in a sheet
  (`Dialog kind='menu'`) that closes once one of them is pressed. So the
  heading ends in one row of actions, and the content starts on the first
  screen. `otherActions` are links and buttons that do their work at once:
  an action that opens a dialog of its own stays in `actions`, since the
  dialog would close with the sheet.
- **The title of the document and the focus follow the screen.** Inside
  `AppShell`, `PageHeader` sets `document.title` to the title of the screen
  and that of the application (「顧客台帳 | Kushi Admin」; the title of
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
- **A button is as wide as its label, wherever it stands.** `Button` and
  `ButtonLink` size themselves to their content (`:where(.button)` in
  `button.module.css`, so that it weighs nothing), and follow the alignment
  of the grid they stand in (`justify-items`): a lone button needs no
  paragraph or `div` around it, and no `justify-self: start`. What gives
  its buttons the room it has says so for its own items (`Actions` of the
  layout `row`, the actions of a `Dialog` and of a `PageHeader`).
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
  line, but those of a column of text (`wrap`): `words` for names and
  sentences, which break between their words, and `lines` for what
  somebody wrote in lines, which keeps them. Such a cell is at least
  10rem and at most 28rem wide: as narrow as a character, a row would be
  as tall as its text is long. A table that is wider than its room
  scrolls inside its frame, which is then a region of the name of the
  table that the Tab key reaches (`useScrollsSideways`, which measures it
  with a `ResizeObserver`); a table that fits is neither, so that a page
  of tables adds no stops to the Tab key.
- **`Dialog`** is the `dialog` element opened with `showModal()`: the browser
  keeps the focus inside, makes the page behind inert, closes on Escape and
  gives the focus back. While it is open the page behind it does not
  scroll (`html:has(.dialog:modal)` in its stylesheet), and its overlay
  covers the window to its edges. The scrollbar of the page goes with the
  scrolling; where it took room of the window, the page keeps as much at
  its end, so it does not move sideways (the dialog notes the width in
  `--scrollbar-room` when it opens). Do not keep a strip free for the
  scrollbar with `scrollbar-gutter`: the overlay does not cover such a
  strip. A press on the overlay
  does not close it: it holds a question that has to be answered, or what
  somebody typed. A menu (`kind='menu'`) asks nothing: a press on the
  overlay closes it, and so does a press on one of its links or buttons,
  once that has done what it does (the menu of `AppShell`). Below 40rem it is a sheet on the bottom edge, as wide as
  the screen, which comes up from below (`@starting-style`; closing takes
  no time), with its actions one below the other, each as wide as the
  sheet. From 40rem it is a box in the middle, with its actions in a row
  at its end. It is never higher than the window: what is longer scrolls
  inside it, and its actions stay in sight at its bottom
  (`position: sticky`). Give the actions in the order they are read, the one
  that changes nothing first (「戻る」, then 「予約を取り消す」): the focus
  goes to the first. In a dialog with a form, the first control of the form
  stands before the actions and takes the focus. `onClose` is called once whenever
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
